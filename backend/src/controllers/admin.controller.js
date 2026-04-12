import prisma from "../config/db.js";
import { runCurrentOpportunitiesSyncFromSam, runIndustryDaySyncFromSam } from "./sam.controller.js";
import { runAwardsSyncFromUsaspending } from "./usaspending.controller.js";
import { runBackfillNullOpportunityDescriptionsFromSam, runBackfillOpportunityAttachments, runScoreAllParsedAttachments } from "./db.controller.js";
import { runScoreNewOpportunityAttachments, runBackfillInboxItemScores, runBackfillAwardInboxScores } from "../utils/inboxScoring.js";
import { loadFilterConfig, VALID_CONFIG_KEYS } from "../utils/filterConfig.js";
import { buildUnsubscribeToken, sendDigestEmail } from "../lib/digestEmail.js";
import { fetchDigestData, generateNarrative } from "../lib/digestContent.js";

// ─── SyncLog helper ──────────────────────────────────────────────────────────

/**
 * Wraps a sync function call with SyncLog creation/update.
 * @param {string} jobId  - stable machine identifier for this job
 * @param {string} jobName - human-readable display name
 * @param {Function} fn - async function to run
 * @param {Function} countFn - optional function to extract recordsAffected from result
 */
export async function withSyncLog(jobId, jobName, fn, countFn = null, failFn = null) {
  // Create a log entry with status RUNNING before starting the job.
  const log = await prisma.syncLog.create({
    data: { jobId, jobName, status: "RUNNING" },
  });

  try {
    // Run the sync function and capture the result.
    const result = await fn();
    const recordsAffected = countFn ? countFn(result) : null;
    const partialError = failFn ? failFn(result) : null;

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: partialError ? "PARTIAL" : "SUCCESS",
        completedAt: new Date(),
        recordsAffected: recordsAffected ?? null,
        errorMessage: partialError ?? null,
      },
    });

    return result;
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: err.message ?? String(err),
      },
    });
    throw err;
  }
}

// ─── User management ─────────────────────────────────────────────────────────

export const listUsers = async (req, res) => {
  // List all users with basic info; used in admin user management UI.
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        clerkId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.status(200).json(users);
  } catch (error) {
    console.error("Error listing users:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { role, isActive } = req.body;

  // Prevent admin from modifying their own role/status
  if (id === req.user.id) {
    return res.status(400).json({ message: "Cannot modify your own account" });
  }

  const data = {};
  // Only include fields that were provided in the request body
  if (role !== undefined) data.role = role;
  // isActive can be true or false, so we check for undefined to allow setting false
  if (isActive !== undefined) data.isActive = isActive;

  // If no valid fields were provided, return an error
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        imageUrl: true,
        createdAt: true,
      },
    });
    return res.status(200).json(user);
  } catch (error) {
    // Handle case where user with given ID does not exist
    if (error.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    console.error("Error updating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── System health ────────────────────────────────────────────────────────────

const KNOWN_JOBS = [
  { jobId: "sync-current-sam-opportunities", jobName: "Sync SAM Opportunities" },
  { jobId: "sync-usaspending-awards", jobName: "Sync USASpending Awards" },
  { jobId: "backfill-opportunity-descriptions", jobName: "Backfill Opportunity Descriptions" },
  { jobId: "sync-sam-industry-days", jobName: "Sync SAM Industry Days" },
  { jobId: "backfill-opportunity-attachments", jobName: "Backfill Attachment Metadata" },
  { jobId: "deactivate-expired-opportunities", jobName: "Deactivate Expired Opportunities" },
  { jobId: "mark-past-industry-days", jobName: "Mark Past Industry Days" },
  { jobId: "cleanup-expired-chats", jobName: "Cleanup Expired Chats" },
  { jobId: "score-parsed-attachments", jobName: "Score Parsed Attachments" },
  { jobId: "score-new-opportunity-attachments", jobName: "Score New Opportunity Attachments" },
  { jobId: "backfill-inbox-item-scores", jobName: "Backfill Inbox Item Scores" },
  { jobId: "backfill-award-inbox-scores", jobName: "Backfill Award Inbox Scores" },
  { jobId: "send-daily-digest", jobName: "Send Daily Digest Email" },
  { jobId: "cleanup-expired-parsed-docs", jobName: "Cleanup Expired Parsed Docs" },
];

export const getSystemHealth = async (req, res) => {
  try {
    const results = await Promise.all(
      KNOWN_JOBS.map(({ jobId, jobName }) =>
        prisma.syncLog
          .findMany({
            where: { jobId },
            orderBy: { startedAt: "desc" },
            take: 5,
          })
          .then((logs) => ({
            jobId,
            jobName,
            lastRun: logs[0] ?? null,
            history: logs,
          }))
      )
    );
    return res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching system health:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Manual sync triggers ─────────────────────────────────────────────────────

const SYNC_JOBS = {
  "sam-opportunities": {
    jobId: "sync-current-sam-opportunities",
    jobName: "Sync SAM Opportunities",
    // The fn should return an object that countFn and failFn can use to determine records affected and any partial errors. 
    fn: () => runCurrentOpportunitiesSyncFromSam(),
    countFn: (r) => r?.db?.upserted ?? null,
    failFn: (r) => {
      const msg = [];
      if (r?.meta?.partial) msg.push("incomplete fetch (SAM.gov 504 errors)");
      const dbErrors = r?.db?.errors?.length ?? 0;
      if (dbErrors > 0) msg.push(`${dbErrors} opportunity upsert error(s)`);
      return msg.length > 0 ? msg.join("; ") : null;
    },
  },
  "usaspending-awards": {
    jobId: "sync-usaspending-awards",
    jobName: "Sync USASpending Awards",
    fn: () => runAwardsSyncFromUsaspending(),
    countFn: (r) => {
      if (!r?.presets) return null;
      return Object.values(r.presets).reduce((sum, p) => sum + (p?.db?.upserted ?? 0), 0);
    },
    failFn: (r) => {
      const n = Object.values(r?.presets ?? {}).reduce((sum, p) => sum + (p?.db?.errors?.length ?? 0), 0);
      return n > 0 ? `${n} award upsert error(s)` : null;
    },
  },
  "sam-descriptions": {
    jobId: "backfill-opportunity-descriptions",
    jobName: "Backfill Opportunity Descriptions",
    fn: () => runBackfillNullOpportunityDescriptionsFromSam(),
    countFn: (r) => r?.results?.updated ?? null,
    failFn: (r) => {
      const n = r?.results?.failed ?? 0;
      return n > 0 ? `${n} description fetch error(s)` : null;
    },
  },
  "sam-industry-days": {
    jobId: "sync-sam-industry-days",
    jobName: "Sync SAM Industry Days",
    fn: () => runIndustryDaySyncFromSam(),
    countFn: (r) => r?.db?.upserted ?? null,
    failFn: (r) => {
      const msg = [];
      if (r?.meta?.partial) msg.push("incomplete fetch (SAM.gov 504 errors)");
      const dbErrors = r?.db?.errors?.length ?? 0;
      if (dbErrors > 0) msg.push(`${dbErrors} industry day upsert error(s)`);
      return msg.length > 0 ? msg.join("; ") : null;
    },
  },
  "sam-attachments": {
    jobId: "backfill-opportunity-attachments",
    jobName: "Backfill Attachment Metadata",
    fn: () => runBackfillOpportunityAttachments(),
    countFn: (r) => r?.results?.upserted ?? null,
    failFn: (r) => {
      const n = r?.results?.failed ?? 0;
      return n > 0 ? `${n} attachment fetch error(s)` : null;
    },
  },
  "cleanup-chats": {
    jobId: "cleanup-expired-chats",
    jobName: "Cleanup Expired Chats",
    fn: async () => {
      const deleted = await prisma.chatConversation.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      });
      return { deletedCount: deleted.count };
    },
    countFn: (r) => r?.deletedCount ?? null,
  },
  "score-attachments": {
    jobId: "score-parsed-attachments",
    jobName: "Score Parsed Attachments",
    fn: () => runScoreAllParsedAttachments(),
    countFn: (r) => r?.results?.scored ?? null,
    failFn: (r) => {
      const n = r?.results?.failed ?? 0;
      return n > 0 ? `${n} attachment scoring error(s)` : null;
    },
  },
  "score-opportunity-attachments": {
    jobId: "score-new-opportunity-attachments",
    jobName: "Score New Opportunity Attachments",
    fn: () => runScoreNewOpportunityAttachments(),
    countFn: (r) => r?.results?.scored ?? null,
    failFn: (r) => {
      const n = r?.results?.errors ?? 0;
      return n > 0 ? `${n} scoring error(s)` : null;
    },
  },
  "backfill-inbox-scores": {
    jobId: "backfill-inbox-item-scores",
    jobName: "Backfill Inbox Item Scores",
    fn: () => runBackfillInboxItemScores(),
    countFn: (r) => r?.results?.scored ?? null,
    failFn: (r) => {
      const n = r?.results?.failed ?? 0;
      return n > 0 ? `${n} scoring error(s)` : null;
    },
  },
  "backfill-award-inbox-scores": {
    jobId: "backfill-award-inbox-scores",
    jobName: "Backfill Award Inbox Scores",
    fn: () => runBackfillAwardInboxScores(),
    countFn: (r) => r?.results?.scored ?? null,
    failFn: (r) => {
      const n = r?.results?.failed ?? 0;
      return n > 0 ? `${n} scoring error(s)` : null;
    },
  },
  "send-daily-digest": {
    jobId: "send-daily-digest",
    jobName: "Send Daily Digest Email",
    fn: async () => {
      const recipients = await prisma.user.findMany({
        where: { isActive: true, role: { in: ["READ_ONLY", "ADMIN"] }, digestEnabled: true },
        select: { id: true, email: true, name: true },
      });
      if (recipients.length === 0) return { sent: 0, total: 0 };

      const data = await fetchDigestData();
      const narrative = await generateNarrative(data);
      const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

      let sent = 0;
      for (const user of recipients) {
        try {
          await sendDigestEmail({ user, data, narrative, dateLabel });
          sent++;
        } catch (err) {
          console.error(`[Digest] Failed to send to ${user.email}:`, err.message);
        }
      }
      return { sent, total: recipients.length };
    },
    countFn: (r) => r?.sent ?? null,
  },
  "cleanup-db": {
    jobId: "cleanup-expired-parsed-docs",
    jobName: "Cleanup Expired Parsed Docs",
    fn: async () => {
      const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
      const { count } = await prisma.opportunityAttachment.updateMany({
        where: {
          parsedText: { not: null },
          opportunity: { active: false, responseDeadline: { lt: cutoff } },
        },
        data: { parsedText: null, parsedAt: null },
      });
      return { clearedCount: count };
    },
    countFn: (r) => r?.clearedCount ?? null,
  },
};

export const triggerSync = async (req, res) => {
  const { type } = req.params;
  const job = SYNC_JOBS[type];

  if (!job) {
    return res.status(400).json({ message: `Unknown sync type: ${type}` });
  }

  try {
    const result = await withSyncLog(job.jobId, job.jobName, job.fn, job.countFn, job.failFn ?? null);
    const recordsAffected = job.countFn ? job.countFn(result) : null;
    return res.status(200).json({
      ok: true,
      jobId: job.jobId,
      jobName: job.jobName,
      recordsAffected,
    });
  } catch (error) {
    console.error(`Error triggering sync ${type}:`, error);
    return res.status(500).json({
      message: `Sync failed: ${error.message ?? "Unknown error"}`,
    });
  }
};

// ─── Cleanup DB Preview ───────────────────────────────────────────────────────

export const getCleanupDbPreview = async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
    const [attachmentCount, opportunityCount] = await Promise.all([
      prisma.opportunityAttachment.count({
        where: {
          parsedText: { not: null },
          opportunity: { active: false, responseDeadline: { lt: cutoff } },
        },
      }),
      prisma.opportunity.count({
        where: {
          active: false,
          responseDeadline: { lt: cutoff },
          attachments: { some: { parsedText: { not: null } } },
        },
      }),
    ]);
    return res.status(200).json({ opportunityCount, attachmentCount });
  } catch (error) {
    console.error("Error fetching cleanup preview:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── DB Stats ─────────────────────────────────────────────────────────────────

export const getDbStats = async (req, res) => {
  try {
    const [
      activeOpps,
      inactiveOpps,
      awards,
      contacts,
      inboxByStatus,
      chatConversations,
    ] = await Promise.all([
      prisma.opportunity.count({ where: { active: true } }),
      prisma.opportunity.count({ where: { active: false } }),
      prisma.award.count(),
      prisma.contact.count(),
      prisma.inboxItem.groupBy({ by: ["reviewStatus"], _count: { _all: true } }),
      prisma.chatConversation.count(),
    ]);

    const inboxCounts = Object.fromEntries(
      inboxByStatus.map(({ reviewStatus, _count }) => [reviewStatus, _count._all])
    );

    return res.status(200).json({
      opportunities: { active: activeOpps, inactive: inactiveOpps },
      awards,
      contacts,
      inbox: inboxCounts,
      chatConversations,
    });
  } catch (error) {
    console.error("Error fetching DB stats:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Filter Configuration ─────────────────────────────────────────────────────

export const getFilterConfig = async (req, res) => {
  try {
    // loadFilterConfig seeds any missing keys; then we fetch all 8
    await loadFilterConfig(prisma);
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: VALID_CONFIG_KEYS } },
    });
    const config = Object.fromEntries(rows.map((r) => [r.key, r.values]));
    return res.status(200).json(config);
  } catch (error) {
    console.error("Error fetching filter config:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getPublicConfig = async (req, res) => {
  try {
    const row = await prisma.appConfig.findUnique({ where: { key: "chatRetentionDays" } });
    return res.status(200).json({ chatRetentionDays: row?.values ?? ["14"] });
  } catch (error) {
    console.error("Error fetching public config:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Company Profile ─────────────────────────────────────────────────────────

const COMPANY_PROFILE_DEFAULT = {
  legalName: "Prime Printer Solution Inc",
  dba: "SupplyTiger",
  uei: "REMMPZ6DUJ88",
  cageCode: "4Z7K1",
  samStatus: "Active",
  gsaSchedule: "In progress",
  established: 2006,
  businessType: "S Corporation",
  naicsCodes: [
    { code: "424450", description: "Confectionery Merchant Wholesalers" },
    { code: "424410", description: "General Line Grocery Merchant Wholesalers" },
    { code: "424490", description: "Other Grocery And Related Products Merchant Wholesalers" },
  ],
  pscCodes: [
    { code: "8925", description: "Sugar, Confectionery, And Nuts" },
    { code: "8950", description: "Condiments and Related Products" },
  ],
  acquisitionPaths: ["MICROPURCHASE", "GSA", "SUBCONTRACTING"],
  coreCompetencies: [
    "Climate-controlled chocolate fulfillment",
    "Bulk distribution of food products (candy, chocolate, spice sets)",
    "Fulfillment & eCommerce expertise (Amazon, Walmart, B2B)",
  ],
  contact: {
    name: "Ryan Spahr, CEO",
    phone: "610-400-8127",
    email: "gov@primeprinter.net",
    website: "www.supplytiger.fun",
    address: "1595 South Mount Joy Street, Suite 002, Elizabethtown PA 17022",
  },
};

export const getCompanyProfile = async (req, res) => {
  try {
    const row = await prisma.appConfig.findUnique({ where: { key: "companyProfile" } });
    if (row?.values?.[0]) {
      return res.status(200).json(JSON.parse(row.values[0]));
    }
    return res.status(200).json(COMPANY_PROFILE_DEFAULT);
  } catch (error) {
    console.error("Error fetching company profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCompanyProfile = async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ message: "Body must be an object" });
  }
  if (!Array.isArray(body.naicsCodes) || !Array.isArray(body.pscCodes)) {
    return res.status(400).json({ message: "naicsCodes and pscCodes must be arrays" });
  }
  if (!body.contact || typeof body.contact !== "object") {
    return res.status(400).json({ message: "contact must be an object" });
  }

  try {
    await prisma.appConfig.upsert({
      where: { key: "companyProfile" },
      update: { values: [JSON.stringify(body)] },
      create: { key: "companyProfile", values: [JSON.stringify(body)] },
    });
    return res.status(200).json(body);
  } catch (error) {
    console.error("Error updating company profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Parsed Documents (OpportunityAttachment) ────────────────────────────────

const PARSED_DOCUMENT_FILTERS = {
  all: {},
  unparsed: { parsedAt: null },
  parsed: { parsedAt: { not: null } },
  scored: { scoredAt: { not: null } },
  unscored: { parsedAt: { not: null }, scoredAt: null }, // parsed but not yet scored
};

export const getParsedDocumentStats = async (req, res) => {
  try {
    const [total, parsed, scored] = await Promise.all([
      prisma.opportunityAttachment.count(),
      prisma.opportunityAttachment.count({ where: { parsedAt: { not: null } } }),
      prisma.opportunityAttachment.count({ where: { scoredAt: { not: null } } }),
    ]);
    return res.status(200).json({
      total,
      parsed,
      unparsed: total - parsed,
      scored,
      unscored: total - scored,
    });
  } catch (error) {
    console.error("Error fetching parsed document stats:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const listParsedDocuments = async (req, res) => {
  const { page = "1", limit = "25", filter = "all" } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const take = Math.min(50, Math.max(1, parseInt(limit, 10) || 25));
  const skip = (pageNum - 1) * take;
  const where = PARSED_DOCUMENT_FILTERS[filter] ?? {};

  try {
    const [total, items] = await Promise.all([
      prisma.opportunityAttachment.count({ where }),
      prisma.opportunityAttachment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          mimeType: true,
          size: true,
          parsedAt: true,
          scoredAt: true,
          createdAt: true,
          opportunity: {
            select: { id: true, title: true, solicitationNumber: true },
          },
        },
      }),
    ]);
    return res.status(200).json({
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / take)),
      items,
    });
  } catch (error) {
    console.error("Error listing parsed documents:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateFilterConfig = async (req, res) => {
  const { key } = req.params;
  const { values } = req.body;

  if (!VALID_CONFIG_KEYS.includes(key)) {
    return res.status(400).json({ message: `Unknown config key: ${key}` });
  }
  if (!Array.isArray(values)) {
    return res.status(400).json({ message: "values must be an array" });
  }

  try {
    let finalValues = values;

    // Deduplicate overlapping email rules — ADMIN always wins over READ_ONLY
    if (key === "adminEmailRules" || key === "readOnlyEmailRules") {
      const otherKey = key === "adminEmailRules" ? "readOnlyEmailRules" : "adminEmailRules";
      const otherRow = await prisma.appConfig.findUnique({ where: { key: otherKey } });
      const otherValues = otherRow?.values ?? [];

      if (key === "adminEmailRules") {
        // Remove newly-promoted admin entries from readOnlyEmailRules
        const newAdminSet = new Set(values.map((v) => v.toLowerCase()));
        const cleanedReadOnly = otherValues.filter((v) => !newAdminSet.has(v.toLowerCase()));
        if (cleanedReadOnly.length !== otherValues.length) {
          await prisma.appConfig.update({
            where: { key: "readOnlyEmailRules" },
            data: { values: cleanedReadOnly },
          });
        }
      } else {
        // Strip any entries that are already admin rules
        const adminSet = new Set(otherValues.map((v) => v.toLowerCase()));
        finalValues = values.filter((v) => !adminSet.has(v.toLowerCase()));
      }
    }

    const updated = await prisma.appConfig.upsert({
      where: { key },
      update: { values: finalValues },
      create: { key, values: finalValues },
    });

    return res.status(200).json({ key: updated.key, values: updated.values });
  } catch (error) {
    console.error(`Error updating filter config key ${key}:`, error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Digest unsubscribe (public — no auth, protected by HMAC) ────────────────

export const handleDigestUnsubscribe = async (req, res) => {
  const { userId, token } = req.query;
  if (!userId || !token) return res.status(400).send("<p>Invalid unsubscribe link.</p>");

  const expected = buildUnsubscribeToken(userId);
  if (token !== expected) return res.status(403).send("<p>Invalid or expired unsubscribe token.</p>");

  try {
    await prisma.user.update({ where: { id: userId }, data: { digestEnabled: false } });
    return res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px;">
      <h2>Unsubscribed</h2>
      <p>You've been removed from the daily digest. You won't receive future emails.</p>
    </body></html>`);
  } catch {
    return res.status(500).send("<p>Something went wrong. Please try again.</p>");
  }
};

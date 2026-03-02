import prisma from "../config/db.js";
import { runCurrentOpportunitiesSyncFromSam, runIndustryDaySyncFromSam } from "./sam.controller.js";
import { runAwardsSyncFromUsaspending } from "./usaspending.controller.js";
import { runBackfillNullOpportunityDescriptionsFromSam } from "./db.controller.js";
import { loadFilterConfig, VALID_CONFIG_KEYS } from "../utils/filterConfig.js";

// ─── SyncLog helper ──────────────────────────────────────────────────────────

/**
 * Wraps a sync function call with SyncLog creation/update.
 * @param {string} jobId  - stable machine identifier for this job
 * @param {string} jobName - human-readable display name
 * @param {Function} fn - async function to run
 * @param {Function} countFn - optional function to extract recordsAffected from result
 */
export async function withSyncLog(jobId, jobName, fn, countFn = null, failFn = null) {
  const log = await prisma.syncLog.create({
    data: { jobId, jobName, status: "RUNNING" },
  });

  try {
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
    return res.json(users);
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
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;

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
    return res.json(user);
  } catch (error) {
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
  { jobId: "deactivate-expired-opportunities", jobName: "Deactivate Expired Opportunities" },
  { jobId: "mark-past-industry-days", jobName: "Mark Past Industry Days" },
];

export const getSystemHealth = async (req, res) => {
  try {
    const results = await Promise.all(
      KNOWN_JOBS.map(({ jobId, jobName }) =>
        prisma.syncLog
          .findFirst({
            where: { jobId },
            orderBy: { startedAt: "desc" },
          })
          .then((log) => ({
            jobId,
            jobName,
            lastRun: log ?? null,
          }))
      )
    );
    return res.json(results);
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
      return Object.values(r.presets).reduce((sum, p) => sum + (p?.upserted ?? 0), 0);
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
    return res.json({
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

// ─── Filter Configuration ─────────────────────────────────────────────────────

export const getFilterConfig = async (req, res) => {
  try {
    // loadFilterConfig seeds any missing keys; then we fetch all 8
    await loadFilterConfig(prisma);
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: VALID_CONFIG_KEYS } },
    });
    const config = Object.fromEntries(rows.map((r) => [r.key, r.values]));
    return res.json(config);
  } catch (error) {
    console.error("Error fetching filter config:", error);
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
    const updated = await prisma.appConfig.upsert({
      where: { key },
      update: { values },
      create: { key, values },
    });
    return res.json({ key: updated.key, values: updated.values });
  } catch (error) {
    console.error(`Error updating filter config key ${key}:`, error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

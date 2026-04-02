import { createRequire } from "module";
import prisma from "../config/db.js";
import { ENV } from "../config/env.js";
import { UserRole, IndustryDayStatus } from "@prisma/client";
import {fetchOpportunityDescriptionFromSam} from "./sam.controller.js";
import mammoth from "mammoth";

import { stripHTML } from "../utils/extractSAM.js";
import { buildInboxTitle } from "../utils/inboxText.js";
import {
  writeCsv,
  fmtDate,
  fmtCurrency,
  extractRelevantSections,
  resolveFileExtension,
  MAX_PARSE_SIZE,
  SUPPORTED_PARSE_TYPES,
} from "../utils/csv.js";
import { resolveRoleForEmail } from "../utils/filterConfig.js";
import { emitInternalEventSafe } from "../config/inngestClient.js";
import { scoreOpportunity } from "../utils/opportunityScoring.js";
import { parseAttachmentContent } from "../utils/parseAttachmentContent.js";

// pdf-parse v1 is CJS-only
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const normalizeClerkUserPayload = (event) => {
  const input = Array.isArray(event) ? event[0] : event;
  const data = input?.data ?? input ?? {};

  const clerkId = data?.id ?? null;
  const emailAddresses = Array.isArray(data?.email_addresses)
    ? data.email_addresses
    : Array.isArray(data?.emailAddresses)
      ? data.emailAddresses
      : [];

  const primaryEmailId =
    data?.primary_email_address_id ?? data?.primaryEmailAddressId ?? null;

  const primaryEmailObj =
    emailAddresses.find((entry) => entry?.id === primaryEmailId) ||
    emailAddresses[0] ||
    null;

  const email =
    primaryEmailObj?.email_address ?? primaryEmailObj?.emailAddress ?? null;

  const firstName = data?.first_name ?? data?.firstName ?? null;
  const lastName = data?.last_name ?? data?.lastName ?? null;
  const imageUrl = data?.image_url ?? data?.imageUrl ?? null;
  const name =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Unnamed User";

  return {
    clerkId,
    email,
    name,
    imageUrl,
  };
};

const upsertUserFromClerk = async ({
  clerkId,
  email,
  name,
  imageUrl,
  role,
}) => {
  const existingByClerkId = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (existingByClerkId) {
    // Never overwrite a manually-set role — only sync profile fields
    return prisma.user.update({
      where: { clerkId },
      data: { email, name, imageUrl },
    });
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingByEmail) {
    // Linking an existing email-based account to Clerk — apply resolved role
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: { clerkId, email, name, imageUrl, role },
    });
  }

  // Brand new user — assign role from ADMIN_EMAILS
  return prisma.user.create({
    data: { clerkId, email, name, imageUrl, role },
  });
};

export const createUser = async (event) => {
  try {
    const { clerkId, email, name, imageUrl } = normalizeClerkUserPayload(event);

    if (!clerkId) {
      throw new Error("Missing clerkId in user.created event payload");
    }

    if (!email) {
      console.warn(
        `Skipping user create for clerkId=${clerkId}: no email found in Clerk payload`,
      );
      return;
    }

    const role = await resolveRoleForEmail(prisma, email);

    await upsertUserFromClerk({ clerkId, email, name, imageUrl, role });
  } catch (error) {
    console.error("Error syncing user to database:", {
      message: error?.message ?? String(error),
      code: error?.code,
      meta: error?.meta,
    });
    throw error;
  }
};

export const updateUser = async (event) => {
  try {
    const { clerkId, email, name, imageUrl } = normalizeClerkUserPayload(event);

    if (!clerkId) {
      throw new Error("Missing clerkId in user.updated event payload");
    }

    if (!email) {
      console.warn(
        `Skipping user update for clerkId=${clerkId}: no email found in Clerk payload`,
      );
      return;
    }

    const role = await resolveRoleForEmail(prisma, email);

    await upsertUserFromClerk({ clerkId, email, name, imageUrl, role });
  } catch (error) {
    console.error("Error updating user in database:", {
      message: error?.message ?? String(error),
      code: error?.code,
      meta: error?.meta,
    });
    throw error;
  }
};

export const deleteUser = async (event) => {
  try {
    const clerkId = event?.data?.id ?? event?.id;
    if (!clerkId) return;

    await prisma.user.delete({
      where: { clerkId },
    });
  } catch (error) {
    if (error?.code === "P2025") {
      return;
    }
    console.error("Error deleting user from database:", {
      message: error?.message ?? String(error),
      code: error?.code,
      meta: error?.meta,
    });
    throw error;
  }
};

export const changeExpiredOpportunitiesToInactive = async () => {
  const now = new Date();
  const BATCH_SIZE = 500;
  let totalDeactivated = 0;

  try {
    while (true) {
      const expired = await prisma.opportunity.findMany({
        where: { responseDeadline: { lt: now }, active: true },
        select: { id: true },
        take: BATCH_SIZE,
      });

      if (expired.length === 0) break;

      const result = await prisma.opportunity.updateMany({
        where: { id: { in: expired.map((o) => o.id) } },
        data: { active: false },
      });

      totalDeactivated += result.count;
      if (expired.length < BATCH_SIZE) break;
    }

    return { count: totalDeactivated, message: `Deactivated ${totalDeactivated} expired opportunities` };
  } catch (error) {
    console.error("Error deactivating expired opportunities:", {
      message: error?.message ?? "Unknown error",
    });
    throw error;
  }
};

export const runBackfillNullOpportunityDescriptionsFromSam = async ({
  cacheInDB = true,
  limit = 100,
} = {}) => {
  const safeLimit = Math.max(
    1,
    Math.min(Number.parseInt(limit, 10) || 100, 1000),
  );

  const opportunities = await prisma.opportunity.findMany({
    where: {
      noticeId: { not: null },
      OR: [{ description: null }, { description: "" }],
    },
    select: {
      id: true,
      noticeId: true,
      title: true,
    },
    take: safeLimit,
    orderBy: { postedDate: "desc" },
  });

  let fetched = 0;
  let updated = 0;
  let noDescription = 0;
  let failed = 0;
  const failures = [];

  for (const opp of opportunities) {
    if (!opp.noticeId) {
      failed += 1;
      failures.push({
        id: opp.id,
        noticeId: null,
        title: opp.title,
        message: "Missing noticeId",
      });
      continue;
    }

    try {
      const description = await fetchOpportunityDescriptionFromSam(
        opp.noticeId,
      );
      fetched += 1;

      if (!description) {
        noDescription += 1;
        continue;
      }

      const filteredDescription = stripHTML(description);

      if (cacheInDB && filteredDescription) {
        await prisma.opportunity.update({
          where: { id: opp.id },
          data: { description: filteredDescription },
        });
        updated += 1;
      }
    } catch (error) {
      failed += 1;
      failures.push({
        id: opp.id,
        noticeId: opp.noticeId,
        title: opp.title,
        message: error?.message ?? String(error),
      });
    }
  }

  return {
    ok: true,
    cacheInDB,
    meta: {
      selected: opportunities.length,
      limit: safeLimit,
    },
    results: {
      fetched,
      updated,
      noDescription,
      failed,
    },
    failures,
  };
};

// ---------- Attachment metadata backfill ----------

const SAM_RESOURCES_BASE = ENV.SAMGOV_RESOURCES_URL;

export const runBackfillOpportunityAttachments = async ({
  limit = 50,
} = {}) => {
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, 200));

  // Find active opportunities with no attachment records yet
  const opportunities = await prisma.opportunity.findMany({
    where: {
      noticeId: { not: null },
      active: true,
      attachments: { none: {} },
    },
    select: {
      id: true,
      noticeId: true,
      title: true,
    },
    take: safeLimit,
    orderBy: { postedDate: "desc" },
  });

  let fetched = 0;
  let upserted = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  for (const opp of opportunities) {
    try {
      const response = await fetch(
        `${SAM_RESOURCES_BASE}/${opp.noticeId}/resources`,
        { signal: AbortSignal.timeout(15000) },
      );

      if (response.status === 404) {
        skipped += 1;
        continue;
      }

      if (!response.ok) {
        failed += 1;
        failures.push({
          id: opp.id,
          noticeId: opp.noticeId,
          title: opp.title,
          message: `HTTP ${response.status}`,
        });
        continue;
      }

      const data = await response.json();
      const attachments =
        data?._embedded?.opportunityAttachmentList?.[0]?.attachments ?? [];
      fetched += 1;

      // Filter to public file attachments only — exclude link-type resources
      // which pass fileExists === "1" but are not downloadable files
      const publicAttachments = attachments.filter(
        (a) => a.accessLevel === "public" && a.fileExists === "1" && a.type !== "link",
      );

      for (const att of publicAttachments) {
        const resourceId = att.resourceId;
        if (!resourceId) continue;

        const downloadUrl = `${SAM_RESOURCES_BASE}/resources/files/${resourceId}/download`;
        const name = att.name || `attachment-${resourceId}`;

        await prisma.opportunityAttachment.upsert({
          where: { resourceId },
          update: {
            name,
            mimeType: att.mimeType || null,
            size: att.size ? Number(att.size) : null,
            postedDate: att.postedDate ? new Date(att.postedDate) : null,
            attachmentOrder: att.attachmentOrder ? Number(att.attachmentOrder) : null,
            downloadUrl,
          },
          create: {
            resourceId,
            name,
            mimeType: att.mimeType || null,
            size: att.size ? Number(att.size) : null,
            postedDate: att.postedDate ? new Date(att.postedDate) : null,
            attachmentOrder: att.attachmentOrder ? Number(att.attachmentOrder) : null,
            downloadUrl,
            opportunityId: opp.id,
          },
        });
        upserted += 1;
      }

      skipped += attachments.length - publicAttachments.length;
    } catch (error) {
      failed += 1;
      failures.push({
        id: opp.id,
        noticeId: opp.noticeId,
        title: opp.title,
        message: error?.message ?? String(error),
      });
    }

    // Rate limit: 200ms between opportunities
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return {
    ok: true,
    meta: {
      selected: opportunities.length,
      limit: safeLimit,
    },
    results: {
      fetched,
      upserted,
      skipped,
      failed,
    },
    failures,
  };
};

export const markPastIndustryDays = async () => {
  const now = new Date();
  try {
    const result = await prisma.industryDay.updateMany({
      where: {
        eventDate: { lt: now },
        status: { not: IndustryDayStatus.PAST_EVENT },
      },
      data: { status: IndustryDayStatus.PAST_EVENT },
    });
    return { message: `Marked ${result.count} industry days as PAST_EVENT` };
  } catch (error) {
    console.error("Error marking past industry days:", {
      message: error?.message ?? "Unknown error",
    });
    throw error;
  }
};

// ---------------------------------------------------------------------------
// HTTP Route Controllers
// ---------------------------------------------------------------------------

const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// --- InboxItem controllers ---

export const listInboxItems = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};
    if (req.query.status) where.reviewStatus = req.query.status;
    if (req.query.title) where.opportunity = { title: { contains: req.query.title, mode: "insensitive" } };
    const validInboxSortFields = ["createdAt", "deadline", "attachmentScore"];
    const inboxSortBy = validInboxSortFields.includes(req.query.sortBy) ? req.query.sortBy : null;
    const inboxSortDir = req.query.sortDir === "asc" ? "asc" : "desc";
    // For nullable sort fields (attachmentScore), append createdAt as tiebreaker so nulls sink to bottom naturally
    const inboxOrderBy = inboxSortBy
      ? [{ [inboxSortBy]: inboxSortDir }, { createdAt: "desc" }]
      : { createdAt: "desc" };

    const [total, items] = await Promise.all([
      prisma.inboxItem.count({ where }),
      prisma.inboxItem.findMany({
        where,
        include: { opportunity: true, award: true },
        orderBy: inboxOrderBy,
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      meta: { total, page, limit, returned: items.length },
      data: items,
    });
  } catch (error) {
    console.error("listInboxItems error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const createInboxItem = async (req, res) => {
  try {
    const { source, acquisitionPath, type, tag, opportunityId, awardId } = req.body;
    if (!source || !acquisitionPath || !type || !tag) {
      return res.status(400).json({ error: "source, acquisitionPath, type, and tag are required" });
    }

    let inboxTitle = null;
    let deadline = null;
    if (opportunityId) {
      const opp = await prisma.opportunity.findUnique({ where: { id: opportunityId }, select: { title: true, naicsCodes: true, pscCode: true, responseDeadline: true } });
      inboxTitle = buildInboxTitle({ entityLabel: "Opportunity", naicsCodes: opp?.naicsCodes, pscCode: opp?.pscCode, text: opp?.title });
      deadline = opp?.responseDeadline ?? null;
    } else if (awardId) {
      const award = await prisma.award.findUnique({ where: { id: awardId }, select: { description: true, naicsCodes: true, pscCode: true } });
      inboxTitle = buildInboxTitle({ entityLabel: "Award", naicsCodes: award?.naicsCodes, pscCode: award?.pscCode, text: award?.description?.split("|")[0]?.trim() ?? null });
    }
    const item = await prisma.inboxItem.create({
      data: {
        source,
        acquisitionPath,
        type,
        tag,
        opportunityId: opportunityId || null,
        awardId: awardId || null,
        title: inboxTitle,
        deadline,
      },
    });
    return res.status(201).json({ data: item });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: "Inbox item already exists for this record" });
    console.error("createInboxItem error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const getInboxItem = async (req, res) => {
  try {
    const item = await prisma.inboxItem.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true, award: true, contactLinks: true },
    });
    if (!item) return res.status(404).json({ error: "InboxItem not found" });
    return res.status(200).json({ data: item });
  } catch (error) {
    console.error("getInboxItem error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const updateInboxItem = async (req, res) => {
  try {
    const { reviewStatus, notes, deadline, title } = req.body;
    const data = {
      reviewedBy: req.user.name,
      reviewedAt: new Date(),
    };
    if (reviewStatus !== undefined) data.reviewStatus = reviewStatus;
    if (notes !== undefined) data.notes = notes;
    if (deadline !== undefined) data.deadline = deadline;
    if (title !== undefined) data.title = title;

    const item = await prisma.inboxItem.update({
      where: { id: req.params.id },
      data,
    });
    return res.status(200).json({ data: item });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "InboxItem not found" });
    console.error("updateInboxItem error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const deleteInboxItem = async (req, res) => {
  try {
    await prisma.inboxItem.delete({ where: { id: req.params.id } });
    return res.status(200).json({ data: { id: req.params.id } });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "InboxItem not found" });
    console.error("deleteInboxItem error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const bulkDeleteInboxItems = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: "ids must be a non-empty array" });
    const { count } = await prisma.inboxItem.deleteMany({ where: { id: { in: ids } } });
    return res.status(200).json({ count });
  } catch (error) {
    console.error("bulkDeleteInboxItems error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// --- Opportunity controllers ---

export const listOpportunities = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};
    if (req.query.active !== undefined) where.active = req.query.active === "true";
    if (req.query.naics) where.naicsCodes = { has: req.query.naics };
    if (req.query.psc) where.pscCode = { startsWith: req.query.psc, mode: "insensitive" };
    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search, mode: "insensitive" } },
        { description: { contains: req.query.search, mode: "insensitive" } },
      ];
    }
    if (req.query.favoritesOnly === "true") {
      where.favorites = { some: { userId: req.user.id } };
    }

    const validOppSortFields = ["title", "responseDeadline", "pscCode"];
    const oppSortBy = validOppSortFields.includes(req.query.sortBy) ? req.query.sortBy : null;
    const oppSortDir = req.query.sortDir === "asc" ? "asc" : "desc";
    const oppOrderBy = oppSortBy ? { [oppSortBy]: oppSortDir } : { postedDate: "desc" };

    const [total, items] = await Promise.all([
      prisma.opportunity.count({ where }),
      prisma.opportunity.findMany({
        where,
        orderBy: oppOrderBy,
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      meta: { total, page, limit, returned: items.length },
      data: items,
    });
  } catch (error) {
    console.error("listOpportunities error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const getOpportunity = async (req, res) => {
  try {
    const item = await prisma.opportunity.findUnique({
      where: { id: req.params.id },
      include: {
        buyingOrganization: true,
        inboxItems: true,
        contactLinks: {
          include: { contact: { select: { id: true } } },
        },
        attachments: {
          orderBy: { attachmentOrder: "asc" },
          select: {
            id: true,
            resourceId: true,
            name: true,
            mimeType: true,
            size: true,
            postedDate: true,
            attachmentOrder: true,
            downloadUrl: true,
            parsedAt: true,
          },
          where: { mimeType: { not: null } },
        },
      },
    });
    if (!item) return res.status(404).json({ error: "Opportunity not found" });
    return res.status(200).json({ data: item });
  } catch (error) {
    console.error("getOpportunity error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const deleteOpportunity = async (req, res) => {
  const { id } = req.params;
  try {
    // ContactLinks that have a secondary parent (buyingOrg, industryDay, inboxItem) alongside
    // the opportunity should not be fully deleted — just unlink from this opportunity.
    // ContactLinks that are purely tied to this opportunity will cascade-delete normally.
    await prisma.contactLink.updateMany({
      where: {
        opportunityId: id,
        OR: [
          { buyingOrganizationId: { not: null } },
          { industryDayId: { not: null } },
          { inboxItemId: { not: null } },
        ],
      },
      data: { opportunityId: null },
    });

    await prisma.opportunity.delete({ where: { id } });
    return res.status(200).json({ data: { id } });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "Opportunity not found" });
    console.error("deleteOpportunity error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// --- Award controllers ---

export const listAwards = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};
    if (req.query.naics) where.naicsCodes = { has: req.query.naics };
    if (req.query.psc) where.pscCode = { startsWith: req.query.psc, mode: "insensitive" };
    if (req.query.search) where.description = { contains: req.query.search, mode: "insensitive" };
    if (req.query.favoritesOnly === "true") {
      where.favorites = { some: { userId: req.user.id } };
    }

    const validAwardSortFields = ["obligatedAmount", "startDate", "endDate", "pscCode"];
    const awardSortBy = validAwardSortFields.includes(req.query.sortBy) ? req.query.sortBy : null; // get sort field from query if valid, else default to null
    const awardSortDir = req.query.sortDir === "asc" ? "asc" : "desc";
    const awardOrderBy = awardSortBy ? { [awardSortBy]: awardSortDir } : { startDate: "desc" };

    const [total, items] = await Promise.all([
      prisma.award.count({ where }),
      prisma.award.findMany({
        where,
        orderBy: awardOrderBy,
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      meta: { total, page, limit, returned: items.length },
      data: items,
    });
  } catch (error) {
    console.error("listAwards error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const getAward = async (req, res) => {
  try {
    const item = await prisma.award.findUnique({
      where: { id: req.params.id },
      include: { recipient: true, buyingOrganization: true, inboxItems: true },
    });
    if (!item) return res.status(404).json({ error: "Award not found" });
    return res.status(200).json({ data: item });
  } catch (error) {
    console.error("getAward error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const deleteAward = async (req, res) => {
  try {
    await prisma.award.delete({ where: { id: req.params.id } });
    return res.status(200).json({ data: { id: req.params.id } });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "Award not found" });
    console.error("deleteAward error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// --- IndustryDay controllers ---

export const listIndustryDays = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};
    if (req.query.status) where.status = req.query.status;

    const [total, items] = await Promise.all([
      prisma.industryDay.count({ where }),
      prisma.industryDay.findMany({
        where,
        orderBy: { eventDate: "asc" },
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      meta: { total, page, limit, returned: items.length },
      data: items,
    });
  } catch (error) {
    console.error("listIndustryDays error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const getIndustryDay = async (req, res) => {
  try {
    const item = await prisma.industryDay.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true, buyingOrganization: true, contactLinks: true },
    });
    if (!item) return res.status(404).json({ error: "IndustryDay not found" });
    return res.status(200).json({ data: item });
  } catch (error) {
    console.error("getIndustryDay error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const updateIndustryDay = async (req, res) => {
  try {
    const { status, summary } = req.body;
    const data = {};
    if (status !== undefined) data.status = status;
    if (summary !== undefined) data.summary = summary;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "No updatable fields provided" });

    const item = await prisma.industryDay.update({
      where: { id: req.params.id },
      data,
    });
    return res.status(200).json({ data: item });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "IndustryDay not found" });
    console.error("updateIndustryDay error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const listCalendarEvents = async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10); // 1-12
    const year = parseInt(req.query.year, 10);
    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json({ error: "Valid month (1-12) and year are required" });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const [inboxItems, industryDays] = await Promise.all([
      prisma.inboxItem.findMany({
        where: {
          deadline: { gte: start, lt: end },
          reviewStatus: { in: ["IN_REVIEW", "QUALIFIED", "CONTACTED"] },
        },
        select: { id: true, title: true, deadline: true },
      }),
      prisma.industryDay.findMany({
        where: {
          status: { in: ["ATTENDING", "ATTENDED"] },
          eventDate: { gte: start, lt: end },
        },
        select: { id: true, title: true, eventDate: true },
      }),
    ]);

    const events = [
      ...inboxItems.map((item) => ({
        id: item.id,
        title: item.title ?? "Untitled",
        date: item.deadline,
        type: "deadline",
        relatedId: item.id,
      })),
      ...industryDays.map((d) => ({
        id: d.id,
        title: d.title ?? "Untitled Industry Day",
        date: d.eventDate,
        type: "industry_day",
        relatedId: d.id,
      })),
    ];

    return res.status(200).json({ data: events });
  } catch (error) {
    console.error("listCalendarEvents error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// --- BuyingOrganization controllers ---

export const listBuyingOrgs = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};
    if (req.query.level) where.level = req.query.level;
    if (req.query.search) where.name = { contains: req.query.search, mode: "insensitive" };

    const validBuyingOrgSortFields = ["name"];
    const buyingOrgSortBy = validBuyingOrgSortFields.includes(req.query.sortBy) ? req.query.sortBy : null;
    const buyingOrgSortDir = req.query.sortDir === "asc" ? "asc" : "desc";
    const buyingOrgOrderBy = buyingOrgSortBy ? { [buyingOrgSortBy]: buyingOrgSortDir } : { name: "asc" };

    const [total, items] = await Promise.all([
      prisma.buyingOrganization.count({ where }),
      prisma.buyingOrganization.findMany({
        where,
        include: { children: true },
        orderBy: buyingOrgOrderBy,
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      meta: { total, page, limit, returned: items.length },
      data: items,
    });
  } catch (error) {
    console.error("listBuyingOrgs error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const getBuyingOrg = async (req, res) => {
  try {
    const item = await prisma.buyingOrganization.findUnique({
      where: { id: req.params.id },
      include: {
        children: true,
        opportunities: { take: 100, orderBy: { postedDate: "desc" } },
      },
    });
    if (!item) return res.status(404).json({ error: "BuyingOrganization not found" });
    return res.status(200).json({ data: item });
  } catch (error) {
    console.error("getBuyingOrg error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const updateBuyingOrg = async (req, res) => {
  try {
    const { website } = req.body;
    const data = {};
    if (website !== undefined) data.website = website?.trim() || null;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "No fields to update" });
    const item = await prisma.buyingOrganization.update({ where: { id: req.params.id }, data });
    return res.status(200).json({ data: item });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "BuyingOrganization not found" });
    console.error("updateBuyingOrg error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// --- Recipient controllers ---

export const listRecipients = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search, mode: "insensitive" } },
        { uei: { contains: req.query.search, mode: "insensitive" } },
      ];
    }
    const validRecipientSortFields = ["name"];
    const recipientSortBy = validRecipientSortFields.includes(req.query.sortBy) ? req.query.sortBy : null;
    const recipientSortDir = req.query.sortDir === "asc" ? "asc" : "desc";
    const recipientOrderBy = recipientSortBy ? { [recipientSortBy]: recipientSortDir } : { name: "asc" };

    const [total, items] = await Promise.all([
      prisma.recipient.count({ where }),
      prisma.recipient.findMany({
        where,
        orderBy: recipientOrderBy,
        skip,
        take: limit,
      }),
    ]);
    return res.status(200).json({ meta: { total, page, limit, returned: items.length }, data: items });
  } catch (error) {
    console.error("listRecipients error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const getRecipient = async (req, res) => {
  try {
    const item = await prisma.recipient.findUnique({
      where: { id: req.params.id },
      include: {
        awards: { take: 100, orderBy: { startDate: "desc" } },
      },
    });
    if (!item) return res.status(404).json({ error: "Recipient not found" });
    return res.status(200).json({ data: item });
  } catch (error) {
    console.error("getRecipient error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const updateRecipient = async (req, res) => {
  try {
    const { website } = req.body;
    const data = {};
    if (website !== undefined) data.website = website?.trim() || null;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "No fields to update" });
    const item = await prisma.recipient.update({ where: { id: req.params.id }, data });
    return res.status(200).json({ data: item });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "Recipient not found" });
    console.error("updateRecipient error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// --- Contact controllers ---

export const listContacts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};
    if (req.query.search) {
      where.OR = [
        { fullName: { contains: req.query.search, mode: "insensitive" } },
        { email: { contains: req.query.search, mode: "insensitive" } },
      ];
    }
    const validContactSortFields = ["fullName", "email", "title"];
    const contactSortBy = validContactSortFields.includes(req.query.sortBy) ? req.query.sortBy : null;
    const contactSortDir = req.query.sortDir === "asc" ? "asc" : "desc";
    const contactOrderBy = contactSortBy ? { [contactSortBy]: contactSortDir } : { fullName: "asc" };

    const [total, items] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        orderBy: contactOrderBy,
        skip,
        take: limit,
        include: {
          _count: { select: { links: { where: { opportunityId: { not: null } } } } },
          links: {
            where: { buyingOrganizationId: { not: null } },
            take: 1,
            include: { buyingOrganization: { select: { id: true, name: true } } },
          },
        },
      }),
    ]);
    return res.status(200).json({ meta: { total, page, limit, returned: items.length }, data: items });
  } catch (error) {
    console.error("listContacts error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const getContact = async (req, res) => {
  try {
    const item = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        links: {
          include: {
            opportunity: { select: { id: true, title: true } },
            industryDay: { select: { id: true, title: true } },
            buyingOrganization: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!item) return res.status(404).json({ error: "Contact not found" });
    return res.status(200).json({ data: item });
  } catch (error) {
    console.error("getContact error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const updateContact = async (req, res) => {
  try {
    const { phone, title } = req.body;
    const data = {};
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (title !== undefined) data.title = title?.trim() || null;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "No fields to update" });
    const item = await prisma.contact.update({ where: { id: req.params.id }, data });
    return res.status(200).json({ data: item });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "Contact not found" });
    console.error("updateContact error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const deleteContact = async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: { links: { where: { opportunityId: { not: null } }, select: { id: true }, take: 1 } },
    });
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    if (contact.links.length > 0) {
      return res.status(409).json({ error: "Cannot delete a contact that is linked to an opportunity" });
    }
    await prisma.contact.delete({ where: { id: req.params.id } });
    return res.status(200).json({ data: { id: req.params.id } });
  } catch (error) {
    console.error("deleteContact error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// --- Favorite controllers ---

export const listFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const [opportunities, awards] = await Promise.all([
      prisma.opportunity.findMany({
        where: { favorites: { some: { userId } } },
        orderBy: { postedDate: "desc" },
        select: { id: true, title: true, pscCode: true, naicsCodes: true, responseDeadline: true, type: true, active: true },
      }),
      prisma.award.findMany({
        where: { favorites: { some: { userId } } },
        orderBy: { startDate: "desc" },
        select: { id: true, description: true, obligatedAmount: true, pscCode: true, naicsCodes: true, startDate: true, endDate: true },
      }),
    ]);
    return res.status(200).json({ opportunities, awards });
  } catch (error) {
    console.error("listFavorites error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// --- FLIS Item controllers ---

export const listFLISItems = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};
    if (req.query.search) {
      where.OR = [
        { itemName: { contains: req.query.search, mode: "insensitive" } },
        { commonName: { contains: req.query.search, mode: "insensitive" } },
        { characteristics: { contains: req.query.search, mode: "insensitive" } },
      ];
    }
    if (req.query.supplyTigerOnly === "true") {
      where.pscClass = { isSupplyTigerPsc: true };
    }

    const validFLISSortFields = ["itemName", "pscCode"];
    const FLISSortBy = validFLISSortFields.includes(req.query.sortBy) ? req.query.sortBy : null;
    const FLISSortDir = req.query.sortDir === "asc" ? "asc" : "desc";
    const FLISOrderBy = FLISSortBy ? { [FLISSortBy]: FLISSortDir } : { itemName: "asc" };

    const [total, items] = await Promise.all([
      prisma.federalLogisticsInformationSystem.count({ where }),
      prisma.federalLogisticsInformationSystem.findMany({
        where,
        orderBy: FLISOrderBy,
        skip,
        take: limit,
        include: {
          pscClass: { select: { title: true, isSupplyTigerPsc: true } },
        },
      }),
    ]);

    return res.status(200).json({
      meta: { total, page, limit, returned: items.length },
      data: items,
    });
  } catch (error) {
    console.error("listFLISItems error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const getFLISItem = async (req, res) => {
  try {
    const item = await prisma.federalLogisticsInformationSystem.findUnique({
      where: { id: req.params.id },
      include: {
        pscClass: { select: { title: true, isSupplyTigerPsc: true } },
      },
    });
    if (!item) return res.status(404).json({ error: "FLIS item not found" });
    return res.status(200).json({ data: item });
  } catch (error) {
    console.error("getFLISItem error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const toggleFavorite = async (req, res) => {
  try {
    const { entityType, entityId } = req.body;
    if (!entityType || !entityId) {
      return res.status(400).json({ error: "entityType and entityId are required" });
    }
    if (!["opportunity", "award"].includes(entityType)) {
      return res.status(400).json({ error: "entityType must be 'opportunity' or 'award'" });
    }

    const userId = req.user.id;
    const where = entityType === "opportunity"
      ? { userId, opportunityId: entityId }
      : { userId, awardId: entityId };

    const { count } = await prisma.favorite.deleteMany({ where });
    if (count > 0) return res.status(200).json({ favorited: false });

    try {
      await prisma.favorite.create({
        data: {
          userId,
          opportunityId: entityType === "opportunity" ? entityId : null,
          awardId: entityType === "award" ? entityId : null,
        },
      });
      return res.status(201).json({ favorited: true });
    } catch (createError) {
      // Concurrent request already created the favorite — treat as success
      if (createError?.code === "P2002") return res.status(200).json({ favorited: true });
      throw createError;
    }
  } catch (error) {
    console.error("toggleFavorite error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// ---------- Attachment parsing (Step Two) ----------

// Preview only — downloads, extracts, returns text but does NOT save to DB
// Uses 10MB cap for HTTP route (background job uses 5MB via parseAttachmentContent utility)
export const parseAttachment = async (req, res) => {
  try {
    const attachment = await prisma.opportunityAttachment.findUnique({
      where: { id: req.params.id },
    });
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    // HTTP route enforces 10MB cap; parseAttachmentContent enforces 5MB for background jobs
    const ext = resolveFileExtension(attachment);
    if (!SUPPORTED_PARSE_TYPES.includes(ext)) {
      return res.status(400).json({
        error: `Unsupported format: ${ext || "unknown"}. Supported: PDF, DOCX`,
      });
    }

    if (attachment.size && attachment.size > MAX_PARSE_SIZE) {
      return res.status(400).json({
        error: `File too large (${(attachment.size / 1024 / 1024).toFixed(1)}MB). Max: 10MB`,
      });
    }

    const result = await parseAttachmentContent(attachment);

    if (result.skip) {
      // Map utility errors back to HTTP responses
      if (result.error?.startsWith("Unsupported")) return res.status(400).json({ error: result.error });
      if (result.error?.startsWith("File too large")) return res.status(400).json({ error: result.error });
      if (result.error?.startsWith("SAM.gov download failed")) return res.status(502).json({ error: result.error });
      if (result.error?.includes("No text extracted")) return res.status(422).json({ error: "No text could be extracted from this file (may be scanned/image-based)" });
      return res.status(500).json({ error: result.error });
    }

    return res.status(200).json({ parsedText: result.parsedText });
  } catch (error) {
    console.error("parseAttachment error:", error);
    return res.status(500).json({
      error: "Failed to parse attachment",
      details: error.message,
    });
  }
};

// Save reviewed text to DB with timestamp. This is a separate step to allow for manual review/editing before saving.
export const saveParsedAttachment = async (req, res) => {
  try {
    const { parsedText } = req.body;
    if (!parsedText || typeof parsedText !== "string") {
      return res.status(400).json({ error: "parsedText is required" });
    }

    const attachment = await prisma.opportunityAttachment.findUnique({
      where: { id: req.params.id },
      select: { id: true, opportunityId: true },
    });
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const parsedAt = new Date();
    await prisma.opportunityAttachment.update({
      where: { id: attachment.id },
      data: { parsedText, parsedAt },
    });

    await emitInternalEventSafe("internal/attachment.parsed", {
      attachmentId: attachment.id,
      opportunityId: attachment.opportunityId,
    });

    return res.status(200).json({ parsedAt });
  } catch (error) {
    console.error("saveParsedAttachment error:", error);
    return res.status(500).json({ error: "Failed to save parsed text" });
  }
};

export const getAttachmentText = async (req, res) => {
  try {
    const attachment = await prisma.opportunityAttachment.findUnique({
      where: { id: req.params.id },
      select: { parsedText: true, parsedAt: true },
    });
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    return res.status(200).json(attachment);
  } catch (error) {
    console.error("getAttachmentText error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteParsedAttachment = async (req, res) => {
  try {
    const attachment = await prisma.opportunityAttachment.findUnique({
      where: { id: req.params.id },
      select: { id: true, parsedAt: true },
    });
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });
    if (!attachment.parsedAt) return res.status(400).json({ error: "Attachment has no parsed text to delete" });

    await prisma.opportunityAttachment.update({
      where: { id: attachment.id },
      data: { parsedText: null, parsedAt: null },
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("deleteParsedAttachment error:", error);
    return res.status(500).json({ error: "Failed to delete parsed text" });
  }
};

/**
 * Score a single parsed attachment: run opportunity scoring and persist the result.
 * Updates scoreResult + scoredAt on the attachment. Non-destructive to InboxItems.
 */
export async function scoreAttachment(attachmentId, opportunityId) {
  const scoreResult = await scoreOpportunity(opportunityId);
  await prisma.opportunityAttachment.update({
    where: { id: attachmentId },
    data: {
      scoreResult,
      scoredAt: new Date(),
    },
  });
  return scoreResult;
}

/**
 * Batch-score all parsed attachments that have not yet been scored.
 * Safe to re-run — skips attachments already having a scoredAt value.
 */
export async function runScoreAllParsedAttachments() {
  const attachments = await prisma.opportunityAttachment.findMany({
    where: { parsedText: { not: null }, scoredAt: null },
    select: { id: true, opportunityId: true },
  });

  let scored = 0;
  let failed = 0;
  const errors = [];

  for (const attachment of attachments) {
    try {
      await scoreAttachment(attachment.id, attachment.opportunityId);
      scored++;
    } catch (err) {
      failed++;
      errors.push({ attachmentId: attachment.id, error: err.message });
      console.error(`[scoreAttachments] Failed to score attachment ${attachment.id}:`, err.message);
    }
  }

  return { results: { scored, failed }, errors };
}

// ---------------------------------------------------------------------------
// CSV Export Controllers
// ---------------------------------------------------------------------------

export const exportOpportunities = async (req, res) => {
  try {
    const where = {};
    if (req.query.active !== undefined) where.active = req.query.active === "true";
    if (req.query.naics) where.naicsCodes = { has: req.query.naics };
    if (req.query.psc) where.pscCode = { startsWith: req.query.psc, mode: "insensitive" };
    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search, mode: "insensitive" } },
        { description: { contains: req.query.search, mode: "insensitive" } },
      ];
    }
    if (req.query.favoritesOnly === "true") {
      where.favorites = { some: { userId: req.user.id } };
    }

    const items = await prisma.opportunity.findMany({
      where,
      orderBy: { postedDate: "desc" },
    });

    const headers = ["Solicitation Number", "Title", "PSC", "NAICS", "Deadline", "Set Aside", "Type", "State", "Active"];
    const rows = items.map((r) => [
      r.solicitationNumber,
      r.title,
      r.pscCode,
      r.naicsCodes?.join(", "),
      fmtDate(r.responseDeadline),
      r.setAside,
      r.type,
      r.state,
      r.active ? "Yes" : "No",
    ]);
    writeCsv(res, "opportunities-export.csv", headers, rows);
  } catch (error) {
    console.error("exportOpportunities error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const exportAwards = async (req, res) => {
  try {
    const where = {};
    if (req.query.naics) where.naicsCodes = { has: req.query.naics };
    if (req.query.psc) where.pscCode = { startsWith: req.query.psc, mode: "insensitive" };
    if (req.query.search) where.description = { contains: req.query.search, mode: "insensitive" };
    if (req.query.favoritesOnly === "true") {
      where.favorites = { some: { userId: req.user.id } };
    }

    const items = await prisma.award.findMany({
      where,
      orderBy: { startDate: "desc" },
    });

    const headers = ["Award ID", "Description", "Obligated Amount", "PSC", "NAICS", "Start Date", "End Date"];
    const rows = items.map((r) => [
      r.externalId ? r.externalId.split("_")[2] : "",
      r.description,
      fmtCurrency(r.obligatedAmount),
      r.pscCode,
      r.naicsCodes?.join(", "),
      fmtDate(r.startDate),
      fmtDate(r.endDate),
    ]);
    writeCsv(res, "awards-export.csv", headers, rows);
  } catch (error) {
    console.error("exportAwards error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const exportContacts = async (req, res) => {
  try {
    const where = {};
    if (req.query.search) {
      where.OR = [
        { fullName: { contains: req.query.search, mode: "insensitive" } },
        { email: { contains: req.query.search, mode: "insensitive" } },
      ];
    }

    const items = await prisma.contact.findMany({
      where,
      orderBy: { fullName: "asc" },
      include: {
        links: {
          where: { buyingOrganizationId: { not: null } },
          take: 1,
          include: { buyingOrganization: { select: { name: true } } },
        },
      },
    });

    const headers = ["Name", "Email", "Phone", "Buying Agency", "Title"];
    const rows = items.map((r) => [
      r.fullName,
      r.email,
      r.phone,
      r.links?.[0]?.buyingOrganization?.name,
      r.title,
    ]);
    writeCsv(res, "contacts-export.csv", headers, rows);
  } catch (error) {
    console.error("exportContacts error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const exportInboxItems = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.reviewStatus = req.query.status;
    if (req.query.title) where.opportunity = { title: { contains: req.query.title, mode: "insensitive" } };

    const items = await prisma.inboxItem.findMany({
      where,
      include: { opportunity: true, award: true },
      orderBy: { createdAt: "desc" },
    });

    const headers = ["Title", "Type", "Review Status", "Acquisition Path", "Created"];
    const rows = items.map((r) => [
      r.title,
      r.type,
      r.reviewStatus,
      r.acquisitionPath,
      fmtDate(r.createdAt),
    ]);
    writeCsv(res, "inbox-items-export.csv", headers, rows);
  } catch (error) {
    console.error("exportInboxItems error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};
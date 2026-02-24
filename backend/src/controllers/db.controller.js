import prisma from "../config/db.js";
import { ENV } from "../config/env.js";
import { UserRole, IndustryDayStatus } from "@prisma/client";
import {fetchOpportunityDescriptionFromSam} from "./sam.controller.js";
import { stripHTML } from "../utils/extractSAM.js";

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
    return prisma.user.update({
      where: { clerkId },
      data: {
        email,
        name,
        imageUrl,
        role,
      },
    });
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkId,
        email,
        name,
        imageUrl,
        role,
      },
    });
  }

  return prisma.user.create({
    data: {
      clerkId,
      email,
      name,
      imageUrl,
      role,
    },
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

    const role = ENV.ADMIN_EMAILS.includes(email.toLowerCase())
      ? UserRole.ADMIN
      : UserRole.USER;

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

    const role = ENV.ADMIN_EMAILS.includes(email.toLowerCase())
      ? UserRole.ADMIN
      : UserRole.USER;

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

    const [total, items] = await Promise.all([
      prisma.inboxItem.count({ where }),
      prisma.inboxItem.findMany({
        where,
        include: { opportunity: true, award: true, industryDay: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return res.json({
      meta: { total, page, limit, returned: items.length },
      data: items,
    });
  } catch (error) {
    console.error("listInboxItems error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const getInboxItem = async (req, res) => {
  try {
    const item = await prisma.inboxItem.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true, award: true, industryDay: true, contactLinks: true },
    });
    if (!item) return res.status(404).json({ error: "InboxItem not found" });
    return res.json({ data: item });
  } catch (error) {
    console.error("getInboxItem error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const updateInboxItem = async (req, res) => {
  try {
    const { reviewStatus, notes } = req.body;
    const data = {
      reviewedBy: req.user.name,
      reviewedAt: new Date(),
    };
    if (reviewStatus !== undefined) data.reviewStatus = reviewStatus;
    if (notes !== undefined) data.notes = notes;

    const item = await prisma.inboxItem.update({
      where: { id: req.params.id },
      data,
    });
    return res.json({ data: item });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "InboxItem not found" });
    console.error("updateInboxItem error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const deleteInboxItem = async (req, res) => {
  try {
    await prisma.inboxItem.delete({ where: { id: req.params.id } });
    return res.json({ data: { id: req.params.id } });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "InboxItem not found" });
    console.error("deleteInboxItem error:", error);
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

    const [total, items] = await Promise.all([
      prisma.opportunity.count({ where }),
      prisma.opportunity.findMany({
        where,
        orderBy: { postedDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return res.json({
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
      },
    });
    if (!item) return res.status(404).json({ error: "Opportunity not found" });
    return res.json({ data: item });
  } catch (error) {
    console.error("getOpportunity error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// --- Award controllers ---

export const listAwards = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [total, items] = await Promise.all([
      prisma.award.count(),
      prisma.award.findMany({
        orderBy: { startDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return res.json({
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
    return res.json({ data: item });
  } catch (error) {
    console.error("getAward error:", error);
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

    return res.json({
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
    return res.json({ data: item });
  } catch (error) {
    console.error("getIndustryDay error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const updateIndustryDay = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status is required" });

    const item = await prisma.industryDay.update({
      where: { id: req.params.id },
      data: { status },
    });
    return res.json({ data: item });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: "IndustryDay not found" });
    console.error("updateIndustryDay error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// --- BuyingOrganization controllers ---

export const listBuyingOrgs = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = {};
    if (req.query.level) where.level = req.query.level;

    const [total, items] = await Promise.all([
      prisma.buyingOrganization.count({ where }),
      prisma.buyingOrganization.findMany({
        where,
        include: { children: true },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
    ]);

    return res.json({
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
        opportunities: { take: 20, orderBy: { postedDate: "desc" } },
      },
    });
    if (!item) return res.status(404).json({ error: "BuyingOrganization not found" });
    return res.json({ data: item });
  } catch (error) {
    console.error("getBuyingOrg error:", error);
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
    const [total, items] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        orderBy: { fullName: "asc" },
        skip,
        take: limit,
        include: {
          links: {
            where: { buyingOrganizationId: { not: null } },
            take: 1,
            include: { buyingOrganization: { select: { id: true, name: true } } },
          },
        },
      }),
    ]);
    return res.json({ meta: { total, page, limit, returned: items.length }, data: items });
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
    return res.json({ data: item });
  } catch (error) {
    console.error("getContact error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};
import prisma from "../config/db.js";
import { buildInboxTitle } from "../utils/inboxText.js";
import { AcquisitionPath } from "@prisma/client";

const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const listScoringQueue = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const where = { status: "PENDING" };

    const validSortFields = ["score", "createdAt", "expiresAt"];
    const sortBy = validSortFields.includes(req.query.sortBy) ? req.query.sortBy : null;
    const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
    const orderBy = sortBy ? { [sortBy]: sortDir } : { createdAt: "desc" };

    const [total, items] = await Promise.all([
      prisma.scoringQueue.count({ where }),
      prisma.scoringQueue.findMany({
        where,
        include: { opportunity: true },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      meta: { total, page, limit, returned: items.length },
      data: items,
    });
  } catch (error) {
    console.error("listScoringQueue error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const approveScoringQueueItem = async (req, res) => {
  try {
    const queueItem = await prisma.scoringQueue.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true },
    });

    if (!queueItem) return res.status(404).json({ error: "ScoringQueue item not found" });
    if (queueItem.status !== "PENDING") {
      return res.status(409).json({ error: `Item is already ${queueItem.status.toLowerCase()}` });
    }

    const opp = queueItem.opportunity;
    const inboxTitle = buildInboxTitle({
      entityLabel: "Opportunity",
      naicsCodes: opp?.naicsCodes,
      pscCode: opp?.pscCode,
      text: opp?.title ?? null,
      maxLen: 160,
    });

    const [inboxItem] = await prisma.$transaction([
      prisma.inboxItem.create({
        data: {
          source: "SAM",
          acquisitionPath: AcquisitionPath.OPEN_MARKET,
          type: opp?.type ?? "OTHER",
          tag: opp?.tag ?? "GENERAL",
          title: inboxTitle,
          deadline: opp?.responseDeadline ?? null,
          opportunityId: opp.id,
          buyingOrganizationId: opp?.buyingOrganizationId ?? null,
          attachmentScore: queueItem.score,
          matchedSignals: queueItem.matchedSignals,
        },
      }),
      prisma.scoringQueue.update({
        where: { id: req.params.id },
        data: {
          status: "APPROVED",
          reviewedBy: req.user?.name ?? null,
          reviewedAt: new Date(),
        },
      }),
    ]);

    return res.status(200).json({ data: inboxItem });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: "Inbox item already exists for this opportunity" });
    console.error("approveScoringQueueItem error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const dismissScoringQueueItem = async (req, res) => {
  try {
    const queueItem = await prisma.scoringQueue.findUnique({
      where: { id: req.params.id },
    });

    if (!queueItem) return res.status(404).json({ error: "ScoringQueue item not found" });
    if (queueItem.status !== "PENDING") {
      return res.status(409).json({ error: `Item is already ${queueItem.status.toLowerCase()}` });
    }

    const updated = await prisma.scoringQueue.update({
      where: { id: req.params.id },
      data: {
        status: "DISMISSED",
        reviewedBy: req.user?.name ?? null,
        reviewedAt: new Date(),
      },
    });

    return res.status(200).json({ data: updated });
  } catch (error) {
    console.error("dismissScoringQueueItem error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

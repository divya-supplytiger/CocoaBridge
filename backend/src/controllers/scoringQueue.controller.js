import prisma from "../config/db.js";
import { buildInboxTitle } from "../utils/inboxText.js";
import { loadFilterConfig } from "../utils/filterConfig.js";
import { scoreOpportunityMetadata } from "../utils/inboxScoring.js";
import { AcquisitionPath } from "@prisma/client";

const MANUAL_SIGNAL_POINTS = {
  NSN_MATCH: 5,
  ITEM_NAME: 3,
  COMMON_NAME: 2,
  PSC_IN_TEXT: 1,
  KEYWORD: 2,
};

function getRouting(score) {
  if (score >= 8) return "AUTO_ADMIT";
  if (score >= 4) return "QUEUE";
  return "BELOW_THRESHOLD";
}

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

export const previewManualScore = async (req, res) => {
  try {
    const opp = await prisma.opportunity.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        naicsCodes: true,
        pscCode: true,
        responseDeadline: true,
        buyingOrganizationId: true,
        title: true,
        description: true,
      },
    });
    if (!opp) return res.status(404).json({ error: "Opportunity not found" });

    const filterConfig = await loadFilterConfig(prisma);
    const { score, matchedSignals } = await scoreOpportunityMetadata(opp, filterConfig);

    return res.status(200).json({ metadataScore: score, metadataSignals: matchedSignals });
  } catch (error) {
    console.error("previewManualScore error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const submitManualScore = async (req, res) => {
  try {
    const { signals = [] } = req.body;
    if (!Array.isArray(signals)) {
      return res.status(400).json({ error: "signals must be an array" });
    }

    const opp = await prisma.opportunity.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        naicsCodes: true,
        pscCode: true,
        responseDeadline: true,
        buyingOrganizationId: true,
        title: true,
        description: true,
        type: true,
        tag: true,
        active: true,
      },
    });
    if (!opp) return res.status(404).json({ error: "Opportunity not found" });
    if (!opp.active) return res.status(409).json({ error: "Opportunity is inactive" });

    const filterConfig = await loadFilterConfig(prisma);
    const { score: metaScore, matchedSignals: metaSignals } = await scoreOpportunityMetadata(opp, filterConfig);

    // Validate NSN_MATCH signals against FLIS
    const nsnSignals = signals.filter(s => s.type === "NSN_MATCH");
    const otherSignals = signals.filter(s => s.type !== "NSN_MATCH");
    const rejectedNsns = [];
    const validNsnSignals = [];

    if (nsnSignals.length > 0) {
      const nsnValues = nsnSignals.map(s => s.value);
      const flisMatches = await prisma.federalLogisticsInformationSystem.findMany({
        where: { nsn: { in: nsnValues } },
        select: { nsn: true },
      });
      const validNsnSet = new Set(flisMatches.map(f => f.nsn));
      for (const s of nsnSignals) {
        if (validNsnSet.has(s.value)) {
          validNsnSignals.push(s);
        } else {
          rejectedNsns.push(s.value);
        }
      }
    }

    // Build manual signals with source tag and apply point caps
    const manualSignals = [];
    let manualScore = 0;
    let itemNameAdded = false;
    let commonNameAdded = false;

    for (const s of [...validNsnSignals, ...otherSignals]) {
      const type = s.type;
      if (!MANUAL_SIGNAL_POINTS[type]) continue;
      if (type === "ITEM_NAME" && itemNameAdded) continue;
      if (type === "COMMON_NAME" && commonNameAdded) continue;

      manualScore += MANUAL_SIGNAL_POINTS[type];
      manualSignals.push({ type, value: s.value ?? null, source: "manual" });

      if (type === "ITEM_NAME") itemNameAdded = true;
      if (type === "COMMON_NAME") commonNameAdded = true;
    }

    const score = metaScore + manualScore;
    const matchedSignals = [...metaSignals, ...manualSignals];
    const routing = getRouting(score);

    // Write to DB based on routing
    let inboxItemId = null;
    let scoringQueueId = null;

    if (routing === "AUTO_ADMIT") {
      const inboxTitle = buildInboxTitle({
        entityLabel: "Opportunity",
        naicsCodes: opp.naicsCodes,
        pscCode: opp.pscCode,
        text: opp.title ?? null,
        maxLen: 160,
      });
      const item = await prisma.inboxItem.upsert({
        where: { source_opportunityId: { source: "SAM", opportunityId: opp.id } },
        create: {
          source: "SAM",
          acquisitionPath: AcquisitionPath.OPEN_MARKET,
          type: opp.type ?? "OTHER",
          tag: opp.tag ?? "GENERAL",
          title: inboxTitle,
          deadline: opp.responseDeadline ?? null,
          opportunityId: opp.id,
          buyingOrganizationId: opp.buyingOrganizationId ?? null,
          attachmentScore: score,
          matchedSignals,
        },
        update: {
          attachmentScore: score,
          matchedSignals,
        },
      });
      inboxItemId = item.id;
    } else if (routing === "QUEUE") {
      const createdAt = new Date();
      const fourteenDaysOut = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      const expiresAt = opp.responseDeadline
        ? new Date(Math.min(fourteenDaysOut.getTime(), new Date(opp.responseDeadline).getTime()))
        : fourteenDaysOut;

      const entry = await prisma.scoringQueue.upsert({
        where: { opportunityId: opp.id },
        create: { opportunityId: opp.id, score, matchedSignals, expiresAt },
        update: { score, matchedSignals, expiresAt },
      });
      scoringQueueId = entry.id;
    }

    return res.status(200).json({ score, routing, matchedSignals, rejectedNsns, inboxItemId, scoringQueueId });
  } catch (error) {
    console.error("submitManualScore error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

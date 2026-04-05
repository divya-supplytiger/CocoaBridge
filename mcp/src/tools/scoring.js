import { z } from "zod";
import prisma from "../db.js";
import { COMPANY_NAICS_CODES, COMPANY_PSC_CODES } from "../resources/companyProfile.js";

/**
 * Load the active filter config from AppConfig table.
 * These are the NAICS prefixes, PSC prefixes, and keyword lists
 * that the backend uses for SAM.gov opportunity filtering.
 */
async function loadFilterConfig() {
  const [naicsCodes, pscPrefixes, solicitationKeywords, industryDayKeywords] =
    await Promise.all([
      prisma.appConfig.findUnique({ where: { key: "naicsCodes" } }),
      prisma.appConfig.findUnique({ where: { key: "pscPrefixes" } }),
      prisma.appConfig.findUnique({ where: { key: "solicitationKeywords" } }),
      prisma.appConfig.findUnique({ where: { key: "industryDayKeywords" } }),
    ]);

  return {
    naicsCodes: naicsCodes?.values ?? COMPANY_NAICS_CODES,
    pscPrefixes: pscPrefixes?.values ?? COMPANY_PSC_CODES,
    solicitationKeywords: solicitationKeywords?.values ?? [],
    industryDayKeywords: industryDayKeywords?.values ?? [],
  };
}

/** Check if a code starts with any of the given prefixes */
function startsWithAny(code, prefixes) {
  if (!code) return false;
  return prefixes.some((prefix) => code.startsWith(prefix));
}

/** Check if text contains any of the keywords (case-insensitive) */
function textMatchesKeywords(text, keywords) {
  if (!text || keywords.length === 0) return { match: false, matched: [] };
  const lower = text.toLowerCase();
  const matched = keywords.filter((kw) => lower.includes(kw.toLowerCase()));
  return { match: matched.length > 0, matched };
}

/** Map opportunity types to acquisition path fit */
function getAcquisitionPathFit(type) {
  switch (type) {
    case "SOLICITATION":
    case "PRE_SOLICITATION":
    case "SOURCES_SOUGHT":
      return "GSA";
    case "AWARD_NOTICE":
      return "SUBCONTRACTING";
    case "SPECIAL_NOTICE":
      return null;
    default:
      return null;
  }
}

function computeOverallScore(dimensions) {
  let score = 0;
  if (dimensions.naicsMatch) score += 3;
  if (dimensions.pscMatch) score += 2;
  if (dimensions.keywordMatch) score += 2;
  if (dimensions.acquisitionPathFit) score += 1;
  if (dimensions.agencyHasHistory) score += 2;
  if (dimensions.daysUntilDeadline !== null && dimensions.daysUntilDeadline < 7) score -= 1;
  if (dimensions.daysUntilDeadline !== null && dimensions.daysUntilDeadline >= 14) score += 1;

  if (score >= 7) return "HIGH";
  if (score >= 4) return "MEDIUM";
  return "LOW";
}

function buildReasoning(dimensions, overallScore) {
  const parts = [];

  if (dimensions.naicsMatch) {
    parts.push("NAICS codes match company filter list");
  } else {
    parts.push("NAICS codes do not match company filters");
  }

  if (dimensions.pscMatch) {
    parts.push("PSC code aligns with company PSC prefixes");
  } else {
    parts.push("PSC code does not match company PSC prefixes");
  }

  if (dimensions.keywordMatch) {
    parts.push(`title/description matches keywords: ${dimensions.matchedKeywords.join(", ")}`);
  } else {
    parts.push("no solicitation/industry day keyword match in title or description");
  }

  if (dimensions.acquisitionPathFit) {
    parts.push(`acquisition path fits via ${dimensions.acquisitionPathFit}`);
  } else {
    parts.push("no clear acquisition path fit");
  }

  if (dimensions.agencyHasHistory) {
    parts.push("buying agency has prior award history in relevant NAICS/PSC");
  } else {
    parts.push("no prior award history found with this agency in relevant codes");
  }

  if (dimensions.daysUntilDeadline === null) {
    parts.push("no response deadline set");
  } else if (dimensions.daysUntilDeadline < 0) {
    parts.push("response deadline has passed");
  } else if (dimensions.daysUntilDeadline < 7) {
    parts.push(`only ${dimensions.daysUntilDeadline} days until deadline — tight timeline`);
  } else {
    parts.push(`${dimensions.daysUntilDeadline} days until deadline`);
  }

  return `${overallScore} fit: ${parts.join("; ")}.`;
}

export function registerScoreOpportunity(server) {
  server.registerTool(
    "score_opportunity",
    {
      title: "Score Opportunity",
      description:
        "Score a procurement opportunity against SupplyTiger's company profile and active filter config (NAICS codes, PSC prefixes, solicitation/industry day keywords, acquisition paths, agency award history, response deadline). Returns a structured HIGH/MEDIUM/LOW fit assessment.",
      inputSchema: {
        id: z.string().describe("Opportunity ID to score"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        // Load opportunity and filter config in parallel
        const [opportunity, filterConfig] = await Promise.all([
          prisma.opportunity.findUnique({
            where: { id },
            select: {
              id: true,
              title: true,
              description: true,
              type: true,
              naicsCodes: true,
              pscCode: true,
              responseDeadline: true,
              buyingOrganizationId: true,
            },
          }),
          loadFilterConfig(),
        ]);

        if (!opportunity) {
          return {
            content: [{ type: "text", text: `No opportunity found with id "${id}"` }],
            isError: true,
          };
        }

        // 1. NAICS match — check against DB filter config prefixes
        const naicsMatch =
          opportunity.naicsCodes.length > 0 &&
          opportunity.naicsCodes.some((code) => startsWithAny(code, filterConfig.naicsCodes));

        // 2. PSC match — check against DB filter config prefixes
        const pscMatch = startsWithAny(opportunity.pscCode, filterConfig.pscPrefixes);

        // 3. Keyword relevance — check title + description against solicitation and industry day keywords
        const allKeywords = [
          ...filterConfig.solicitationKeywords,
          ...filterConfig.industryDayKeywords,
        ];
        const titleResult = textMatchesKeywords(opportunity.title, allKeywords);
        const descResult = textMatchesKeywords(opportunity.description, allKeywords);
        const matchedKeywords = [...new Set([...titleResult.matched, ...descResult.matched])];
        const keywordMatch = matchedKeywords.length > 0;

        // 4. Acquisition path fit
        const acquisitionPathFit = getAcquisitionPathFit(opportunity.type);

        // 5. Agency history — check if buying org has awarded in our NAICS or PSC
        let agencyHasHistory = false;
        if (opportunity.buyingOrganizationId) {
          const historyCount = await prisma.award.count({
            where: {
              buyingOrganizationId: opportunity.buyingOrganizationId,
              OR: [
                { naicsCodes: { hasSome: COMPANY_NAICS_CODES } },
                { pscCode: { in: COMPANY_PSC_CODES } },
              ],
            },
          });
          agencyHasHistory = historyCount > 0;
        }

        // 6. Response deadline window
        let daysUntilDeadline = null;
        if (opportunity.responseDeadline) {
          const now = new Date();
          const deadline = new Date(opportunity.responseDeadline);
          daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        }

        const dimensions = {
          naicsMatch,
          pscMatch,
          keywordMatch,
          matchedKeywords,
          acquisitionPathFit,
          agencyHasHistory,
          daysUntilDeadline,
        };

        const overallScore = computeOverallScore(dimensions);
        const reasoning = buildReasoning(dimensions, overallScore);

        // Inbox/queue status lookup (parallel, non-blocking)
        const [inboxItem, queueEntry] = await Promise.all([
          prisma.inboxItem.findFirst({
            where: { opportunityId: id },
            select: { id: true, reviewStatus: true, attachmentScore: true },
          }),
          prisma.scoringQueue.findFirst({
            where: { opportunityId: id, status: "PENDING" },
            select: { id: true, score: true, expiresAt: true },
          }),
        ]);

        const inboxStatus = {
          inInbox: !!inboxItem,
          inQueue: !!queueEntry,
          ...(inboxItem && {
            reviewStatus: inboxItem.reviewStatus,
            attachmentScore: inboxItem.attachmentScore,
          }),
          ...(queueEntry && {
            queueScore: queueEntry.score,
            expiresAt: queueEntry.expiresAt,
          }),
        };

        const result = {
          opportunityId: opportunity.id,
          title: opportunity.title,
          overallScore,
          dimensions,
          reasoning,
          inboxStatus,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}

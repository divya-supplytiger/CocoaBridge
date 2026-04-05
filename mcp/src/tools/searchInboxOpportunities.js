import { z } from "zod";
import prisma from "../db.js";

const CONTACT_SELECT = {
  contact: {
    select: { fullName: true, email: true, phone: true, title: true },
  },
};

const OPPORTUNITY_SELECT = {
  id: true,
  title: true,
  type: true,
  pscCode: true,
  naicsCodes: true,
  responseDeadline: true,
};

function formatContact(cl) {
  return {
    fullName: cl.contact.fullName,
    email: cl.contact.email,
    phone: cl.contact.phone,
    title: cl.contact.title,
  };
}

export function registerSearchInboxOpportunities(server) {
  server.registerTool(
    "search_inbox_opportunities",
    {
      title: "Search Inbox Opportunities",
      description:
        "Search scored, pre-filtered opportunities across the confirmed inbox (InboxItem) and/or scoring queue (ScoringQueue). Returns each result with score, matched signals, inline contacts, and buying org — use this to answer questions like 'is anyone seeking vendors for PSC 8925?' or 'what active pursuits do we have?'",
      inputSchema: {
        psc: z.string().optional().describe("Filter by PSC code (exact match on linked opportunity)"),
        naics: z.string().optional().describe("Filter by NAICS code (hasSome on linked opportunity)"),
        keyword: z.string().optional().describe("Case-insensitive contains match on title"),
        source: z
          .enum(["INBOX", "QUEUE", "ALL"])
          .optional()
          .describe("Which pipeline to search — INBOX (confirmed), QUEUE (pending review), or ALL (default)"),
        reviewStatus: z
          .enum(["NEW", "IN_REVIEW", "QUALIFIED", "DISMISSED", "CONTACTED", "CLOSED"])
          .optional()
          .describe("Filter INBOX items by review status"),
        minScore: z.number().optional().describe("Minimum score (attachmentScore for inbox, score for queue)"),
        limit: z.number().optional().describe("Max results (default 20, max 50)"),
        offset: z.number().optional().describe("Number of results to skip for pagination (default 0)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ psc, naics, keyword, source = "ALL", reviewStatus, minScore, limit: rawLimit, offset: rawOffset }) => {
      try {
        const limit = Math.min(Math.max(rawLimit ?? 20, 1), 50);
        const offset = Math.max(rawOffset ?? 0, 0);

        const results = [];

        // --- INBOX ---
        if (source === "INBOX" || source === "ALL") {
          const inboxWhere = { opportunityId: { not: null } };

          if (reviewStatus) inboxWhere.reviewStatus = reviewStatus;
          if (minScore !== undefined) inboxWhere.attachmentScore = { gte: minScore };

          const oppFilter = {};
          if (psc) oppFilter.pscCode = psc;
          if (naics) oppFilter.naicsCodes = { hasSome: [naics] };
          if (keyword) oppFilter.title = { contains: keyword, mode: "insensitive" };
          if (Object.keys(oppFilter).length > 0) inboxWhere.opportunity = oppFilter;

          const inboxItems = await prisma.inboxItem.findMany({
            where: inboxWhere,
            include: {
              opportunity: { select: OPPORTUNITY_SELECT },
              buyingOrganization: { select: { name: true } },
              contactLinks: { include: CONTACT_SELECT },
            },
            orderBy: { attachmentScore: "desc" },
          });

          for (const item of inboxItems) {
            results.push({
              source: "INBOX",
              inboxItemId: item.id,
              opportunityId: item.opportunityId,
              title: item.title ?? item.opportunity?.title ?? null,
              score: item.attachmentScore ?? null,
              matchedSignals: item.matchedSignals ?? [],
              type: item.opportunity?.type ?? item.type,
              acquisitionPath: item.acquisitionPath,
              deadline: item.deadline ?? item.opportunity?.responseDeadline ?? null,
              reviewStatus: item.reviewStatus,
              buyingOrg: item.buyingOrganization?.name ?? null,
              contacts: item.contactLinks.map(formatContact),
            });
          }
        }

        // --- QUEUE ---
        if (source === "QUEUE" || source === "ALL") {
          const queueWhere = { status: "PENDING" };

          if (minScore !== undefined) queueWhere.score = { gte: minScore };

          const oppFilter = {};
          if (psc) oppFilter.pscCode = psc;
          if (naics) oppFilter.naicsCodes = { hasSome: [naics] };
          if (keyword) oppFilter.title = { contains: keyword, mode: "insensitive" };
          if (Object.keys(oppFilter).length > 0) queueWhere.opportunity = oppFilter;

          const queueItems = await prisma.scoringQueue.findMany({
            where: queueWhere,
            include: {
              opportunity: {
                select: {
                  ...OPPORTUNITY_SELECT,
                  buyingOrganization: { select: { name: true } },
                  contactLinks: { include: CONTACT_SELECT },
                },
              },
            },
            orderBy: { score: "desc" },
          });

          for (const entry of queueItems) {
            results.push({
              source: "QUEUE",
              queueEntryId: entry.id,
              opportunityId: entry.opportunityId,
              title: entry.opportunity?.title ?? null,
              score: entry.score,
              matchedSignals: entry.matchedSignals ?? [],
              type: entry.opportunity?.type ?? null,
              acquisitionPath: null,
              deadline: entry.opportunity?.responseDeadline ?? null,
              expiresAt: entry.expiresAt,
              buyingOrg: entry.opportunity?.buyingOrganization?.name ?? null,
              contacts: (entry.opportunity?.contactLinks ?? []).map(formatContact),
            });
          }
        }

        // Sort merged results by score descending
        results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

        const paginated = results.slice(offset, offset + limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { totalCount: results.length, offset, limit, results: paginated },
                null,
                2
              ),
            },
          ],
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

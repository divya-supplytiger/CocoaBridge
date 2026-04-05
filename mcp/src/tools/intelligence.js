import { z } from "zod";
import prisma from "../db.js";

export function registerIntelligenceSummary(server) {
  server.registerTool(
    "get_intelligence_summary",
    {
      title: "Get Intelligence Summary",
      description:
        "Deep procurement intelligence for a specific NAICS code, PSC code, or buying organization. Returns incumbents (top recipients), top buying orgs, average award size, total spend, active opportunities, and recent postings. At least one of naics, psc, or buyingOrgId must be provided.",
      inputSchema: {
        naics: z.string().optional().describe("NAICS code to analyze"),
        psc: z.string().optional().describe("PSC code to analyze"),
        buyingOrgId: z.string().optional().describe("Buying organization ID to analyze"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ naics, psc, buyingOrgId }) => {
      try {
        if (!naics && !psc && !buyingOrgId) {
          return {
            content: [{ type: "text", text: "At least one of naics, psc, or buyingOrgId must be provided." }],
            isError: true,
          };
        }

        // Resolve the full org subtree (2 levels deep) when buyingOrgId is provided.
        // Awards and opportunities are typically posted by child/grandchild offices,
        // not the top-level agency, so a direct ID match would miss most records.
        let orgIdSet = null;
        let buyingOrgContext = null;
        if (buyingOrgId) {
          const [rootOrg, children] = await Promise.all([
            prisma.buyingOrganization.findUnique({
              where: { id: buyingOrgId },
              select: { name: true, level: true },
            }),
            prisma.buyingOrganization.findMany({
              where: { parentId: buyingOrgId },
              select: { id: true },
            }),
          ]);

          buyingOrgContext = rootOrg
            ? `${rootOrg.name} (${rootOrg.level ?? "ORG"})`
            : buyingOrgId;

          const childIds = children.map((c) => c.id);
          const grandchildren = childIds.length > 0
            ? await prisma.buyingOrganization.findMany({
                where: { parentId: { in: childIds } },
                select: { id: true },
              })
            : [];

          orgIdSet = [buyingOrgId, ...childIds, ...grandchildren.map((g) => g.id)];
        }

        // Build scope description
        const scopeParts = [];
        if (naics) scopeParts.push(`NAICS ${naics}`);
        if (psc) scopeParts.push(`PSC ${psc}`);
        if (buyingOrgContext) scopeParts.push(buyingOrgContext);
        const scope = scopeParts.join(" + ");

        // Build shared where clauses using expanded org ID set
        const awardWhere = {};
        if (naics) awardWhere.naicsCodes = { hasSome: [naics] };
        if (psc) awardWhere.pscCode = psc;
        if (orgIdSet) awardWhere.buyingOrganizationId = { in: orgIdSet };

        const oppWhere = {};
        if (naics) oppWhere.naicsCodes = { hasSome: [naics] };
        if (psc) oppWhere.pscCode = psc;
        if (orgIdSet) oppWhere.buyingOrganizationId = { in: orgIdSet };

        const hasPscOrNaics = !!(psc || naics);

        const [
          totalAwards,
          awardAgg,
          topRecipientGroups,
          topBuyingOrgGroups,
          activeOpportunityCount,
          recentOpportunities,
          activeInboxItems,
          activeQueueItems,
        ] = await Promise.all([
          // Total awards matching scope
          prisma.award.count({ where: awardWhere }),

          // Total and average obligated amount
          prisma.award.aggregate({
            where: awardWhere,
            _sum: { obligatedAmount: true },
            _avg: { obligatedAmount: true },
          }),

          // Top recipients by award count (top 10)
          prisma.award.groupBy({
            by: ["recipientId"],
            where: { ...awardWhere, recipientId: { not: null } },
            _count: { id: true },
            _sum: { obligatedAmount: true },
            orderBy: { _count: { id: "desc" } },
            take: 10,
          }),

          // Top buying orgs by award count — always run; when filtering by org shows
          // which child offices are most active under the parent
          prisma.award.groupBy({
            by: ["buyingOrganizationId"],
            where: { ...awardWhere, buyingOrganizationId: { not: null } },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 10,
          }),

          // Active opportunity count
          prisma.opportunity.count({ where: { ...oppWhere, active: true } }),

          // Recent opportunities
          prisma.opportunity.findMany({
            where: oppWhere,
            orderBy: { postedDate: "desc" },
            take: 10,
            select: { id: true, title: true, type: true, postedDate: true },
          }),

          // Active inbox items — include when PSC/NAICS filter present or org filter present
          (hasPscOrNaics || orgIdSet)
            ? prisma.inboxItem.findMany({
                where: { opportunityId: { not: null }, opportunity: oppWhere },
                orderBy: { attachmentScore: "desc" },
                take: 5,
                select: {
                  id: true,
                  title: true,
                  reviewStatus: true,
                  attachmentScore: true,
                  deadline: true,
                },
              })
            : Promise.resolve([]),

          // Active scoring queue items
          (hasPscOrNaics || orgIdSet)
            ? prisma.scoringQueue.findMany({
                where: { status: "PENDING", opportunity: oppWhere },
                orderBy: { score: "desc" },
                take: 5,
                select: {
                  id: true,
                  score: true,
                  expiresAt: true,
                  opportunity: { select: { title: true } },
                },
              })
            : Promise.resolve([]),
        ]);

        // Resolve recipient names
        const recipientIds = topRecipientGroups.map((r) => r.recipientId).filter(Boolean);
        const recipients = recipientIds.length > 0
          ? await prisma.recipient.findMany({
              where: { id: { in: recipientIds } },
              select: { id: true, name: true, uei: true },
            })
          : [];
        const recipientMap = new Map(recipients.map((r) => [r.id, r]));

        const topRecipients = topRecipientGroups.map((r) => {
          const info = recipientMap.get(r.recipientId);
          return {
            name: info?.name || "Unknown",
            uei: info?.uei || null,
            awardCount: r._count.id,
            totalObligated: r._sum.obligatedAmount ? Number(r._sum.obligatedAmount) : 0,
          };
        });

        // Resolve buying org names for topBuyingOrgs
        let topBuyingOrgs = [];
        if (topBuyingOrgGroups.length > 0) {
          const topOrgIds = topBuyingOrgGroups.map((o) => o.buyingOrganizationId).filter(Boolean);
          const orgs = await prisma.buyingOrganization.findMany({
            where: { id: { in: topOrgIds } },
            select: { id: true, name: true, level: true },
          });
          const orgMap = new Map(orgs.map((o) => [o.id, o]));

          topBuyingOrgs = topBuyingOrgGroups.map((o) => {
            const info = orgMap.get(o.buyingOrganizationId);
            return {
              name: info?.name || "Unknown",
              level: info?.level || null,
              awardCount: o._count.id,
            };
          });
        }

        const formattedQueueItems = activeQueueItems.map((q) => ({
          id: q.id,
          title: q.opportunity?.title ?? null,
          score: q.score,
          expiresAt: q.expiresAt,
        }));

        const showInboxData = hasPscOrNaics || !!orgIdSet;

        const result = {
          scope,
          totalAwards,
          totalObligated: awardAgg._sum.obligatedAmount
            ? Number(awardAgg._sum.obligatedAmount)
            : 0,
          avgAwardSize: awardAgg._avg.obligatedAmount
            ? Number(awardAgg._avg.obligatedAmount)
            : 0,
          topRecipients,
          ...(topBuyingOrgs.length > 0 && { topBuyingOrgs }),
          activeOpportunityCount,
          recentOpportunities,
          ...(showInboxData && { activeInboxItems, activeQueueItems: formattedQueueItems }),
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

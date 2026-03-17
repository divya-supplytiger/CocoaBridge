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

        // Build scope description for the response
        const scopeParts = [];
        if (naics) scopeParts.push(`NAICS ${naics}`);
        if (psc) scopeParts.push(`PSC ${psc}`);
        if (buyingOrgId) scopeParts.push(`Buying Org ${buyingOrgId}`);
        const scope = scopeParts.join(" + ");

        // Build shared where clause for awards
        const awardWhere = {};
        if (naics) awardWhere.naicsCodes = { hasSome: [naics] };
        if (psc) awardWhere.pscCode = psc;
        if (buyingOrgId) awardWhere.buyingOrganizationId = buyingOrgId;

        // Build shared where clause for opportunities
        const oppWhere = {};
        if (naics) oppWhere.naicsCodes = { hasSome: [naics] };
        if (psc) oppWhere.pscCode = psc;
        if (buyingOrgId) oppWhere.buyingOrganizationId = buyingOrgId;

        const [
          totalAwards,
          awardAgg,
          topRecipientGroups,
          topBuyingOrgGroups,
          activeOpportunityCount,
          recentOpportunities,
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

          // Top buying orgs by award count (only relevant when not filtering by buyingOrgId)
          buyingOrgId
            ? Promise.resolve([])
            : prisma.award.groupBy({
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
        ]);

        // Resolve recipient names
        const recipientIds = topRecipientGroups
          .map((r) => r.recipientId)
          .filter(Boolean);
        const recipients =
          recipientIds.length > 0
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
            totalObligated: r._sum.obligatedAmount
              ? Number(r._sum.obligatedAmount)
              : 0,
          };
        });

        // Resolve buying org names (when not filtered by buyingOrgId)
        let topBuyingOrgs = [];
        if (!buyingOrgId && topBuyingOrgGroups.length > 0) {
          const orgIds = topBuyingOrgGroups
            .map((o) => o.buyingOrganizationId)
            .filter(Boolean);
          const orgs = await prisma.buyingOrganization.findMany({
            where: { id: { in: orgIds } },
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

        // If filtering by buyingOrgId, resolve its name for context
        let buyingOrgName = null;
        if (buyingOrgId) {
          const org = await prisma.buyingOrganization.findUnique({
            where: { id: buyingOrgId },
            select: { name: true },
          });
          buyingOrgName = org?.name || null;
        }

        const result = {
          scope,
          ...(buyingOrgName && { buyingOrgName }),
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

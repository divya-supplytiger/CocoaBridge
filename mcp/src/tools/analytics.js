import prisma from "../db.js";

export function registerAnalyticsTools(server) {
  server.registerTool(
    "get_analytics_summary",
    {
      title: "Get Analytics Summary",
      description: "Get a high-level summary of the procurement database: total opportunities, awards, obligated spend, top agencies, and recent opportunities",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const [totalOpportunities, totalAwards, aggregation, topAgencies, recentOpportunities] =
          await Promise.all([
            prisma.opportunity.count(),
            prisma.award.count(),
            prisma.award.aggregate({ _sum: { obligatedAmount: true } }),
            prisma.opportunity.groupBy({
              by: ["buyingOrganizationId"],
              _count: { id: true },
              where: { buyingOrganizationId: { not: null } },
              orderBy: { _count: { id: "desc" } },
              take: 10,
            }),
            prisma.opportunity.findMany({
              orderBy: { postedDate: "desc" },
              take: 10,
              select: { id: true, title: true, type: true, postedDate: true },
            }),
          ]);

        // Resolve agency names for top agencies
        const agencyIds = topAgencies
          .map((a) => a.buyingOrganizationId)
          .filter(Boolean);
        const agencies = await prisma.buyingOrganization.findMany({
          where: { id: { in: agencyIds } },
          select: { id: true, name: true },
        });
        const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));

        const result = {
          totalOpportunities,
          totalAwards,
          totalObligated: aggregation._sum.obligatedAmount
            ? Number(aggregation._sum.obligatedAmount)
            : 0,
          topAgenciesByOpps: topAgencies.map((a) => ({
            name: agencyMap.get(a.buyingOrganizationId) || "Unknown",
            count: a._count.id,
          })),
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

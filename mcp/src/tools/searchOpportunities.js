import prisma from "../db.js";

export function registerSearchOpportunities(server) {
  server.tool(
    "search_opportunities",
    "Find procurement opportunities by keyword, type, NAICS, PSC, state, or active status",
    {
      keyword: { type: "string", description: "Searches title + description (case-insensitive contains)" },
      type: {
        type: "string",
        description: "Opportunity type",
        enum: ["PRE_SOLICITATION", "AWARD_NOTICE", "SOURCES_SOUGHT", "SPECIAL_NOTICE", "SOLICITATION", "OTHER"],
      },
      naics: { type: "string", description: "Match against naicsCodes array" },
      psc: { type: "string", description: "Match pscCode" },
      state: { type: "string", description: "Match state field" },
      active: { type: "boolean", description: "Filter by active status" },
      limit: { type: "number", description: "Max results (default 20, max 50)" },
      offset: { type: "number", description: "Number of results to skip for pagination (default 0)" },
    },
    async ({ keyword, type, naics, psc, state, active, limit: rawLimit, offset: rawOffset }) => {
      try {
        const limit = Math.min(Math.max(rawLimit ?? 20, 1), 50);
        const offset = Math.max(rawOffset ?? 0, 0);

        const where = {};
        if (keyword) {
          where.OR = [
            { title: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
          ];
        }
        if (type) where.type = type;
        if (naics) where.naicsCodes = { has: naics };
        if (psc) where.pscCode = psc;
        if (state) where.state = state;
        if (active !== undefined) where.active = active;

        const [totalCount, results] = await Promise.all([
          prisma.opportunity.count({ where }),
          prisma.opportunity.findMany({
            where,
            orderBy: { postedDate: "desc" },
            take: limit,
            skip: offset,
            select: {
              id: true,
              title: true,
              type: true,
              postedDate: true,
              responseDeadline: true,
              naicsCodes: true,
              pscCode: true,
              state: true,
              active: true,
              buyingOrganizationId: true,
            },
          }),
        ]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ totalCount, offset, limit, results }, null, 2),
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

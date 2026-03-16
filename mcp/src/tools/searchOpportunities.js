import { z } from "zod";
import prisma from "../db.js";

export function registerSearchOpportunities(server) {
  server.registerTool(
    "search_opportunities",
    {
      title: "Search Opportunities",
      description: "Find procurement opportunities by keyword, type, NAICS, PSC, state, or active status",
      inputSchema: {
        keyword: z.string().optional().describe("Searches title + description (case-insensitive contains)"),
        type: z.enum(["PRE_SOLICITATION", "AWARD_NOTICE", "SOURCES_SOUGHT", "SPECIAL_NOTICE", "SOLICITATION", "OTHER"]).optional().describe("Opportunity type"),
        naics: z.string().optional().describe("Match against naicsCodes array"),
        psc: z.string().optional().describe("Match pscCode"),
        state: z.string().optional().describe("Match state field"),
        active: z.boolean().optional().describe("Filter by active status"),
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

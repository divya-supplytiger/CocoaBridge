import { z } from "zod";
import prisma from "../db.js";

export function registerSearchBuyingOrgs(server) {
  server.registerTool(
    "search_buying_orgs",
    {
      title: "Search Buying Organizations",
      description: "Search government buying organizations by name or hierarchy level",
      inputSchema: {
        name: z.string().optional().describe("Case-insensitive contains match on name"),
        level: z.enum(["AGENCY", "SUBAGENCY", "OFFICE", "OTHER"]).optional().describe("Organization level"),
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
    async ({ name, level, limit: rawLimit, offset: rawOffset }) => {
      try {
        const limit = Math.min(Math.max(rawLimit ?? 20, 1), 50);
        const offset = Math.max(rawOffset ?? 0, 0);

        const where = {};
        if (name) where.name = { contains: name, mode: "insensitive" };
        if (level) where.level = level;

        const [totalCount, results] = await Promise.all([
          prisma.buyingOrganization.count({ where }),
          prisma.buyingOrganization.findMany({
            where,
            orderBy: { name: "asc" },
            take: limit,
            skip: offset,
            select: {
              id: true,
              name: true,
              level: true,
              parentId: true,
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

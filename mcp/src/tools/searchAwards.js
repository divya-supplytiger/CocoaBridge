import { z } from "zod";
import prisma from "../db.js";

export function registerSearchAwards(server) {
  server.registerTool(
    "search_awards",
    {
      title: "Search Awards",
      description: "Search federal contract awards by keyword, NAICS, PSC, recipient, buying org, or amount range",
      inputSchema: {
        keyword: z.string().optional().describe("Searches description (case-insensitive contains)"),
        naics: z.string().optional().describe("Match against naicsCodes array"),
        psc: z.string().optional().describe("Match pscCode"),
        recipientId: z.string().optional().describe("Filter by recipient ID"),
        buyingOrgId: z.string().optional().describe("Filter by buying organization ID"),
        minAmount: z.number().optional().describe("Minimum obligatedAmount"),
        maxAmount: z.number().optional().describe("Maximum obligatedAmount"),
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
    async ({ keyword, naics, psc, recipientId, buyingOrgId, minAmount, maxAmount, limit: rawLimit, offset: rawOffset }) => {
      try {
        const limit = Math.min(Math.max(rawLimit ?? 20, 1), 50);
        const offset = Math.max(rawOffset ?? 0, 0);

        const where = {};
        if (keyword) {
          where.description = { contains: keyword, mode: "insensitive" };
        }
        if (naics) where.naicsCodes = { has: naics };
        if (psc) where.pscCode = psc;
        if (recipientId) where.recipientId = recipientId;
        if (buyingOrgId) where.buyingOrganizationId = buyingOrgId;
        if (minAmount !== undefined || maxAmount !== undefined) {
          where.obligatedAmount = {};
          if (minAmount !== undefined) where.obligatedAmount.gte = minAmount;
          if (maxAmount !== undefined) where.obligatedAmount.lte = maxAmount;
        }

        const [totalCount, results] = await Promise.all([
          prisma.award.count({ where }),
          prisma.award.findMany({
            where,
            orderBy: { startDate: "desc" },
            take: limit,
            skip: offset,
            select: {
              id: true,
              description: true,
              obligatedAmount: true,
              startDate: true,
              endDate: true,
              pscCode: true,
              naicsCodes: true,
              recipientId: true,
              buyingOrganizationId: true,
            },
          }),
        ]);

        // Convert Decimal to Number for JSON serialization
        const serialized = results.map((r) => ({
          ...r,
          obligatedAmount: r.obligatedAmount ? Number(r.obligatedAmount) : null,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ totalCount, offset, limit, results: serialized }, null, 2),
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

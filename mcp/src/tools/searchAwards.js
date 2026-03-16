import prisma from "../db.js";

export function registerSearchAwards(server) {
  server.tool(
    "search_awards",
    "Search federal contract awards by keyword, NAICS, PSC, recipient, buying org, or amount range",
    {
      keyword: { type: "string", description: "Searches description (case-insensitive contains)" },
      naics: { type: "string", description: "Match against naicsCodes array" },
      psc: { type: "string", description: "Match pscCode" },
      recipientId: { type: "string", description: "Filter by recipient ID" },
      buyingOrgId: { type: "string", description: "Filter by buying organization ID" },
      minAmount: { type: "number", description: "Minimum obligatedAmount" },
      maxAmount: { type: "number", description: "Maximum obligatedAmount" },
      limit: { type: "number", description: "Max results (default 20, max 50)" },
      offset: { type: "number", description: "Number of results to skip for pagination (default 0)" },
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

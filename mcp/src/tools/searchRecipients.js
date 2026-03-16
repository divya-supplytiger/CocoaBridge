import prisma from "../db.js";

export function registerSearchRecipients(server) {
  server.tool(
    "search_recipients",
    "Find award recipients (prime contractors) by name or UEI",
    {
      name: { type: "string", description: "Case-insensitive contains match on name" },
      uei: { type: "string", description: "Exact match on UEI" },
      limit: { type: "number", description: "Max results (default 20, max 50)" },
      offset: { type: "number", description: "Number of results to skip for pagination (default 0)" },
    },
    async ({ name, uei, limit: rawLimit, offset: rawOffset }) => {
      try {
        const limit = Math.min(Math.max(rawLimit ?? 20, 1), 50);
        const offset = Math.max(rawOffset ?? 0, 0);

        const where = {};
        if (name) where.name = { contains: name, mode: "insensitive" };
        if (uei) where.uei = uei;

        const [totalCount, results] = await Promise.all([
          prisma.recipient.count({ where }),
          prisma.recipient.findMany({
            where,
            orderBy: { name: "asc" },
            take: limit,
            skip: offset,
            select: {
              id: true,
              name: true,
              uei: true,
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

import { z } from "zod";
import prisma from "../db.js";

export function registerSearchRecipients(server) {
  server.registerTool(
    "search_recipients",
    {
      title: "Search Recipients",
      description: "Find award recipients (prime contractors) by name or UEI",
      inputSchema: {
        name: z.string().optional().describe("Case-insensitive contains match on name"),
        uei: z.string().optional().describe("Exact match on UEI"),
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

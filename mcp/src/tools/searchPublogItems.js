import { z } from "zod";
import prisma from "../db.js";

export function registerSearchPublogItems(server) {
  server.registerTool(
    "search_publog_items",
    {
      title: "Search Publog Items",
      description:
        "Search federal supply items by keyword, PSC code, NIIN, or NSN. Returns item descriptions from DLA Publog data. Use supplyTigerOnly to filter to SupplyTiger product lines (PSC 8925, 8950).",
      inputSchema: {
        keyword: z
          .string()
          .optional()
          .describe("Searches itemName + commonName (case-insensitive contains)"),
        psc: z
          .string()
          .optional()
          .describe("Filter by 4-digit PSC code (e.g., '8925')"),
        niin: z
          .string()
          .optional()
          .describe("Exact NIIN lookup (9-digit identifier)"),
        nsn: z
          .string()
          .optional()
          .describe("Exact NSN lookup (13-digit: PSC + NIIN)"),
        supplyTigerOnly: z
          .boolean()
          .optional()
          .describe("If true, only return items from SupplyTiger PSC codes (8925, 8950)"),
        limit: z.number().optional().describe("Max results (default 20, max 50)"),
        offset: z.number().optional().describe("Pagination offset (default 0)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ keyword, psc, niin, nsn, supplyTigerOnly, limit: rawLimit, offset: rawOffset }) => {
      try {
        const limit = Math.min(Math.max(rawLimit ?? 20, 1), 50);
        const offset = Math.max(rawOffset ?? 0, 0);

        const where = {};

        if (keyword) {
          where.OR = [
            { itemName: { contains: keyword, mode: "insensitive" } },
            { commonName: { contains: keyword, mode: "insensitive" } },
          ];
        }
        if (psc) where.pscCode = psc;
        if (niin) where.niin = niin;
        if (nsn) where.nsn = nsn;
        if (supplyTigerOnly) {
          where.pscClass = { isSupplyTigerPsc: true };
        }

        const [totalCount, results] = await Promise.all([
          prisma.nationalStockNumber.count({ where }),
          prisma.nationalStockNumber.findMany({
            where,
            orderBy: { itemName: "asc" },
            take: limit,
            skip: offset,
            select: {
              nsn: true,
              niin: true,
              pscCode: true,
              itemName: true,
              characteristics: true,
              commonName: true,
              pscClass: {
                select: {
                  title: true,
                  isSupplyTigerPsc: true,
                },
              },
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

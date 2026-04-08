import { z } from "zod";
import prisma from "../db.js";

export function registerGetContactInteractionsTool(server) {
  server.registerTool(
    "get_contact_interactions",
    {
      title: "Get Contact Interactions",
      description:
        "Returns the paginated outreach interaction log for a contact. Filter by status or date. Useful for reviewing outreach history before drafting a follow-up.",
      inputSchema: {
        contactId: z.string().describe("Contact ID"),
        status: z
          .enum(["SENT", "RESPONDED", "NO_REPLY", "FOLLOW_UP", "MEETING_SCHEDULED", "CLOSED"])
          .optional()
          .describe("Filter by interaction status"),
        since: z
          .string()
          .optional()
          .describe("ISO date string — only return interactions logged on or after this date (e.g. '2026-03-01')"),
        limit: z.number().min(1).max(50).optional().describe("Max results (default 20, max 50)"),
        offset: z.number().min(0).optional().describe("Pagination offset (default 0)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ contactId, status, since, limit = 20, offset = 0 }) => {
      try {
        const where = {
          contactId,
          ...(status && { status }),
          ...(since && { loggedAt: { gte: new Date(since) } }),
        };

        const [totalCount, results] = await Promise.all([
          prisma.contactInteraction.count({ where }),
          prisma.contactInteraction.findMany({
            where,
            orderBy: { loggedAt: "desc" },
            take: Math.min(limit, 50),
            skip: offset,
            include: { user: { select: { name: true } } },
          }),
        ]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              totalCount,
              offset,
              limit,
              results: results.map((ix) => ({
                id: ix.id,
                status: ix.status,
                note: ix.note ?? null,
                loggedBy: ix.user?.name ?? null,
                loggedAt: ix.loggedAt,
              })),
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}

import { z } from "zod";
import prisma from "../db.js";

const CONTACT_SELECT = {
  contact: {
    select: { fullName: true, email: true, phone: true, title: true },
  },
};

const OPPORTUNITY_SELECT = {
  id: true,
  title: true,
  type: true,
  pscCode: true,
  naicsCodes: true,
  responseDeadline: true,
};

function formatContact(cl) {
  return {
    fullName: cl.contact.fullName,
    email: cl.contact.email,
    phone: cl.contact.phone,
    title: cl.contact.title,
  };
}

export function registerGetInboxItem(server) {
  server.registerTool(
    "get_inbox_item",
    {
      title: "Get Inbox Item",
      description:
        "Retrieve full details of a single inbox item by ID, including score, matched signals, buying org, contacts, linked opportunity, and paginated logged notes.",
      inputSchema: {
        inboxItemId: z.string().describe("Inbox item ID"),
        limit: z.number().min(1).max(50).optional().describe("Max notes to return (default 20, max 50)"),
        offset: z.number().min(0).optional().describe("Notes pagination offset (default 0)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ inboxItemId, limit = 20, offset = 0 }) => {
      try {
        const noteLimit = Math.min(limit, 50);

        const [item, notesTotalCount] = await Promise.all([
          prisma.inboxItem.findUnique({
            where: { id: inboxItemId },
            include: {
              opportunity: { select: OPPORTUNITY_SELECT },
              buyingOrganization: { select: { name: true } },
              contactLinks: { include: CONTACT_SELECT },
              notes: {
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                take: noteLimit,
                skip: offset,
              },
            },
          }),
          prisma.inboxItemNote.count({ where: { inboxItemId } }),
        ]);

        if (!item) {
          return {
            content: [{ type: "text", text: `No inbox item found with id "${inboxItemId}"` }],
            isError: true,
          };
        }

        const result = {
          id: item.id,
          title: item.title ?? item.opportunity?.title ?? null,
          score: item.attachmentScore ?? null,
          matchedSignals: item.matchedSignals ?? [],
          type: item.opportunity?.type ?? item.type,
          acquisitionPath: item.acquisitionPath,
          deadline: item.deadline ?? item.opportunity?.responseDeadline ?? null,
          reviewStatus: item.reviewStatus,
          reviewedBy: item.reviewedBy ?? null,
          reviewedAt: item.reviewedAt ?? null,
          buyingOrg: item.buyingOrganization?.name ?? null,
          contacts: item.contactLinks.map(formatContact),
          opportunity: item.opportunity ?? null,
          notes: {
            totalCount: notesTotalCount,
            limit: noteLimit,
            offset,
            results: item.notes.map((n) => ({
              id: n.id,
              text: n.text,
              loggedBy: n.user?.name ?? null,
              createdAt: n.createdAt,
            })),
          },
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

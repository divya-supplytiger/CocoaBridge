import { z } from "zod";
import prisma from "../db.js";

export function registerGetOpportunity(server) {
  server.registerTool(
    "get_opportunity",
    {
      title: "Get Opportunity",
      description: "Retrieve full details of a single procurement opportunity by ID, including buying org, award count, and linked contacts",
      inputSchema: { id: z.string().describe("Opportunity ID") },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const [opportunity, inboxItem, queueEntry] = await Promise.all([
          prisma.opportunity.findUnique({
            where: { id },
            include: {
              buyingOrganization: {
                select: { id: true, name: true, level: true },
              },
              contactLinks: {
                select: {
                  type: true,
                  contact: {
                    select: { fullName: true, email: true, phone: true, title: true },
                  },
                },
              },
              attachments: {
                select: {
                  id: true,
                  name: true,
                  mimeType: true,
                  size: true,
                  postedDate: true,
                  parsedAt: true,
                },
                orderBy: { attachmentOrder: "asc" },
              },
              _count: {
                select: {
                  awards: true,
                },
              },
            },
          }),
          prisma.inboxItem.findFirst({
            where: { opportunityId: id },
            select: { id: true, reviewStatus: true, attachmentScore: true, matchedSignals: true },
          }),
          prisma.scoringQueue.findFirst({
            where: { opportunityId: id, status: "PENDING" },
            select: { id: true, score: true, expiresAt: true },
          }),
        ]);

        if (!opportunity) {
          return {
            content: [{ type: "text", text: `No opportunity found with id "${id}"` }],
            isError: true,
          };
        }

        const { _count, contactLinks, ...rest } = opportunity;
        const inboxStatus = {
          inInbox: !!inboxItem,
          inQueue: !!queueEntry,
          ...(inboxItem && {
            reviewStatus: inboxItem.reviewStatus,
            attachmentScore: inboxItem.attachmentScore,
            matchedSignals: inboxItem.matchedSignals,
          }),
          ...(queueEntry && {
            queueScore: queueEntry.score,
            expiresAt: queueEntry.expiresAt,
          }),
        };

        const result = {
          ...rest,
          awardCount: _count.awards,
          contacts: contactLinks.map((cl) => ({
            ...cl.contact,
            type: cl.type,
          })),
          inboxStatus,
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

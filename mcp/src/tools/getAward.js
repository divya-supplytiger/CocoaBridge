import { z } from "zod";
import prisma from "../db.js";

export function registerGetAward(server) {
  server.registerTool(
    "get_award",
    {
      title: "Get Award",
      description: "Retrieve full details of a single federal contract award by ID, including recipient, buying org, and linked opportunity",
      inputSchema: { id: z.string().describe("Award ID") },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        const [award, inboxItem] = await Promise.all([
          prisma.award.findUnique({
            where: { id },
            include: {
              recipient: {
                select: { name: true, uei: true },
              },
              buyingOrganization: {
                select: { name: true, level: true },
              },
              opportunity: {
                select: { title: true },
              },
            },
          }),
          prisma.inboxItem.findFirst({
            where: { awardId: id },
            select: { id: true, reviewStatus: true, attachmentScore: true, matchedSignals: true },
          }),
        ]);

        if (!award) {
          return {
            content: [{ type: "text", text: `No award found with id "${id}"` }],
            isError: true,
          };
        }

        const inboxStatus = {
          inInbox: !!inboxItem,
          ...(inboxItem && {
            reviewStatus: inboxItem.reviewStatus,
            attachmentScore: inboxItem.attachmentScore,
            matchedSignals: inboxItem.matchedSignals,
          }),
        };

        const result = {
          ...award,
          obligatedAmount: award.obligatedAmount ? Number(award.obligatedAmount) : null,
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

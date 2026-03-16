import { z } from "zod";
import prisma from "../db.js";

export function registerGetAward(server) {
  server.tool(
    "get_award",
    "Retrieve full details of a single federal contract award by ID, including recipient, buying org, and linked opportunity",
    { id: z.string().describe("Award ID") },
    async ({ id }) => {
      try {
        const award = await prisma.award.findUnique({
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
        });

        if (!award) {
          return {
            content: [{ type: "text", text: `No award found with id "${id}"` }],
            isError: true,
          };
        }

        const result = {
          ...award,
          obligatedAmount: award.obligatedAmount ? Number(award.obligatedAmount) : null,
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

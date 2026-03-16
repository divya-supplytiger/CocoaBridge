import { z } from "zod";
import prisma from "../db.js";

export function registerGetOpportunity(server) {
  server.tool(
    "get_opportunity",
    "Retrieve full details of a single procurement opportunity by ID, including buying org, award count, and contact count",
    { id: z.string().describe("Opportunity ID") },
    async ({ id }) => {
      try {
        const opportunity = await prisma.opportunity.findUnique({
          where: { id },
          include: {
            buyingOrganization: {
              select: { id: true, name: true, level: true },
            },
            _count: {
              select: {
                awards: true,
                contactLinks: true,
              },
            },
          },
        });

        if (!opportunity) {
          return {
            content: [{ type: "text", text: `No opportunity found with id "${id}"` }],
            isError: true,
          };
        }

        const { _count, ...rest } = opportunity;
        const result = {
          ...rest,
          awardCount: _count.awards,
          contactCount: _count.contactLinks,
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

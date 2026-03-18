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
        const opportunity = await prisma.opportunity.findUnique({
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
            _count: {
              select: {
                awards: true,
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

        const { _count, contactLinks, ...rest } = opportunity;
        const result = {
          ...rest,
          awardCount: _count.awards,
          contacts: contactLinks.map((cl) => ({
            ...cl.contact,
            type: cl.type,
          })),
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

import { z } from "zod";
import prisma from "../db.js";

export function registerGetBuyingOrg(server) {
  server.tool(
    "get_buying_org",
    "Get full details of a buying organization including parent, children, and opportunity/award counts",
    { id: z.string().describe("BuyingOrganization ID") },
    async ({ id }) => {
      try {
        const org = await prisma.buyingOrganization.findUnique({
          where: { id },
          include: {
            parent: {
              select: { id: true, name: true, level: true },
            },
            children: {
              select: { id: true, name: true, level: true },
              orderBy: { name: "asc" },
            },
            _count: {
              select: {
                opportunities: true,
                awards: true,
              },
            },
          },
        });

        if (!org) {
          return {
            content: [{ type: "text", text: `No buying organization found with id "${id}"` }],
            isError: true,
          };
        }

        const { _count, ...rest } = org;
        const result = {
          ...rest,
          opportunityCount: _count.opportunities,
          awardCount: _count.awards,
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

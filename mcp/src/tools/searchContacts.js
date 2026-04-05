import { z } from "zod";
import prisma from "../db.js";

export function registerSearchContacts(server) {
  server.registerTool(
    "search_contacts",
    {
      title: "Search Contacts",
      description: "Find contacts linked to opportunities, buying organizations, or industry days",
      inputSchema: {
        keyword: z.string().optional().describe("Searches linked opportunity titles/descriptions and industryDay titles/summaries (case-insensitive)"),
        opportunityId: z.string().optional().describe("Filter contacts linked to a specific opportunity"),
        buyingOrgId: z.string().optional().describe("Filter contacts linked to a specific buying org"),
        includeInboxContacts: z.boolean().optional().describe("Include contacts linked to inbox items (excluded by default)"),
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
    async ({ keyword, opportunityId, buyingOrgId, includeInboxContacts, limit: rawLimit, offset: rawOffset }) => {
      try {
        const limit = Math.min(Math.max(rawLimit ?? 20, 1), 50);
        const offset = Math.max(rawOffset ?? 0, 0);

        const where = includeInboxContacts ? {} : { inboxItemId: null };

        if (opportunityId) where.opportunityId = opportunityId;
        if (buyingOrgId) where.buyingOrganizationId = buyingOrgId;
        if (keyword) {
          where.OR = [
            { opportunity: { title: { contains: keyword, mode: "insensitive" } } },
            { opportunity: { description: { contains: keyword, mode: "insensitive" } } },
            { industryDay: { title: { contains: keyword, mode: "insensitive" } } },
            { industryDay: { summary: { contains: keyword, mode: "insensitive" } } },
          ];
        }

        const [totalCount, links] = await Promise.all([
          prisma.contactLink.count({ where }),
          prisma.contactLink.findMany({
            where,
            include: {
              contact: true,
              opportunity: { select: { id: true, title: true } },
              industryDay: { select: { id: true, title: true } },
              buyingOrganization: { select: { id: true, name: true } },
              inboxItem: { select: { id: true, title: true } },
            },
            take: limit,
            skip: offset,
          }),
        ]);

        const results = links.map((link) => {
          const { contact } = link;
          let linkedTo;
          if (link.inboxItem) {
            linkedTo = { type: "inboxItem", id: link.inboxItem.id, title: link.inboxItem.title };
          } else if (link.opportunity) {
            linkedTo = { type: "opportunity", id: link.opportunity.id, title: link.opportunity.title };
          } else if (link.industryDay) {
            linkedTo = { type: "industryDay", id: link.industryDay.id, title: link.industryDay.title };
          } else if (link.buyingOrganization) {
            linkedTo = { type: "buyingOrg", id: link.buyingOrganization.id, title: link.buyingOrganization.name };
          }
          return {
            id: contact.id,
            fullName: contact.fullName,
            email: contact.email,
            phone: contact.phone,
            title: contact.title,
            linkedTo,
          };
        });

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

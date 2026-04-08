import { z } from "zod";
import prisma from "../db.js";

const PRIORITY = { PRIMARY: 0, SECONDARY: 1, OTHER: 2 };

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
        contactType: z.enum(["PRIMARY", "SECONDARY", "OTHER"]).optional().describe("Filter by contact link type (PRIMARY, SECONDARY, or OTHER)"),
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
    async ({ keyword, opportunityId, buyingOrgId, includeInboxContacts, contactType, limit: rawLimit, offset: rawOffset }) => {
      try {
        const limit = Math.min(Math.max(rawLimit ?? 20, 1), 50);
        const offset = Math.max(rawOffset ?? 0, 0);

        const where = {
          ...(includeInboxContacts ? {} : { inboxItemId: null }),
          ...(opportunityId && { opportunityId }),
          ...(buyingOrgId && { buyingOrganizationId: buyingOrgId }),
          ...(contactType && { type: contactType }),
        };

        if (keyword) {
          where.OR = [
            { contact: { fullName: { contains: keyword, mode: "insensitive" } } },
            { contact: { email: { contains: keyword, mode: "insensitive" } } },
            { opportunity: { title: { contains: keyword, mode: "insensitive" } } },
            { opportunity: { description: { contains: keyword, mode: "insensitive" } } },
            { industryDay: { title: { contains: keyword, mode: "insensitive" } } },
            { industryDay: { summary: { contains: keyword, mode: "insensitive" } } },
          ];
        }

        const includeClause = {
          contact: true,
          opportunity: { select: { id: true, title: true } },
          industryDay: { select: { id: true, title: true } },
          buyingOrganization: { select: { id: true, name: true } },
          inboxItem: { select: { id: true, title: true } },
        };

        let raw, totalCount;

        if (contactType) {
          // With a type filter, paginate at DB level — no deduplication needed
          [totalCount, raw] = await Promise.all([
            prisma.contactLink.count({ where }),
            prisma.contactLink.findMany({
              where,
              include: includeClause,
              take: limit,
              skip: offset,
            }),
          ]);
        } else {
          // Without type filter, fetch all and deduplicate by contactId (highest-priority type wins)
          const allLinks = await prisma.contactLink.findMany({ where, include: includeClause });

          const byContact = new Map();
          for (const link of allLinks) {
            const existing = byContact.get(link.contactId);
            if (!existing || PRIORITY[link.type] < PRIORITY[existing.type]) {
              byContact.set(link.contactId, link);
            }
          }
          const deduped = [...byContact.values()];
          totalCount = deduped.length;
          raw = deduped.slice(offset, offset + limit);
        }

        const results = raw.map((link) => {
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

import { z } from "zod";
import prisma from "../db.js";

export function registerGetContactTool(server) {
  server.registerTool(
    "get_contact",
    {
      title: "Get Contact",
      description:
        "Returns a contact's full profile: fields, all entity links (opportunities, buying orgs, industry days, inbox items), and complete outreach interaction history.",
      inputSchema: {
        id: z.string().describe("Contact ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        const contact = await prisma.contact.findUnique({
          where: { id },
          include: {
            links: {
              select: {
                type: true,
                opportunityId: true, opportunity: { select: { id: true, title: true } },
                buyingOrganizationId: true, buyingOrganization: { select: { id: true, name: true } },
                industryDayId: true, industryDay: { select: { id: true, title: true } },
                inboxItemId: true, inboxItem: { select: { id: true, title: true } },
              },
            },
            interactions: {
              orderBy: { loggedAt: "desc" },
              include: { user: { select: { name: true } } },
            },
          },
        });

        if (!contact) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Contact not found" }) }], isError: true };
        }

        const links = contact.links.map((l) => {
          if (l.opportunity) return { type: l.type, kind: "opportunity", id: l.opportunity.id, title: l.opportunity.title };
          if (l.buyingOrganization) return { type: l.type, kind: "buyingOrganization", id: l.buyingOrganization.id, title: l.buyingOrganization.name };
          if (l.industryDay) return { type: l.type, kind: "industryDay", id: l.industryDay.id, title: l.industryDay.title };
          if (l.inboxItem) return { type: l.type, kind: "inboxItem", id: l.inboxItem.id, title: l.inboxItem.title };
          return null;
        }).filter(Boolean);

        const interactions = contact.interactions.map((ix) => ({
          id: ix.id,
          status: ix.status,
          note: ix.note ?? null,
          loggedBy: ix.user?.name ?? null,
          loggedAt: ix.loggedAt,
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              id: contact.id,
              fullName: contact.fullName,
              email: contact.email,
              phone: contact.phone,
              title: contact.title,
              createdAt: contact.createdAt,
              links,
              interactions,
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}

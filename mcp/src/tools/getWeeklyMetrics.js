import { z } from "zod";
import prisma from "../db.js";

// Parse "YYYY-Www" → { start: Monday 00:00 UTC, end: Sunday 23:59:59 UTC }
const parseISOWeekBounds = (weekStr) => {
  const match = weekStr?.match(/^(\d{4})-W(\d{1,2})$/);
  let monday;
  if (match) {
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dow = jan4.getUTCDay() || 7;
    monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - (dow - 1) + (week - 1) * 7);
  } else {
    const now = new Date();
    const dow = now.getUTCDay() || 7;
    monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - (dow - 1));
    monday.setUTCHours(0, 0, 0, 0);
  }
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
};

const toDateStr = (d) => d.toISOString().slice(0, 10);

const toISOWeekStr = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const year = d.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(((d - startOfYear) / 86400000 + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
};

export function registerGetWeeklyMetricsTool(server) {
  server.registerTool(
    "get_weekly_metrics",
    {
      title: "Get Weekly Metrics",
      description:
        "Returns the 5-metric pipeline report for a given ISO week (e.g. '2026-W14'). Includes full records for the current week and counts-only for the previous week. Defaults to the current week if no week param is provided.",
      inputSchema: {
        week: z
          .string()
          .optional()
          .describe("ISO week string e.g. '2026-W14'. Defaults to current week if omitted."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ week }) => {
      try {
        const { start, end } = parseISOWeekBounds(week);
        const prevStart = new Date(start);
        prevStart.setUTCDate(start.getUTCDate() - 7);
        const prevEnd = new Date(end);
        prevEnd.setUTCDate(end.getUTCDate() - 7);

        // ── Current week — full records ──
        const [newContacts, outreaches, followups, screened, qualifiedInbox, respondedInteractions] = await Promise.all([
          // 1. New contacts
          prisma.contactLink.findMany({
            where: {
              opportunityId: { not: null },
              opportunity: { inboxItems: { some: { createdAt: { gte: start, lte: end } } } },
            },
            select: {
              contactId: true,
              contact: { select: { id: true, fullName: true, email: true } },
              opportunity: {
                select: {
                  inboxItems: {
                    where: { createdAt: { gte: start, lte: end } },
                    take: 1,
                    select: { id: true },
                  },
                },
              },
            },
          }),
          // 2. Outreaches sent
          prisma.inboxItem.findMany({
            where: { reviewStatus: "CONTACTED", reviewedAt: { gte: start, lte: end } },
            select: { id: true, title: true, reviewedBy: true, reviewedAt: true },
          }),
          // 3. Followups
          prisma.contactInteraction.findMany({
            where: { status: { in: ["FOLLOW_UP", "MEETING_SCHEDULED"] }, loggedAt: { gte: start, lte: end } },
            include: {
              contact: { select: { id: true, fullName: true } },
              user: { select: { name: true } },
            },
          }),
          // 4. Solicitations screened
          prisma.inboxItem.findMany({
            where: { reviewStatus: "IN_REVIEW", reviewedAt: { gte: start, lte: end } },
            select: { id: true, title: true, reviewedBy: true, reviewedAt: true },
          }),
          // 5a. Buyer paths — qualified inbox items
          prisma.inboxItem.findMany({
            where: { reviewStatus: "QUALIFIED", reviewedAt: { gte: start, lte: end } },
            select: { id: true, title: true, reviewedBy: true, reviewedAt: true },
          }),
          // 5b. Buyer paths — responded interactions
          prisma.contactInteraction.findMany({
            where: { status: "RESPONDED", loggedAt: { gte: start, lte: end } },
            include: {
              contact: { select: { id: true, fullName: true } },
              user: { select: { name: true } },
            },
          }),
        ]);

        // Merge + deduplicate buyer paths
        const seenBuyer = new Set();
        const buyerPathsRecords = [];
        for (const item of qualifiedInbox) {
          const key = `inbox:${item.id}`;
          if (!seenBuyer.has(key)) {
            seenBuyer.add(key);
            buyerPathsRecords.push({ source: "INBOX", id: item.id, title: item.title, reviewedBy: item.reviewedBy, reviewedAt: item.reviewedAt });
          }
        }
        for (const ix of respondedInteractions) {
          const key = `interaction:${ix.id}`;
          if (!seenBuyer.has(key)) {
            seenBuyer.add(key);
            buyerPathsRecords.push({ source: "INTERACTION", id: ix.id, contactId: ix.contact.id, contactName: ix.contact.fullName, loggedByName: ix.user?.name ?? null, loggedAt: ix.loggedAt });
          }
        }

        // ── Previous week — counts only ──
        const [prevNewContacts, prevOutreaches, prevFollowups, prevScreened, prevQualified, prevResponded] = await Promise.all([
          prisma.contactLink.findMany({
            where: { opportunityId: { not: null }, opportunity: { inboxItems: { some: { createdAt: { gte: prevStart, lte: prevEnd } } } } },
            select: { contactId: true },
          }).then((links) => new Set(links.map((l) => l.contactId)).size),
          prisma.inboxItem.count({ where: { reviewStatus: "CONTACTED", reviewedAt: { gte: prevStart, lte: prevEnd } } }),
          prisma.contactInteraction.count({ where: { status: { in: ["FOLLOW_UP", "MEETING_SCHEDULED"] }, loggedAt: { gte: prevStart, lte: prevEnd } } }),
          prisma.inboxItem.count({ where: { reviewStatus: "IN_REVIEW", reviewedAt: { gte: prevStart, lte: prevEnd } } }),
          prisma.inboxItem.count({ where: { reviewStatus: "QUALIFIED", reviewedAt: { gte: prevStart, lte: prevEnd } } }),
          prisma.contactInteraction.count({ where: { status: "RESPONDED", loggedAt: { gte: prevStart, lte: prevEnd } } }),
        ]);

        // Deduplicate new contacts by contactId
        const seenContacts = new Set();
        const newContactRecords = [];
        for (const link of newContacts) {
          if (!seenContacts.has(link.contactId)) {
            seenContacts.add(link.contactId);
            newContactRecords.push({
              contactId: link.contact.id,
              fullName: link.contact.fullName,
              email: link.contact.email,
              inboxItemId: link.opportunity.inboxItems[0]?.id ?? null,
            });
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              week: toISOWeekStr(start),
              weekStart: toDateStr(start),
              weekEnd: toDateStr(end),
              current: {
                newContacts: { count: newContactRecords.length, records: newContactRecords },
                outreaches: {
                  count: outreaches.length,
                  records: outreaches.map((i) => ({ inboxItemId: i.id, title: i.title, reviewedBy: i.reviewedBy, reviewedAt: i.reviewedAt })),
                },
                followups: {
                  count: followups.length,
                  records: followups.map((ix) => ({ interactionId: ix.id, contactId: ix.contact.id, contactName: ix.contact.fullName, loggedByName: ix.user?.name ?? null, loggedAt: ix.loggedAt })),
                },
                screened: {
                  count: screened.length,
                  records: screened.map((i) => ({ inboxItemId: i.id, title: i.title, reviewedBy: i.reviewedBy, reviewedAt: i.reviewedAt })),
                },
                buyerPaths: { count: buyerPathsRecords.length, records: buyerPathsRecords },
              },
              previous: {
                newContacts:  { count: prevNewContacts },
                outreaches:   { count: prevOutreaches },
                followups:    { count: prevFollowups },
                screened:     { count: prevScreened },
                buyerPaths:   { count: prevQualified + prevResponded },
              },
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}

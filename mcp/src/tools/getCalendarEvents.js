import { z } from "zod";
import prisma from "../db.js";

export function registerGetCalendarEvents(server) {
  server.registerTool(
    "get_calendar_events",
    {
      title: "Get Calendar Events",
      description:
        "Returns upcoming opportunity deadlines and industry days for a given month/year or custom date range. " +
        "Deadlines are active opportunities with a responseDeadline in the range. " +
        "Industry days are filtered by status (defaults to OPEN, ATTENDING, ATTENDED).",
      inputSchema: {
        month: z.number().int().min(1).max(12).optional().describe("Month (1-12). Used with year for a monthly view."),
        year: z.number().int().min(2020).optional().describe("4-digit year. Used with month for a monthly view."),
        startDate: z.string().optional().describe("ISO 8601 start date (e.g. '2026-04-01'). Alternative to month/year."),
        endDate: z.string().optional().describe("ISO 8601 end date exclusive (e.g. '2026-05-01'). Alternative to month/year."),
        type: z.enum(["deadline", "industry_day", "all"]).optional().describe("Filter by event type (default: all)"),
        industryDayStatus: z.array(
          z.enum(["OPEN", "NOT_ATTENDING", "ATTENDING", "ATTENDED", "PAST_EVENT"])
        ).optional().describe("Industry day statuses to include (default: OPEN, ATTENDING, ATTENDED)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ month, year, startDate, endDate, type = "all", industryDayStatus }) => {
      try {
        let start, end;

        if (startDate || endDate) {
          start = startDate ? new Date(startDate) : new Date(0);
          end = endDate ? new Date(endDate) : new Date("2100-01-01");
        } else if (month && year) {
          start = new Date(year, month - 1, 1);
          end = new Date(year, month, 1);
        } else {
          return {
            content: [{ type: "text", text: "Error: Provide either (month + year) or (startDate + endDate)" }],
            isError: true,
          };
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return {
            content: [{ type: "text", text: "Error: Invalid date values provided" }],
            isError: true,
          };
        }

        const statusFilter = industryDayStatus ?? ["OPEN", "ATTENDING", "ATTENDED"];

        const [opportunities, industryDays] = await Promise.all([
          type !== "industry_day"
            ? prisma.opportunity.findMany({
                where: {
                  active: true,
                  responseDeadline: { gte: start, lt: end },
                },
                orderBy: { responseDeadline: "asc" },
                select: {
                  id: true,
                  title: true,
                  responseDeadline: true,
                  naicsCodes: true,
                  pscCode: true,
                  buyingOrganization: { select: { id: true, name: true } },
                },
              })
            : Promise.resolve([]),
          type !== "deadline"
            ? prisma.industryDay.findMany({
                where: {
                  status: { in: statusFilter },
                  eventDate: { gte: start, lt: end },
                },
                orderBy: { eventDate: "asc" },
                select: {
                  id: true,
                  title: true,
                  eventDate: true,
                  location: true,
                  host: true,
                  status: true,
                  buyingOrganization: { select: { id: true, name: true } },
                },
              })
            : Promise.resolve([]),
        ]);

        const events = [
          ...opportunities.map((o) => ({
            type: "deadline",
            id: o.id,
            title: o.title ?? "Untitled Opportunity",
            date: o.responseDeadline,
            naicsCodes: o.naicsCodes,
            pscCode: o.pscCode,
            buyingOrganization: o.buyingOrganization ?? null,
          })),
          ...industryDays.map((d) => ({
            type: "industry_day",
            id: d.id,
            title: d.title ?? "Untitled Industry Day",
            date: d.eventDate,
            location: d.location ?? null,
            host: d.host ?? null,
            status: d.status,
            buyingOrganization: d.buyingOrganization ?? null,
          })),
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  rangeStart: start.toISOString(),
                  rangeEnd: end.toISOString(),
                  totalDeadlines: opportunities.length,
                  totalIndustryDays: industryDays.length,
                  events,
                },
                null,
                2
              ),
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

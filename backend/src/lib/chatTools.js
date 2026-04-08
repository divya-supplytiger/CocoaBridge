import { tool } from "ai";
import { z } from "zod";
import { callMcpTool } from "./mcpClient.js";

export const chatTools = {
  search_opportunities: tool({
    description:
      "Find procurement opportunities by keyword, type, NAICS, PSC, state, or active status",
    parameters: z.object({
      keyword: z.string().optional().describe("Searches title + description"),
      type: z
        .enum(["PRE_SOLICITATION", "AWARD_NOTICE", "SOURCES_SOUGHT", "SPECIAL_NOTICE", "SOLICITATION", "OTHER"])
        .optional()
        .describe("Opportunity type"),
      naics: z.string().optional().describe("Match against naicsCodes array"),
      psc: z.string().optional().describe("Match pscCode"),
      state: z.string().optional().describe("Match state field"),
      active: z.boolean().optional().describe("Filter by active status"),
      limit: z.number().optional().describe("Max results (default 20, max 50)"),
      offset: z.number().optional().describe("Pagination offset"),
    }),
    execute: (args) => callMcpTool("search_opportunities", args),
  }),

  get_opportunity: tool({
    description:
      "Retrieve full details of a single procurement opportunity by ID",
    parameters: z.object({
      id: z.string().describe("Opportunity ID"),
    }),
    execute: (args) => callMcpTool("get_opportunity", args),
  }),

  
  search_awards: tool({
    description:
      "Search federal contract awards by keyword, NAICS, PSC, recipient, buying org, or amount range",
    parameters: z.object({
      keyword: z.string().optional().describe("Searches description"),
      naics: z.string().optional().describe("Match against naicsCodes array"),
      psc: z.string().optional().describe("Match pscCode"),
      recipientId: z.string().optional().describe("Filter by recipient ID"),
      buyingOrgId: z.string().optional().describe("Filter by buying organization ID"),
      minAmount: z.number().optional().describe("Minimum obligatedAmount"),
      maxAmount: z.number().optional().describe("Maximum obligatedAmount"),
      limit: z.number().optional().describe("Max results (default 20, max 50)"),
      offset: z.number().optional().describe("Pagination offset"),
    }),
    execute: (args) => callMcpTool("search_awards", args),
  }),

  get_award: tool({
    description:
      "Retrieve full details of a single federal contract award by ID",
    parameters: z.object({
      id: z.string().describe("Award ID"),
    }),
    execute: (args) => callMcpTool("get_award", args),
  }),

  search_buying_orgs: tool({
    description: "Search government buying organizations by name or hierarchy level",
    parameters: z.object({
      name: z.string().optional().describe("Case-insensitive match on name"),
      level: z
        .enum(["AGENCY", "SUBAGENCY", "OFFICE", "OTHER"])
        .optional()
        .describe("Organization level"),
      limit: z.number().optional().describe("Max results (default 20, max 50)"),
      offset: z.number().optional().describe("Pagination offset"),
    }),
    execute: (args) => callMcpTool("search_buying_orgs", args),
  }),

  get_buying_org: tool({
    description:
      "Get full details of a buying organization including parent, children, and counts",
    parameters: z.object({
      id: z.string().describe("BuyingOrganization ID"),
    }),
    execute: (args) => callMcpTool("get_buying_org", args),
  }),

  search_recipients: tool({
    description: "Find award recipients (prime contractors) by name or UEI",
    parameters: z.object({
      name: z.string().optional().describe("Case-insensitive match on name"),
      uei: z.string().optional().describe("Exact match on UEI"),
      limit: z.number().optional().describe("Max results (default 20, max 50)"),
      offset: z.number().optional().describe("Pagination offset"),
    }),
    execute: (args) => callMcpTool("search_recipients", args),
  }),

  search_contacts: tool({
    description:
      "Find contacts linked to opportunities, buying organizations, or industry days",
    parameters: z.object({
      keyword: z.string().optional().describe("Searches contact name, email, linked opportunity titles/descriptions, and industry day text (case-insensitive)"),
      opportunityId: z.string().optional().describe("Filter by opportunity"),
      buyingOrgId: z.string().optional().describe("Filter by buying org"),
      includeInboxContacts: z.boolean().optional().describe("Include contacts linked to inbox items (excluded by default)"),
      contactType: z.enum(["PRIMARY", "SECONDARY", "OTHER"]).optional().describe("Filter by contact link type (PRIMARY, SECONDARY, or OTHER)"),
      limit: z.number().optional().describe("Max results (default 20, max 50)"),
      offset: z.number().optional().describe("Pagination offset"),
    }),
    execute: (args) => callMcpTool("search_contacts", args),
  }),

  get_contact: tool({
    description:
      "Get a contact's full profile: fields, all entity links (opportunities, buying orgs, industry days, inbox items), and complete outreach interaction history.",
    parameters: z.object({
      id: z.string().describe("Contact ID"),
    }),
    execute: (args) => callMcpTool("get_contact", args),
  }),

  get_contact_interactions: tool({
    description:
      "Get the paginated outreach interaction log for a contact. Filter by status or date. Useful for reviewing outreach history before drafting a follow-up.",
    parameters: z.object({
      contactId: z.string().describe("Contact ID"),
      status: z
        .enum(["SENT", "RESPONDED", "NO_REPLY", "FOLLOW_UP", "MEETING_SCHEDULED", "CLOSED"])
        .optional()
        .describe("Filter by interaction status"),
      since: z.string().optional().describe("ISO date — only return interactions on or after this date (e.g. '2026-03-01')"),
      limit: z.number().optional().describe("Max results (default 20, max 50)"),
      offset: z.number().optional().describe("Pagination offset (default 0)"),
    }),
    execute: (args) => callMcpTool("get_contact_interactions", args),
  }),

  get_weekly_metrics: tool({
    description:
      "Get the 5-metric pipeline report for a given ISO week (e.g. '2026-W14'): new contacts, outreaches, follow-ups, screened solicitations, and buyer paths. Includes full records for the requested week and counts for the prior week. Defaults to the current week.",
    parameters: z.object({
      week: z.string().optional().describe("ISO week string e.g. '2026-W14'. Defaults to current week if omitted."),
    }),
    execute: (args) => callMcpTool("get_weekly_metrics", args),
  }),

  search_inbox_opportunities: tool({
    description:
      "Search scored, pre-filtered opportunities across the confirmed inbox (InboxItem) and/or scoring queue (ScoringQueue). Returns each result with score, matched signals, inline contacts, and buying org. Use this to answer questions like 'is anyone seeking vendors for PSC 8925?' or 'what active pursuits do we have?'",
    parameters: z.object({
      psc: z.string().optional().describe("Filter by PSC code"),
      naics: z.string().optional().describe("Filter by NAICS code"),
      keyword: z.string().optional().describe("Case-insensitive match on title"),
      source: z.enum(["INBOX", "QUEUE", "ALL"]).optional().describe("INBOX (confirmed), QUEUE (pending review), or ALL (default)"),
      reviewStatus: z.enum(["NEW", "IN_REVIEW", "QUALIFIED", "DISMISSED", "CONTACTED", "CLOSED"]).optional().describe("Filter INBOX items by review status"),
      minScore: z.number().optional().describe("Minimum score"),
      limit: z.number().optional().describe("Max results (default 20, max 50)"),
      offset: z.number().optional().describe("Pagination offset"),
    }),
    execute: (args) => callMcpTool("search_inbox_opportunities", args),
  }),

  get_inbox_item: tool({
    description:
      "Retrieve full details of a single inbox item by ID, including score, matched signals, buying org, contacts, linked opportunity, and paginated logged notes.",
    parameters: z.object({
      inboxItemId: z.string().describe("Inbox item ID"),
      limit: z.number().optional().describe("Max notes to return (default 20, max 50)"),
      offset: z.number().optional().describe("Notes pagination offset (default 0)"),
    }),
    execute: (args) => callMcpTool("get_inbox_item", args),
  }),

  score_opportunity: tool({
    description:
      "Score a procurement opportunity against SupplyTiger's company profile. Returns HIGH/MEDIUM/LOW fit.",
    parameters: z.object({
      id: z.string().describe("Opportunity ID to score"),
    }),
    execute: (args) => callMcpTool("score_opportunity", args),
  }),

  get_analytics_summary: tool({
    description:
      "Get high-level procurement database summary: totals, top agencies, recent opportunities",
    parameters: z.object({}),
    execute: () => callMcpTool("get_analytics_summary", {}),
  }),

  get_intelligence_summary: tool({
    description:
      "Deep procurement intelligence for a NAICS code, PSC code, or buying org. Returns incumbents, spend, and active opportunities.",
    parameters: z.object({
      naics: z.string().optional().describe("NAICS code to analyze"),
      psc: z.string().optional().describe("PSC code to analyze"),
      buyingOrgId: z.string().optional().describe("Buying organization ID to analyze"),
    }),
    execute: (args) => callMcpTool("get_intelligence_summary", args),
  }),

  search_publog_items: tool({
    description:
      "Search federal supply items from DLA Publog by keyword, PSC code, NIIN, or NSN. Returns item descriptions, characteristics, and common names. Use supplyTigerOnly to filter to SupplyTiger product lines (PSC 8925, 8950).",
    parameters: z.object({
      keyword: z.string().optional().describe("Searches itemName + commonName (case-insensitive)"),
      psc: z.string().optional().describe("Filter by 4-digit PSC code (e.g., '8925')"),
      niin: z.string().optional().describe("Exact NIIN lookup (9-digit identifier)"),
      nsn: z.string().optional().describe("Exact NSN lookup (13-digit: PSC + NIIN)"),
      supplyTigerOnly: z.boolean().optional().describe("If true, only return items from SupplyTiger PSC codes (8925, 8950)"),
      limit: z.number().optional().describe("Max results (default 20, max 50)"),
      offset: z.number().optional().describe("Pagination offset"),
    }),
    execute: (args) => callMcpTool("search_publog_items", args),
  }),

  get_cid_spec: tool({
    description:
      "Look up a USDA Commercial Item Description (CID) specification by CID code or PSC code. Returns structured spec data (scope, classification, salient characteristics, analytical requirements, QA provisions, packaging) plus DB metadata. Use for product labeling, compliance, or spec questions.",
    parameters: z.object({
      cidCode: z.string().optional().describe("CID code (e.g., 'A-A-20177G')"),
      psc: z.string().optional().describe("PSC code (e.g., '8925'). Returns all CID specs under this PSC."),
    }),
    execute: (args) => callMcpTool("get_cid_spec", args),
  }),

  generate_bid_draft: tool({
    description:
      "Generate a structured draft bid/proposal for a specific opportunity using SupplyTiger's company profile, bid template, and opportunity details. Returns detailed instructions for drafting the bid with placeholders for user input.",
    parameters: z.object({
      opportunityId: z.string().describe("The opportunity ID to draft a bid for"),
    }),
    execute: (args) => callMcpTool("generate_bid_draft", args),
  }),

  analyze_opportunity_fit: tool({
    description:
      "Deep-dive analysis of an opportunity's fit for SupplyTiger — competitive landscape, incumbents, agency buying history, contacts, and recommended pursuit strategy (GO / NO-GO / CONDITIONAL).",
    parameters: z.object({
      opportunityId: z.string().describe("The opportunity ID to analyze"),
    }),
    execute: (args) => callMcpTool("analyze_opportunity_fit", args),
  }),

  analyze_fulfillment: tool({
    description:
      "Determine whether an opportunity warrants FULL, PARTIAL, or NO-BID based on SupplyTiger's capabilities, PSC/NAICS alignment, CLIN structure, and whether the contracting entity is likely to accept partial fulfillment.",
    parameters: z.object({
      opportunityId: z.string().describe("The opportunity ID to analyze for fulfillment capability"),
    }),
    execute: (args) => callMcpTool("analyze_fulfillment", args),
  }),

  generate_outreach_draft: tool({
    description:
      "Draft a professional outreach email to the contracting POC for a confirmed inbox item, using SupplyTiger's company profile and the opportunity details. Use when the user wants to initiate contact with a buying organization for an active pursuit.",
    parameters: z.object({
      inboxItemId: z.string().describe("The inbox item ID to draft outreach for"),
    }),
    execute: (args) => callMcpTool("generate_outreach_draft", args),
  }),

  get_calendar_events: tool({
    description:
      "Returns upcoming opportunity deadlines, inbox item deadlines, and industry days for a given month/year or custom date range. Use for calendar views, 'what's due this month', or outreach planning.",
    parameters: z.object({
      month: z.number().int().min(1).max(12).optional().describe("Month (1–12). Use with year for a monthly view."),
      year: z.number().int().min(2020).optional().describe("4-digit year. Use with month for a monthly view."),
      startDate: z.string().optional().describe("ISO 8601 start date (e.g. '2026-04-01'). Alternative to month/year."),
      endDate: z.string().optional().describe("ISO 8601 end date exclusive (e.g. '2026-05-01'). Alternative to month/year."),
      type: z.enum(["deadline", "industry_day", "inbox_deadline", "all"]).optional().describe("Filter by event type (default: all)"),
      industryDayStatus: z
        .array(z.enum(["OPEN", "NOT_ATTENDING", "ATTENDING", "ATTENDED", "PAST_EVENT"]))
        .optional()
        .describe("Industry day statuses to include (default: OPEN, ATTENDING, ATTENDED)"),
    }),
    execute: (args) => callMcpTool("get_calendar_events", args),
  }),
};

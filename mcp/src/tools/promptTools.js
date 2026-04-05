import { z } from "zod";
import {
  buildBidDraftPrompt,
  buildOpportunityFitPrompt,
  buildFulfillmentPrompt,
  buildOutreachDraftPrompt,
} from "../promptLogic.js";

/**
 * Register tool wrappers for prompt flows so the agent can invoke them
 * autonomously (prompts are user-initiated only in MCP clients).
 *
 * Each wrapper prepends an instruction preamble so the model treats the
 * returned text as actionable instructions rather than informational data.
 */

const INSTRUCTION_PREAMBLE =
  "Follow the instructions below exactly. Produce the full analysis or draft as specified — do not summarize, paraphrase, or treat these instructions as informational context.\n\n---\n\n";

export function registerPromptTools(server) {
  server.registerTool(
    "generate_bid_draft",
    {
      title: "Generate Bid Draft",
      description:
        "Generate a structured draft bid/proposal for a specific opportunity using SupplyTiger's company profile, bid template, and opportunity details. Returns a detailed prompt that guides bid creation with placeholders for user input.",
      inputSchema: {
        opportunityId: z.string().describe("The opportunity ID to draft a bid for"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ opportunityId }) => {
      const result = await buildBidDraftPrompt(opportunityId);
      const text = INSTRUCTION_PREAMBLE + result.messages[0].content.text;
      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "analyze_opportunity_fit",
    {
      title: "Analyze Opportunity Fit",
      description:
        "Analyze a specific opportunity's fit for SupplyTiger — competitive landscape, incumbents, agency buying history, contacts, and recommended pursuit strategy (GO / NO-GO / CONDITIONAL).",
      inputSchema: {
        opportunityId: z.string().describe("The opportunity ID to analyze"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ opportunityId }) => {
      const result = await buildOpportunityFitPrompt(opportunityId);
      const text = INSTRUCTION_PREAMBLE + result.messages[0].content.text;
      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "analyze_fulfillment",
    {
      title: "Analyze Fulfillment Capability",
      description:
        "Determine whether an opportunity warrants FULL, PARTIAL, or NO-BID based on SupplyTiger's capabilities, PSC/NAICS alignment, CLIN structure, and whether the contracting entity is likely to accept partial fulfillment.",
      inputSchema: {
        opportunityId: z
          .string()
          .describe("The opportunity ID to analyze for fulfillment capability"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ opportunityId }) => {
      const result = await buildFulfillmentPrompt(opportunityId);
      const text = INSTRUCTION_PREAMBLE + result.messages[0].content.text;
      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "generate_outreach_draft",
    {
      title: "Generate Outreach Draft",
      description:
        "Draft a professional outreach email to the contracting POC for a confirmed inbox item, using SupplyTiger's company profile, opportunity details, matched NSN signals, and pipeline score. Use when the user wants to initiate contact with a buying organization for an active pursuit.",
      inputSchema: {
        inboxItemId: z.string().describe("The inbox item ID to draft outreach for"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ inboxItemId }) => {
      const result = await buildOutreachDraftPrompt(inboxItemId);
      const text = INSTRUCTION_PREAMBLE + result.messages[0].content.text;
      return { content: [{ type: "text", text }] };
    }
  );
}

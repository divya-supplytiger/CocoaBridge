import { z } from "zod";
import {
  buildBidDraftPrompt,
  buildOpportunityFitPrompt,
  buildFulfillmentPrompt,
  buildOutreachDraftPrompt,
} from "./promptLogic.js";

export function registerPrompts(server) {
  server.registerPrompt(
    "generate-bid-draft",
    {
      title: "Generate Bid Draft",
      description:
        "Generate a structured draft bid/proposal for a specific opportunity using SupplyTiger's company profile, the bid template, and opportunity details. The agent will follow the template structure and elicit specifics from the user.",
      argsSchema: {
        opportunityId: z.string().describe("The opportunity ID to draft a bid for"),
      },
    },
    async ({ opportunityId }) => buildBidDraftPrompt(opportunityId)
  );

  server.registerPrompt(
    "analyze-opportunity-fit",
    {
      title: "Analyze Opportunity Fit",
      description:
        "Deep-dive analysis of a specific opportunity's fit for SupplyTiger — competitive landscape, incumbents, agency buying history, contacts, and recommended pursuit strategy.",
      argsSchema: {
        opportunityId: z.string().describe("The opportunity ID to analyze"),
      },
    },
    async ({ opportunityId }) => buildOpportunityFitPrompt(opportunityId)
  );

  server.registerPrompt(
    "analyze-fulfillment",
    {
      title: "Analyze Fulfillment Capability",
      description:
        "Determine whether an opportunity warrants full or partial submission based on SupplyTiger's confectionery capabilities, PSC/NAICS alignment, CLIN structure, and whether the contracting entity is likely to accept partial fulfillment.",
      argsSchema: {
        opportunityId: z.string().describe("The opportunity ID to analyze for fulfillment capability"),
      },
    },
    async ({ opportunityId }) => buildFulfillmentPrompt(opportunityId)
  );

  server.registerPrompt(
    "generate-outreach-draft",
    {
      title: "Generate Outreach Draft",
      description:
        "Draft a professional outreach email to the contracting POC for a confirmed inbox item, using SupplyTiger's company profile and the opportunity details. Use this when you want to initiate contact with the buying organization for an active pursuit.",
      argsSchema: {
        inboxItemId: z.string().describe("The inbox item ID to draft outreach for"),
      },
    },
    async ({ inboxItemId }) => buildOutreachDraftPrompt(inboxItemId)
  );
}

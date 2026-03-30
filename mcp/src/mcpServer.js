import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAnalyticsTools } from "./tools/analytics.js";
import { registerSearchOpportunities } from "./tools/searchOpportunities.js";
import { registerGetOpportunity } from "./tools/getOpportunity.js";
import { registerSearchAwards } from "./tools/searchAwards.js";
import { registerGetAward } from "./tools/getAward.js";
import { registerSearchBuyingOrgs } from "./tools/searchBuyingOrgs.js";
import { registerGetBuyingOrg } from "./tools/getBuyingOrg.js";
import { registerSearchRecipients } from "./tools/searchRecipients.js";
import { registerSearchContacts } from "./tools/searchContacts.js";
import { registerScoreOpportunity } from "./tools/scoring.js";
import { registerIntelligenceSummary } from "./tools/intelligence.js";
import { registerSearchPublogItems } from "./tools/searchPublogItems.js";
import { registerGetCidSpec } from "./tools/getCidSpec.js";
import { registerGetAttachmentText } from "./tools/getAttachmentText.js";
import { registerGetCalendarEvents } from "./tools/getCalendarEvents.js";
import { registerResources } from "./resourcesConfig.js";
import { registerPrompts } from "./prompts.js";
import { registerPromptTools } from "./tools/promptTools.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "cocoabridge-goa",
    version: "1.0.0",
    description: "SupplyTiger procurement intelligence MCP server",
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  });

  registerAnalyticsTools(server);
  registerSearchOpportunities(server);
  registerGetOpportunity(server);
  registerSearchAwards(server);
  registerGetAward(server);
  registerSearchBuyingOrgs(server);
  registerGetBuyingOrg(server);
  registerSearchRecipients(server);
  registerSearchContacts(server);
  registerScoreOpportunity(server);
  registerIntelligenceSummary(server);
  registerSearchPublogItems(server);
  registerGetCidSpec(server);
  registerGetAttachmentText(server);
  registerGetCalendarEvents(server);
  registerResources(server);
  registerPrompts(server);
  registerPromptTools(server);

  return server;
}

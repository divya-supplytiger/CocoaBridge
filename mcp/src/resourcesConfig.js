import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import prisma from "./db.js";
import { COMPANY_PROFILE } from "./resources/companyProfile.js";
import { BID_TEMPLATE } from "./resources/bidTemplate.js";

export function registerResources(server) {
  // --- Static resource: company profile ---
  server.resource(
    "company-profile",
    "supplytiger://company/profile",
    { description: "SupplyTiger capability statement — UEI, CAGE, NAICS, PSC, core competencies, and contact info" },
    async () => ({
      contents: [
        {
          uri: "supplytiger://company/profile",
          mimeType: "application/json",
          text: JSON.stringify(COMPANY_PROFILE, null, 2),
        },
      ],
    }),
  );

  // --- Static resource: bid/proposal template ---
  server.resource(
    "bid-template",
    "supplytiger://templates/bid",
    { description: "Federal bid/proposal template — standard sections, evaluation factors, requirement types (SOW/PWS/SOO), compliance checklist, and elicitation prompts. Based on GSA guidance and FAR Part 15." },
    async () => ({
      contents: [
        {
          uri: "supplytiger://templates/bid",
          mimeType: "application/json",
          text: JSON.stringify(BID_TEMPLATE, null, 2),
        },
      ],
    }),
  );

  // --- Resource template: opportunity detail ---
  server.resource(
    "opportunity-detail",
    new ResourceTemplate("procurement://opportunities/{id}", { list: undefined }),
    { description: "Full opportunity record by ID" },
    async (uri, { id }) => {
      const opportunity = await prisma.opportunity.findUnique({
        where: { id },
        include: {
          buyingOrganization: { select: { id: true, name: true, level: true } },
          _count: { select: { awards: true, contactLinks: true } },
        },
      });
      if (!opportunity) {
        throw new Error(`Opportunity ${id} not found`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(opportunity, null, 2),
          },
        ],
      };
    },
  );

  // --- Resource template: award detail ---
  server.resource(
    "award-detail",
    new ResourceTemplate("procurement://awards/{id}", { list: undefined }),
    { description: "Full award record by ID" },
    async (uri, { id }) => {
      const award = await prisma.award.findUnique({
        where: { id },
        include: {
          recipient: { select: { name: true, uei: true } },
          buyingOrganization: { select: { name: true, level: true } },
          opportunity: { select: { title: true } },
        },
      });
      if (!award) {
        throw new Error(`Award ${id} not found`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(award, null, 2),
          },
        ],
      };
    },
  );
}

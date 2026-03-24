import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import prisma from "./db.js";
import { COMPANY_PROFILE } from "./resources/companyProfile.js";
import { BID_TEMPLATE } from "./resources/bidTemplate.js";
import { CID_SPECS } from "./resources/cidSpecs.js";

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

  // --- Resource template: CID spec (DB metadata + static USDA spec text) ---
  server.resource(
    "cid-spec",
    new ResourceTemplate("publog://cid/{cidCode}", { list: undefined }),
    { description: "Full USDA Commercial Item Description (CID) specification by CID code — DB metadata (dates, QA package, PSC class) plus the complete spec text (scope, classification, salient characteristics, analytical requirements, QA provisions, packaging). Available CIDs: A-A-20177G (candy), A-A-20001C (spices), A-A-20331B (survival food)." },
    async (uri, { cidCode }) => {
      const spec = CID_SPECS[cidCode];
      if (!spec) {
        throw new Error(`CID ${cidCode} not found. Available: ${Object.keys(CID_SPECS).join(", ")}`);
      }

      const dbRecord = await prisma.commercialItemDesc.findUnique({
        where: { cid: cidCode },
        include: {
          pscClass: {
            select: { psc: true, title: true, inclusions: true, exclusions: true, notes: true },
          },
        },
      });

      const metadata = dbRecord
        ? {
            cid: dbRecord.cid,
            date: dbRecord.date,
            description: dbRecord.description,
            qaPkg: dbRecord.qaPkg,
            qaPkgDate: dbRecord.qaPkgDate,
            pscCode: dbRecord.pscCode,
            pscClass: dbRecord.pscClass,
          }
        : { cid: spec.cid, pscCode: spec.pscCode, title: spec.title, date: spec.date };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ metadata, spec }, null, 2),
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

import { z } from "zod";
import prisma from "../db.js";
import { CID_SPECS, getCidSpecsByPsc } from "../resources/cidSpecs.js";

export function registerGetCidSpec(server) {
  server.registerTool(
    "get_cid_spec",
    {
      title: "Get CID Spec",
      description:
        "Look up a USDA Commercial Item Description (CID) specification by CID code or PSC code. Returns structured spec data (scope, classification, salient characteristics, analytical requirements, QA provisions, packaging) plus DB metadata (dates, QA package). Available CIDs: A-A-20177G (8925 candy), A-A-20001C (8950 spices), A-A-20331B (8970 survival food).",
      inputSchema: {
        cidCode: z
          .string()
          .optional()
          .describe("CID code (e.g., 'A-A-20177G'). Takes priority over psc if both provided."),
        psc: z
          .string()
          .optional()
          .describe("PSC code (e.g., '8925'). Returns all CID specs under this PSC."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ cidCode, psc }) => {
      if (!cidCode && !psc) {
        return {
          content: [
            {
              type: "text",
              text: `Please provide either a cidCode or psc parameter. Available CIDs: ${Object.entries(CID_SPECS).map(([k, v]) => `${k} (PSC ${v.pscCode} — ${v.title})`).join(", ")}`,
            },
          ],
        };
      }

      // Resolve specs to return
      let specs;
      if (cidCode) {
        const spec = CID_SPECS[cidCode];
        if (!spec) {
          return {
            content: [
              {
                type: "text",
                text: `CID "${cidCode}" not found. Available CIDs: ${Object.entries(CID_SPECS).map(([k, v]) => `${k} (PSC ${v.pscCode} — ${v.title})`).join(", ")}`,
              },
            ],
          };
        }
        specs = [spec];
      } else {
        specs = getCidSpecsByPsc(psc);
        if (specs.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No CID specs found for PSC "${psc}". Available PSC codes: 8925 (candy), 8950 (spices), 8970 (survival food).`,
              },
            ],
          };
        }
      }

      // Fetch DB metadata for all matching CIDs
      const dbRecords = await prisma.commercialItemDesc.findMany({
        where: { cid: { in: specs.map((s) => s.cid) } },
        include: {
          pscClass: {
            select: { psc: true, title: true, inclusions: true, exclusions: true, notes: true },
          },
        },
      });
      const dbMap = Object.fromEntries(dbRecords.map((r) => [r.cid, r]));

      // Build results
      const results = specs.map((spec) => {
        const db = dbMap[spec.cid];
        const metadata = db
          ? {
              cid: db.cid,
              date: db.date,
              description: db.description,
              qaPkg: db.qaPkg,
              qaPkgDate: db.qaPkgDate,
              pscCode: db.pscCode,
              pscClass: db.pscClass,
            }
          : { cid: spec.cid, pscCode: spec.pscCode, title: spec.title, date: spec.date };

        return {
          metadata,
          spec: {
            scope: spec.scope,
            classification: spec.classification,
            salientCharacteristics: spec.salientCharacteristics,
            analyticalRequirements: spec.analyticalRequirements,
            qualityAssurance: spec.qualityAssurance,
            packaging: spec.packaging,
          },
        };
      });

      // If single result, return directly; if multiple, return array
      const payload = results.length === 1 ? results[0] : results;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    },
  );
}

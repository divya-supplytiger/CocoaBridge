import { z } from "zod";
import prisma from "./db.js";
import { COMPANY_PROFILE } from "./resources/companyProfile.js";
import { BID_TEMPLATE } from "./resources/bidTemplate.js";

export function registerPrompts(server) {
  // --- Prompt: generate-bid-draft ---
  server.prompt(
    "generate-bid-draft",
    {
      description:
        "Generate a structured draft bid/proposal for a specific opportunity using SupplyTiger's company profile, the bid template, and opportunity details. The agent will follow the template structure and elicit specifics from the user.",
      arguments: [
        {
          name: "opportunityId",
          description: "The opportunity ID to draft a bid for",
          required: true,
        },
      ],
    },
    async ({ opportunityId }) => {
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        include: {
          buyingOrganization: { select: { id: true, name: true, level: true } },
        },
      });

      if (!opportunity) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `No opportunity found with ID "${opportunityId}". Please verify the ID and try again.`,
              },
            },
          ],
        };
      }

      const companyJson = JSON.stringify(COMPANY_PROFILE, null, 2);
      const templateJson = JSON.stringify(BID_TEMPLATE, null, 2);

      const promptText = `You are drafting a bid/proposal response for the following federal procurement opportunity on behalf of SupplyTiger (Prime Printer Solution Inc).

---

## OPPORTUNITY DETAILS

- **Title:** ${opportunity.title || "N/A"}
- **Solicitation #:** ${opportunity.solicitationNumber || "N/A"}
- **Type:** ${opportunity.type || "N/A"}
- **Response Deadline:** ${opportunity.responseDeadline ? new Date(opportunity.responseDeadline).toLocaleDateString() : "Not specified"}
- **NAICS Codes:** ${opportunity.naicsCodes?.join(", ") || "None"}
- **PSC Code:** ${opportunity.pscCode || "None"}
- **Set-Aside:** ${opportunity.setAside || "None"}
- **State:** ${opportunity.state || "N/A"}
- **Buying Organization:** ${opportunity.buyingOrganization?.name || "N/A"} (${opportunity.buyingOrganization?.level || "N/A"})
- **Description:** ${opportunity.description || "No description available"}

---

## COMPANY PROFILE (SupplyTiger)

${companyJson}

---

## BID TEMPLATE & GUIDANCE

${templateJson}

---

## INSTRUCTIONS

1. **Identify the requirement type** from the solicitation description (SOW, PWS, or SOO). If unclear, ask the user which type applies.

2. **Follow the bid template structure** — draft each section from the template's \`proposalSections\` array in order.

3. **Before drafting**, elicit critical information from the user by asking about the items listed in each section's \`elicit\` array. Key questions to ask upfront:
   - What requirement type does the solicitation use (SOW, PWS, or SOO)?
   - What are SupplyTiger's most relevant past performance examples for this opportunity?
   - Who will be the program manager / key personnel?
   - What pricing strategy should be used?
   - Are there any subcontractors or teaming partners?
   - Any specific technical approach or differentiators to highlight?

4. **Tailor the technical approach** to the opportunity's NAICS/PSC codes and the buying organization.

5. **Address all evaluation factors** referenced in the template, weighted by what the solicitation states.

6. **Include the compliance checklist** at the end to ensure nothing is missed.

7. **Output format:** Draft each section with clear headings. Use placeholders like [USER INPUT NEEDED] where user-specific information is required.

8. This is a DRAFT for user review — do not submit anything. The user will refine and finalize.`;

      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text: promptText },
          },
        ],
      };
    }
  );

  // --- Prompt: analyze-opportunity-fit ---
  server.prompt(
    "analyze-opportunity-fit",
    {
      description:
        "Deep-dive analysis of a specific opportunity's fit for SupplyTiger — competitive landscape, incumbents, agency buying history, contacts, and recommended pursuit strategy.",
      arguments: [
        {
          name: "opportunityId",
          description: "The opportunity ID to analyze",
          required: true,
        },
      ],
    },
    async ({ opportunityId }) => {
      // Fetch opportunity with related data
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        include: {
          buyingOrganization: { select: { id: true, name: true, level: true } },
          _count: { select: { awards: true, contactLinks: true } },
        },
      });

      if (!opportunity) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `No opportunity found with ID "${opportunityId}". Please verify the ID and try again.`,
              },
            },
          ],
        };
      }

      // Fetch related awards for this buying org in relevant NAICS/PSC
      let relatedAwards = [];
      if (opportunity.buyingOrganizationId) {
        relatedAwards = await prisma.award.findMany({
          where: {
            buyingOrganizationId: opportunity.buyingOrganizationId,
            OR: [
              ...(opportunity.naicsCodes.length > 0
                ? [{ naicsCodes: { hasSome: opportunity.naicsCodes } }]
                : []),
              ...(opportunity.pscCode
                ? [{ pscCode: opportunity.pscCode }]
                : []),
            ].length > 0
              ? [
                  ...(opportunity.naicsCodes.length > 0
                    ? [{ naicsCodes: { hasSome: opportunity.naicsCodes } }]
                    : []),
                  ...(opportunity.pscCode
                    ? [{ pscCode: opportunity.pscCode }]
                    : []),
                ]
              : [{}],
          },
          include: {
            recipient: { select: { name: true, uei: true } },
          },
          orderBy: { startDate: "desc" },
          take: 15,
        });
      }

      // Fetch contacts linked to this opportunity
      const contactLinks = await prisma.contactLink.findMany({
        where: { opportunityId: opportunity.id },
        include: {
          contact: true,
        },
        take: 10,
      });

      const contacts = contactLinks.map((cl) => ({
        name: cl.contact.fullName,
        email: cl.contact.email,
        phone: cl.contact.phone,
        title: cl.contact.title,
      }));

      const awardsJson = JSON.stringify(
        relatedAwards.map((a) => ({
          description: a.description,
          obligatedAmount: a.obligatedAmount ? Number(a.obligatedAmount) : null,
          startDate: a.startDate,
          endDate: a.endDate,
          recipient: a.recipient?.name || "Unknown",
          recipientUei: a.recipient?.uei || null,
        })),
        null,
        2
      );

      const companyJson = JSON.stringify(COMPANY_PROFILE, null, 2);

      const promptText = `Perform a deep-dive opportunity fit analysis for SupplyTiger (Prime Printer Solution Inc) on the following federal procurement opportunity.

---

## OPPORTUNITY DETAILS

- **Title:** ${opportunity.title || "N/A"}
- **Solicitation #:** ${opportunity.solicitationNumber || "N/A"}
- **Type:** ${opportunity.type || "N/A"}
- **Posted:** ${opportunity.postedDate ? new Date(opportunity.postedDate).toLocaleDateString() : "N/A"}
- **Response Deadline:** ${opportunity.responseDeadline ? new Date(opportunity.responseDeadline).toLocaleDateString() : "Not specified"}
- **NAICS Codes:** ${opportunity.naicsCodes?.join(", ") || "None"}
- **PSC Code:** ${opportunity.pscCode || "None"}
- **Set-Aside:** ${opportunity.setAside || "None"}
- **State:** ${opportunity.state || "N/A"}
- **Active:** ${opportunity.active}
- **Buying Organization:** ${opportunity.buyingOrganization?.name || "N/A"} (${opportunity.buyingOrganization?.level || "N/A"})
- **Award Count:** ${opportunity._count.awards}
- **Contact Count:** ${opportunity._count.contactLinks}
- **Description:** ${opportunity.description || "No description available"}

---

## SUPPLYTIGER COMPANY PROFILE

${companyJson}

---

## RELATED AWARDS FROM THIS AGENCY (same NAICS/PSC)

These show incumbents and historical spending by this buying organization in relevant categories:

${awardsJson}

---

## CONTACTS LINKED TO THIS OPPORTUNITY

${contacts.length > 0 ? JSON.stringify(contacts, null, 2) : "No contacts found for this opportunity."}

---

## ANALYSIS REQUESTED

Provide a comprehensive analysis covering:

1. **Fit Assessment:** How well does this opportunity align with SupplyTiger's NAICS codes, PSC codes, core competencies, and acquisition paths? Rate as HIGH / MEDIUM / LOW with reasoning.

2. **Competitive Landscape:** Based on the related awards data, who are the incumbents? What are typical award sizes? Is this a re-compete or new requirement?

3. **Agency Buying History:** How actively does this buying organization procure in SupplyTiger's product categories? What patterns emerge from the award data?

4. **Set-Aside & Eligibility:** Does SupplyTiger qualify for the set-aside type (if any)? Are there any eligibility concerns?

5. **Timeline Assessment:** How much time remains before the deadline? Is it sufficient for a quality response?

6. **Contact Strategy:** Based on the contacts listed, recommend an outreach approach. Who should be contacted and what should the messaging focus on?

7. **Pursuit Recommendation:** GO / NO-GO / CONDITIONAL recommendation with clear reasoning. If CONDITIONAL, state what additional information is needed.

8. **Next Steps:** If pursuing, what are the immediate action items?`;

      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text: promptText },
          },
        ],
      };
    }
  );
}

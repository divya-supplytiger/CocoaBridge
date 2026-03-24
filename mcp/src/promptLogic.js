import prisma from "./db.js";
import { COMPANY_PROFILE, COMPANY_PSC_CODES } from "./resources/companyProfile.js";
import { BID_TEMPLATE } from "./resources/bidTemplate.js";

function notFoundResult(opportunityId) {
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

// --- generate-bid-draft ---
export async function buildBidDraftPrompt(opportunityId) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      buyingOrganization: { select: { id: true, name: true, level: true } },
    },
  });

  if (!opportunity) return notFoundResult(opportunityId);

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

8. This is a DRAFT for user review — do not submit anything. The user will refine and finalize.

---

> **Tip:** You can use the \`search_publog_items\` tool to look up specific NSN/NIIN items matching this opportunity's PSC code (${opportunity.pscCode || "N/A"}). This can help you reference exact product lines and item descriptions when drafting the technical approach.`;

  return {
    messages: [
      { role: "user", content: { type: "text", text: promptText } },
    ],
  };
}

// --- analyze-opportunity-fit ---
export async function buildOpportunityFitPrompt(opportunityId) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      buyingOrganization: { select: { id: true, name: true, level: true } },
      _count: { select: { awards: true, contactLinks: true } },
    },
  });

  if (!opportunity) return notFoundResult(opportunityId);

  let relatedAwards = [];
  if (opportunity.buyingOrganizationId) {
    const orConditions = [
      ...(opportunity.naicsCodes.length > 0
        ? [{ naicsCodes: { hasSome: opportunity.naicsCodes } }]
        : []),
      ...(opportunity.pscCode ? [{ pscCode: opportunity.pscCode }] : []),
    ];

    relatedAwards = await prisma.award.findMany({
      where: {
        buyingOrganizationId: opportunity.buyingOrganizationId,
        OR: orConditions.length > 0 ? orConditions : [{}],
      },
      include: {
        recipient: { select: { name: true, uei: true } },
      },
      orderBy: { startDate: "desc" },
      take: 15,
    });
  }

  let matchingItems = [];
  if (opportunity.pscCode) {
    matchingItems = await prisma.nationalStockNumber.findMany({
      where: { pscCode: opportunity.pscCode },
      select: {
        nsn: true,
        niin: true,
        pscCode: true,
        itemName: true,
        commonName: true,
        pscClass: { select: { title: true, isSupplyTigerPsc: true } },
      },
      orderBy: { itemName: "asc" },
      take: 20,
    });
  }

  const contactLinks = await prisma.contactLink.findMany({
    where: { opportunityId: opportunity.id },
    include: { contact: true },
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

## MATCHING SUPPLY ITEMS (NSN/Publog — PSC ${opportunity.pscCode || "N/A"})

${matchingItems.length > 0
  ? `These are federal supply items in this opportunity's PSC code. Items flagged as \`isSupplyTigerPsc: true\` are in SupplyTiger's core product lines.\n\n${JSON.stringify(matchingItems.map((i) => ({ nsn: i.nsn, niin: i.niin, psc: i.pscCode, itemName: i.itemName, commonName: i.commonName, pscTitle: i.pscClass?.title || null, isSupplyTigerPsc: i.pscClass?.isSupplyTigerPsc || false })), null, 2)}`
  : "No matching publog items found for this opportunity's PSC code."}

---

## CONTACTS LINKED TO THIS OPPORTUNITY

${contacts.length > 0 ? JSON.stringify(contacts, null, 2) : "No contacts found for this opportunity."}

---

## ANALYSIS REQUESTED

Provide a comprehensive analysis covering:

1. **Fit Assessment:** How well does this opportunity align with SupplyTiger's NAICS codes, PSC codes, core competencies, and acquisition paths? Use the matching supply items data to assess whether SupplyTiger carries products in this PSC. Rate as HIGH / MEDIUM / LOW with reasoning.

2. **Competitive Landscape:** Based on the related awards data, who are the incumbents? What are typical award sizes? Is this a re-compete or new requirement?

3. **Agency Buying History:** How actively does this buying organization procure in SupplyTiger's product categories? What patterns emerge from the award data?

4. **Set-Aside & Eligibility:** Does SupplyTiger qualify for the set-aside type (if any)? Are there any eligibility concerns?

5. **Timeline Assessment:** How much time remains before the deadline? Is it sufficient for a quality response?

6. **Contact Strategy:** Based on the contacts listed, recommend an outreach approach. Who should be contacted and what should the messaging focus on?

7. **Pursuit Recommendation:** GO / NO-GO / CONDITIONAL recommendation with clear reasoning. If CONDITIONAL, state what additional information is needed.

8. **Next Steps:** If pursuing, what are the immediate action items?`;

  return {
    messages: [
      { role: "user", content: { type: "text", text: promptText } },
    ],
  };
}

// --- analyze-fulfillment ---
export async function buildFulfillmentPrompt(opportunityId) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      buyingOrganization: { select: { id: true, name: true, level: true } },
    },
  });

  if (!opportunity) return notFoundResult(opportunityId);

  const orConditions = [
    ...(opportunity.naicsCodes.length > 0
      ? [{ naicsCodes: { hasSome: opportunity.naicsCodes } }]
      : []),
    ...(opportunity.pscCode ? [{ pscCode: opportunity.pscCode }] : []),
  ];

  const [supplyTigerItems, opportunityItems, relatedAwards] = await Promise.all([
    prisma.nationalStockNumber.findMany({
      where: { pscCode: { in: COMPANY_PSC_CODES } },
      select: {
        nsn: true,
        niin: true,
        pscCode: true,
        itemName: true,
        commonName: true,
        pscClass: { select: { title: true, isSupplyTigerPsc: true } },
      },
      orderBy: { itemName: "asc" },
      take: 20,
    }),
    opportunity.pscCode
      ? prisma.nationalStockNumber.findMany({
          where: { pscCode: opportunity.pscCode },
          select: {
            nsn: true,
            niin: true,
            pscCode: true,
            itemName: true,
            commonName: true,
            pscClass: { select: { title: true, isSupplyTigerPsc: true } },
          },
          orderBy: { itemName: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
    opportunity.buyingOrganizationId
      ? prisma.award.findMany({
          where: {
            buyingOrganizationId: opportunity.buyingOrganizationId,
            OR: orConditions.length > 0 ? orConditions : [{}],
          },
          include: {
            recipient: { select: { name: true, uei: true } },
          },
          orderBy: { startDate: "desc" },
          take: 15,
        })
      : Promise.resolve([]),
  ]);

  const formatItems = (items) =>
    JSON.stringify(
      items.map((i) => ({
        nsn: i.nsn,
        niin: i.niin,
        psc: i.pscCode,
        itemName: i.itemName,
        commonName: i.commonName,
        pscTitle: i.pscClass?.title || null,
        isSupplyTigerPsc: i.pscClass?.isSupplyTigerPsc || false,
      })),
      null,
      2
    );

  const awardsJson = JSON.stringify(
    relatedAwards.map((a) => ({
      description: a.description,
      obligatedAmount: a.obligatedAmount ? Number(a.obligatedAmount) : null,
      startDate: a.startDate,
      endDate: a.endDate,
      recipient: a.recipient?.name || "Unknown",
      recipientUei: a.recipient?.uei || null,
      pscCode: a.pscCode,
      naicsCodes: a.naicsCodes,
    })),
    null,
    2
  );

  const companyJson = JSON.stringify(COMPANY_PROFILE, null, 2);
  const pscOverlap =
    opportunity.pscCode && COMPANY_PSC_CODES.includes(opportunity.pscCode);

  const promptText = `Perform a fulfillment capability analysis for SupplyTiger (Prime Printer Solution Inc) on the following federal procurement opportunity. Determine whether SupplyTiger should pursue a FULL submission, a PARTIAL/line-item bid, or NO-BID.

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

## SUPPLYTIGER COMPANY PROFILE

${companyJson}

---

## SUPPLYTIGER'S PRODUCT CATALOG (PSC ${COMPANY_PSC_CODES.join(", ")})

These are items SupplyTiger can supply from its core product lines:

${supplyTigerItems.length > 0 ? formatItems(supplyTigerItems) : "No publog items found for SupplyTiger's PSC codes. Assess capability based on the company profile above."}

---

## OPPORTUNITY'S SUPPLY ITEMS (PSC ${opportunity.pscCode || "N/A"})

${opportunity.pscCode
  ? opportunityItems.length > 0
    ? `These are federal supply items in the opportunity's PSC code. Items flagged as \`isSupplyTigerPsc: true\` overlap with SupplyTiger's product lines.\n\n${formatItems(opportunityItems)}`
    : "No publog items found for this opportunity's PSC code."
  : "This opportunity has no PSC code — assess fulfillment capability from the description and NAICS codes."}

${pscOverlap ? `\n> **Note:** The opportunity's PSC code (${opportunity.pscCode}) is one of SupplyTiger's core PSC codes. The two item sets above will overlap.\n` : ""}
---

## HISTORICAL AWARDS FROM THIS AGENCY

These show past awards by this buying organization in relevant NAICS/PSC categories. Look for evidence of partial awards, line-item contracts, or multiple-award patterns:

${relatedAwards.length > 0 ? awardsJson : "No related awards found for this buying organization."}

---

## ANALYSIS INSTRUCTIONS

Provide a fulfillment capability analysis with the following sections:

### 1. FULFILLMENT RECOMMENDATION

State **FULL**, **PARTIAL**, or **NO-BID** prominently at the top with a one-sentence rationale.

- **FULL** — SupplyTiger can fulfill the entire requirement. The opportunity's PSC/NAICS aligns with SupplyTiger's core capabilities, and the description does not include product categories outside confectionery/condiments.
- **PARTIAL** — SupplyTiger can fulfill specific line items or CLINs (e.g., the candy component of an MRE solicitation) but not the full scope. The opportunity bundles confectionery with other product categories.
- **NO-BID** — The opportunity falls entirely outside SupplyTiger's capabilities, or there is no viable path to participate even partially.

### 2. PSC & NAICS ALIGNMENT

Analyze how the opportunity's PSC code and NAICS codes compare to SupplyTiger's:
- SupplyTiger PSC codes: ${COMPANY_PSC_CODES.join(", ")}
- SupplyTiger NAICS codes: 424450, 424410, 424490
- Is confectionery the primary focus of this opportunity, a component, or not present at all?

### 3. CLIN / LINE-ITEM ANALYSIS

Parse the opportunity description for any CLIN (Contract Line Item Number) structure, line-item breakdown, or product category listing. For each identifiable line item or product category:
- State whether SupplyTiger can fulfill it
- Reference matching publog items from the catalog data above where applicable
- If no CLIN structure is evident in the description, note this and assess based on the overall description.

### 4. PRODUCT OVERLAP ASSESSMENT

Using the two publog item sets above (SupplyTiger's catalog vs. the opportunity's items):
- What proportion of the opportunity's items fall within SupplyTiger's product lines?
- Are there specific items SupplyTiger is well-positioned to supply?
- What items fall outside SupplyTiger's capabilities?

### 5. PARTIAL-BID FEASIBILITY

Assess whether the contracting entity is likely to accept a partial or line-item bid based on:
- **Solicitation type:** ${opportunity.type || "N/A"} — IDIQ and multiple-award contracts are more receptive to partial bids; firm-fixed-price single-award typically are not.
- **Description signals:** Does the description mention "multiple award," "IDIQ," "line items," or "partial offers"?
- **Set-aside type:** ${opportunity.setAside || "None"} — some set-asides may affect partial-bid viability.
- If the solicitation type is PRE_SOLICITATION or SOURCES_SOUGHT, note that it's too early to determine and recommend monitoring.

### 6. AGENCY PRECEDENT

Using the historical awards data above:
- Has this buying organization previously made partial or line-item awards?
- Have they awarded contracts in SupplyTiger's specific PSC codes?
- What do the award sizes and descriptions suggest about their procurement patterns?

### 7. TEAMING & SUBCONTRACTING STRATEGY

**Only include this section if the recommendation is PARTIAL.** Recommend the most viable path:
- **Prime with subcontractors** — SupplyTiger leads and subcontracts the non-confectionery CLINs to partners
- **Subcontractor role** — SupplyTiger partners as a sub to a prime contractor who covers the full scope
- **Teaming arrangement** — SupplyTiger forms a joint venture or mentor-protégé arrangement with a complementary vendor
- Consider which approach best fits the solicitation type, award size, and SupplyTiger's current acquisition paths (MICROPURCHASE, GSA, SUBCONTRACTING).

### 8. FULFILLABLE ITEMS SUMMARY

List the specific items, product categories, or CLINs that SupplyTiger can deliver. Reference publog NSN data where available. If the recommendation is FULL, summarize the complete scope. If NO-BID, state why no items are fulfillable.`;

  return {
    messages: [
      { role: "user", content: { type: "text", text: promptText } },
    ],
  };
}

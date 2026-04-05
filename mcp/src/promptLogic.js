import prisma from "./db.js";
import { COMPANY_PROFILE, COMPANY_PSC_CODES } from "./resources/companyProfile.js";
import { BID_TEMPLATE } from "./resources/bidTemplate.js";
import { getCidSpecsByPsc, CID_PSC_CODES } from "./resources/cidSpecs.js";

function buildCidSection(pscCode) {
  if (!pscCode || !CID_PSC_CODES.includes(pscCode)) return "";

  const specs = getCidSpecsByPsc(pscCode);
  if (specs.length === 0) return "";

  const specBlocks = specs.map((s) =>
    `### ${s.cid} — ${s.title} (${s.date})\nSupersedes: ${s.supersedes}\n\n${JSON.stringify({ scope: s.scope, classification: s.classification, salientCharacteristics: s.salientCharacteristics, analyticalRequirements: s.analyticalRequirements, qualityAssurance: s.qualityAssurance, packaging: s.packaging }, null, 2)}`
  ).join("\n\n---\n\n");

  return `
---

## COMMERCIAL ITEM DESCRIPTION SPECS (PSC ${pscCode})

These are structured USDA Commercial Item Description specifications for this opportunity's PSC code. CIDs define the government's minimum requirements for commercial items in this category — including scope, classification, salient characteristics, analytical requirements, QA provisions, and packaging. Reference these specs when assessing product compliance and drafting technical approaches.

${specBlocks}`;
}

function formatSize(bytes) {
  if (!bytes) return "Unknown size";
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMimeType(mimeType) {
  if (!mimeType) return "Unknown";
  return mimeType.replace(/^\./, "").toUpperCase();
}

const ATTACHMENT_MESSAGES_UNPARSED_ONLY = {
  bid: 'This opportunity has attached documents but none have been parsed yet. To make their content available for AI analysis, parse them from the SupplyTiger dashboard. The attachments may contain the SOW, CLIN structure, and evaluation criteria that would strengthen the draft.',
  fit: 'This opportunity has attached documents but none have been parsed yet. To make their content available for AI analysis, parse them from the SupplyTiger dashboard. The attachments may contain detailed requirements that affect the GO/NO-GO recommendation.',
  fulfillment: 'This opportunity has attached documents but none have been parsed yet. To make their content available for AI analysis, parse them from the SupplyTiger dashboard. The attachments may contain CLIN breakdowns, product specifications, and delivery requirements critical to the FULL/PARTIAL/NO-BID determination.',
};

const ATTACHMENT_MESSAGES_HAS_PARSED = {
  bid: 'IMPORTANT: Parsed attachments are available for this opportunity. Use the `get_attachment_text` tool to retrieve and analyze the parsed documents BEFORE drafting. Start with the parsed attachments — they likely contain the SOW, CLIN structure, and evaluation criteria critical to the bid response. For unparsed attachments, note them to the user and suggest parsing via the SupplyTiger dashboard.',
  fit: 'IMPORTANT: Parsed attachments are available for this opportunity. Use the `get_attachment_text` tool to retrieve and analyze the parsed documents BEFORE assessing fit. Start with the parsed attachments — they likely contain detailed requirements that affect the GO/NO-GO recommendation. For unparsed attachments, note them to the user and suggest parsing via the SupplyTiger dashboard.',
  fulfillment: 'IMPORTANT: Parsed attachments are available for this opportunity. Use the `get_attachment_text` tool to retrieve and analyze the parsed documents BEFORE assessing fulfillment. Start with the parsed attachments — they likely contain CLIN breakdowns, product specifications, and delivery requirements critical to the FULL/PARTIAL/NO-BID determination. For unparsed attachments, note them to the user and suggest parsing via the SupplyTiger dashboard.',
};

async function loadInboxContext(opportunityId) {
  const [inboxItem, queueEntry] = await Promise.all([
    prisma.inboxItem.findFirst({
      where: { opportunityId },
      select: { id: true, reviewStatus: true, attachmentScore: true, matchedSignals: true },
    }),
    prisma.scoringQueue.findFirst({
      where: { opportunityId, status: "PENDING" },
      select: { score: true, matchedSignals: true, expiresAt: true },
    }),
  ]);
  return { inboxItem, queueEntry };
}

function buildInboxContextSection(inboxItem, queueEntry) {
  if (!inboxItem && !queueEntry) return "";

  const source = inboxItem ? "INBOX (confirmed)" : "SCORING QUEUE (pending review)";
  const score = inboxItem?.attachmentScore ?? queueEntry?.score ?? null;
  const signals = (inboxItem?.matchedSignals ?? queueEntry?.matchedSignals ?? []);

  const nsnSignals = signals.filter((s) => s.type === "NSN_MATCH");
  const otherSignals = signals.filter((s) => s.type !== "NSN_MATCH");

  let section = `
---

## PIPELINE SCORING CONTEXT

This opportunity has been scored by SupplyTiger's automated pipeline and is currently tracked in the **${source}**.

- **Pipeline score:** ${score ?? "N/A"}
- **Review status:** ${inboxItem?.reviewStatus ?? (queueEntry ? "PENDING REVIEW" : "N/A")}`;

  if (nsnSignals.length > 0) {
    section += `\n- **Matched NSNs (found in solicitation documents):** ${nsnSignals.map((s) => s.value).join(", ")} — use these NSN values when referencing specific supply items`;
  }

  if (otherSignals.length > 0) {
    section += `\n- **Other matched signals:** ${otherSignals.map((s) => `${s.type}${s.value ? ` (${s.value})` : ""}`).join(", ")}`;
  }

  return section;
}

async function loadKeywords() {
  const [solicitationKeywords, industryDayKeywords] = await Promise.all([
    prisma.appConfig.findUnique({ where: { key: "solicitationKeywords" } }),
    prisma.appConfig.findUnique({ where: { key: "industryDayKeywords" } }),
  ]);
  return [
    ...(solicitationKeywords?.values ?? []),
    ...(industryDayKeywords?.values ?? []),
  ];
}

function buildAttachmentSection(attachments, analysisType, keywords = []) {
  if (!attachments || attachments.length === 0) return "";

  const parsed = attachments.filter((a) => a.parsedAt);
  const unparsed = attachments.filter((a) => !a.parsedAt);

  const lines = attachments.map((a) => {
    const status = a.parsedAt ? "Parsed" : "Not parsed";
    return `- ${a.name} (${formatMimeType(a.mimeType)}, ${formatSize(a.size)}) — ${status}`;
  });

  const message = parsed.length > 0
    ? ATTACHMENT_MESSAGES_HAS_PARSED[analysisType]
    : ATTACHMENT_MESSAGES_UNPARSED_ONLY[analysisType];

  const keywordSection = parsed.length > 0 && keywords.length > 0
    ? `\n\n**Priority keywords to search for in parsed attachments:** ${keywords.join(", ")}\nWhen analyzing parsed text, prioritize identifying references to these terms — they indicate product lines and categories directly relevant to SupplyTiger's capabilities.`
    : "";

  return `
---

## ATTACHMENTS AVAILABLE

This opportunity has ${attachments.length} attachment(s) (${parsed.length} parsed, ${unparsed.length} unparsed):
${lines.join("\n")}

> ${message}${keywordSection}`;
}

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
      attachments: {
        select: { id: true, name: true, mimeType: true, size: true, postedDate: true, parsedAt: true },
        orderBy: { attachmentOrder: "asc" },
      },
    },
  });

  if (!opportunity) return notFoundResult(opportunityId);

  const [companyJson, templateJson, keywords, { inboxItem, queueEntry }] = await Promise.all([
    Promise.resolve(JSON.stringify(COMPANY_PROFILE, null, 2)),
    Promise.resolve(JSON.stringify(BID_TEMPLATE, null, 2)),
    loadKeywords(),
    loadInboxContext(opportunityId),
  ]);
  const cidSection = buildCidSection(opportunity.pscCode);
  const attachmentSection = buildAttachmentSection(opportunity.attachments, "bid", keywords);
  const inboxContextSection = buildInboxContextSection(inboxItem, queueEntry);

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
${cidSection}
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

> **Tip:** You can use the \`search_publog_items\` tool to look up specific NSN/NIIN/FLIS items matching this opportunity's PSC code (${opportunity.pscCode || "N/A"}). This can help you reference exact product lines and item descriptions when drafting the technical approach.${inboxContextSection}${attachmentSection}`;

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
      attachments: {
        select: { id: true, name: true, mimeType: true, size: true, postedDate: true, parsedAt: true },
        orderBy: { attachmentOrder: "asc" },
      },
      _count: { select: { awards: true, contactLinks: true } },
    },
  });

  if (!opportunity) return notFoundResult(opportunityId);

  const [keywords, { inboxItem, queueEntry }] = await Promise.all([
    loadKeywords(),
    loadInboxContext(opportunityId),
  ]);
  const inboxContextSection = buildInboxContextSection(inboxItem, queueEntry);

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
    matchingItems = await prisma.federalLogisticsInformationSystem.findMany({
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

## MATCHING SUPPLY ITEMS (NSN/FLIS/Publog — PSC ${opportunity.pscCode || "N/A"})

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

8. **Next Steps:** If pursuing, what are the immediate action items?${inboxContextSection}${buildAttachmentSection(opportunity.attachments, "fit", keywords)}`;

  return {
    messages: [
      { role: "user", content: { type: "text", text: promptText } },
    ],
  };
}

// --- generate-outreach-draft ---
export async function buildOutreachDraftPrompt(inboxItemId) {
  const item = await prisma.inboxItem.findUnique({
    where: { id: inboxItemId },
    include: {
      opportunity: {
        select: {
          title: true,
          type: true,
          pscCode: true,
          naicsCodes: true,
          responseDeadline: true,
          description: true,
          solicitationNumber: true,
        },
      },
      buyingOrganization: { select: { name: true } },
      contactLinks: {
        include: {
          contact: { select: { fullName: true, email: true, phone: true, title: true } },
        },
      },
    },
    // also pull scoring fields directly off InboxItem
  });

  // Attach score fields (they're on InboxItem itself, already loaded above via findUnique)
  const attachmentScore = item?.attachmentScore ?? null;
  const matchedSignals = (item?.matchedSignals ?? []);
  const nsnSignals = matchedSignals.filter((s) => s.type === "NSN_MATCH");

  if (!item) {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `No inbox item found with ID "${inboxItemId}". Please verify the ID and try again.`,
          },
        },
      ],
    };
  }

  const opp = item.opportunity;

  // Pick primary contact, fall back to first
  const primaryLink =
    item.contactLinks.find((cl) => cl.type === "PRIMARY") ?? item.contactLinks[0];
  const primaryContact = primaryLink?.contact ?? null;

  const allContacts = item.contactLinks.map((cl) => ({
    fullName: cl.contact.fullName,
    email: cl.contact.email,
    phone: cl.contact.phone,
    title: cl.contact.title,
    role: cl.type,
  }));

  const companyJson = JSON.stringify(COMPANY_PROFILE, null, 2);

  const promptText = `You are drafting a professional outreach email on behalf of SupplyTiger (Prime Printer Solution Inc) in response to a federal procurement opportunity currently tracked in the SupplyTiger inbox.

---

## INBOX ITEM

- **Title:** ${item.title ?? opp?.title ?? "N/A"}
- **Review Status:** ${item.reviewStatus}
- **Acquisition Path:** ${item.acquisitionPath}
- **Deadline:** ${item.deadline ? new Date(item.deadline).toLocaleDateString() : opp?.responseDeadline ? new Date(opp.responseDeadline).toLocaleDateString() : "Not specified"}
- **Buying Organization:** ${item.buyingOrganization?.name ?? "N/A"}
- **Pipeline Score:** ${attachmentScore ?? "N/A"}${nsnSignals.length > 0 ? `\n- **Matched NSNs (from solicitation documents):** ${nsnSignals.map((s) => s.value).join(", ")} — reference these specific items in the email if relevant` : ""}

---

## OPPORTUNITY DETAILS

- **Solicitation #:** ${opp?.solicitationNumber ?? "N/A"}
- **Type:** ${opp?.type ?? "N/A"}
- **PSC Code:** ${opp?.pscCode ?? "N/A"}
- **NAICS Codes:** ${opp?.naicsCodes?.join(", ") ?? "None"}
- **Description:** ${opp?.description ?? "No description available"}

---

## CONTACTS FOR THIS OPPORTUNITY

${allContacts.length > 0 ? JSON.stringify(allContacts, null, 2) : "No contacts found for this inbox item."}

**Primary contact (for addressing the email):** ${primaryContact ? `${primaryContact.fullName ?? "N/A"} (${primaryContact.title ?? "N/A"}) — ${primaryContact.email ?? "no email"} / ${primaryContact.phone ?? "no phone"}` : "None identified — address to Contracting Officer"}

---

## SUPPLYTIGER COMPANY PROFILE (Sender)

${companyJson}

---

## INSTRUCTIONS

Draft a professional, concise outreach email:

1. **Address** the email to the primary contact by name and title. If no contact is available, address it to "Contracting Officer."

2. **Subject line** should reference the solicitation number (if available) and PSC code, e.g., "SupplyTiger — Interest in [Solicitation #] / PSC ${opp?.pscCode ?? "N/A"}"

3. **Opening paragraph** — introduce SupplyTiger briefly: who we are, our UEI, CAGE code, and that we are a registered SAM vendor.

4. **Capability statement** — state that SupplyTiger specializes in supplying PSC ${opp?.pscCode ?? "N/A"} items (Sugar, Confectionery, and related products), reference 1–2 core competencies from the company profile that align with this opportunity.

5. **Expression of interest** — express intent to respond to the solicitation. If the type is SOURCES_SOUGHT or PRE_SOLICITATION, ask how SupplyTiger can best position for the formal solicitation. If SOLICITATION, confirm readiness to submit.

6. **Call to action** — invite a brief call or ask if they can share any additional documents or Q&A that would help SupplyTiger prepare a competitive offer.

7. **Signature** — use the company contact from the profile (name, phone, email, website).

8. Keep the email under 250 words. Professional, direct, no filler.

Output the email in full, ready to send.`;

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
      attachments: {
        select: { id: true, name: true, mimeType: true, size: true, postedDate: true, parsedAt: true },
        orderBy: { attachmentOrder: "asc" },
      },
    },
  });

  if (!opportunity) return notFoundResult(opportunityId);

  const [keywords, { inboxItem, queueEntry }] = await Promise.all([
    loadKeywords(),
    loadInboxContext(opportunityId),
  ]);
  const inboxContextSection = buildInboxContextSection(inboxItem, queueEntry);

  const orConditions = [
    ...(opportunity.naicsCodes.length > 0
      ? [{ naicsCodes: { hasSome: opportunity.naicsCodes } }]
      : []),
    ...(opportunity.pscCode ? [{ pscCode: opportunity.pscCode }] : []),
  ];

  const [supplyTigerItems, opportunityItems, relatedAwards] = await Promise.all(
    [
      prisma.federalLogisticsInformationSystem.findMany({
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
        ? prisma.federalLogisticsInformationSystem.findMany({
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
    ],
  );

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
  const cidSection = buildCidSection(opportunity.pscCode);

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

${pscOverlap ? `\n> **Note:** The opportunity's PSC code (${opportunity.pscCode}) is one of SupplyTiger's core PSC codes. The two item sets above will overlap.\n` : ""}${cidSection}
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

List the specific items, product categories, or CLINs that SupplyTiger can deliver. Reference publog FLIS data where available. If the recommendation is FULL, summarize the complete scope. If NO-BID, state why no items are fulfillable.${inboxContextSection}${buildAttachmentSection(opportunity.attachments, "fulfillment", keywords)}`;

  return {
    messages: [
      { role: "user", content: { type: "text", text: promptText } },
    ],
  };
}

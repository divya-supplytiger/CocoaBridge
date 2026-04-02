import { AcquisitionPath } from "@prisma/client";
import prisma from "../config/db.js";
import { parseAttachmentContent } from "./parseAttachmentContent.js";
import { loadFilterConfig } from "./filterConfig.js";
import { buildInboxTitle } from "./inboxText.js";
import { CORE_PSC, CORE_NAICS, FLIS_PSC, classificationPrefixes, naicsPrefixes, solicitationTitleKeywords, MICROPURCHASE_THRESHOLD } from "./globals.js";

// NSN format: 4-digit FSC + 2-digit country code + 3-digit item number + 4-digit variant
const NSN_REGEX = /\b\d{4}-\d{2}-\d{3}-\d{4}\b/g;

/**
 * Score an opportunity against its attachments and metadata using FLIS-based signal matching.
 * Returns { score, matchedSignals, parsedTexts }.
 */
export async function scoreOpportunityForInbox(opportunity, flisItems, filterConfig) {
  const matchedSignals = [];
  let score = 0;

  const flisItemNames = flisItems.map(f => f.itemName?.toLowerCase()).filter(Boolean);
  const flisCommonNames = flisItems.map(f => f.commonName?.toLowerCase()).filter(Boolean);
  const flisNsnSet = new Set(flisItems.map(f => f.nsn));

  const metaText = [opportunity.title ?? "", opportunity.description ?? ""].join(" ");

  // NAICS match — base +2, additional +3 if core code
  if (
    opportunity.naicsCodes?.length > 0 &&
    opportunity.naicsCodes.some(code =>
      filterConfig.naicsCodes.some(prefix => code.startsWith(prefix))
    )
  ) {
    score += 2;
    matchedSignals.push({ type: "NAICS_MATCH", value: opportunity.naicsCodes[0], source: "opportunity" });

    if (opportunity.naicsCodes.some(code => CORE_NAICS.includes(code))) {
      score += 3;
      matchedSignals.push({ type: "NAICS_PRIORITY", value: opportunity.naicsCodes.find(c => CORE_NAICS.includes(c)), source: "opportunity" });
    }
  }

  // PSC match — base +2, additional +2 if core code
  if (opportunity.pscCode && filterConfig.pscPrefixes.some(p => opportunity.pscCode.startsWith(p))) {
    score += 2;
    matchedSignals.push({ type: "PSC_MATCH", value: opportunity.pscCode, source: "opportunity" });

    if (CORE_PSC.includes(opportunity.pscCode)) {
      score += 2;
      matchedSignals.push({ type: "PSC_PRIORITY", value: opportunity.pscCode, source: "opportunity" });
    }
  }

  // Agency award history
  if (opportunity.buyingOrganizationId) {
    const [historyCount, org] = await Promise.all([
      prisma.award.count({
        where: {
          buyingOrganizationId: opportunity.buyingOrganizationId,
          OR: [
            { naicsCodes: { hasSome: filterConfig.naicsCodes } },
            { pscCode: { in: filterConfig.pscPrefixes } },
          ],
        },
      }),
      prisma.buyingOrganization.findUnique({
        where: { id: opportunity.buyingOrganizationId },
        select: { name: true },
      }),
    ]);
    if (historyCount > 0) {
      score += 1;
      matchedSignals.push({ type: "AGENCY_HISTORY", value: org?.name ?? opportunity.buyingOrganizationId, source: "awards" });
    }
  }

  // Deadline signals
  if (opportunity.responseDeadline) {
    const daysUntil = Math.ceil((new Date(opportunity.responseDeadline) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 7) {
      score -= 1;
    } else if (daysUntil >= 14) {
      score += 1;
      matchedSignals.push({ type: "DEADLINE_FAVORABLE", value: `${daysUntil}d`, source: "opportunity" });
    }
  }

  // Keyword signals on title/description
  const metaLower = metaText.toLowerCase();
  const kwMatches = filterConfig.solicitationKeywords.filter(kw => metaLower.includes(kw.toLowerCase()));
  for (const kw of kwMatches) {
    score += 2;
    matchedSignals.push({ type: "KEYWORD", value: kw, source: "title" });
  }

  // Parse attachments
  const parsedTexts = [];
  if (opportunity.attachments?.length > 0) {
    for (const attachment of opportunity.attachments) {
      const result = await parseAttachmentContent(attachment);
      if (result.skip) continue;
      parsedTexts.push({ attachmentId: attachment.id, text: result.parsedText });
    }
  }

  const textsToScore = parsedTexts.length > 0
    ? parsedTexts.map(p => ({ source: "attachment", text: p.text }))
    : [{ source: "metadata", text: metaText }];

  let bestAttachmentScore = 0;
  let bestAttachmentSignals = [];

  for (const { source, text } of textsToScore) {
    const textLower = text.toLowerCase();
    let attachScore = 0;
    const attachSignals = [];

    const nsnMatches = [...new Set(text.match(NSN_REGEX) ?? [])];
    for (const nsn of nsnMatches) {
      const plain = nsn.replace(/-/g, "");
      if (flisNsnSet.has(nsn) || flisNsnSet.has(plain)) {
        attachScore += 5;
        attachSignals.push({ type: "NSN_MATCH", value: nsn, source });
      }
    }

    for (const name of flisItemNames) {
      if (textLower.includes(name)) {
        attachScore += 3;
        attachSignals.push({ type: "ITEM_NAME", value: name, source: "flis" });
        break;
      }
    }

    for (const name of flisCommonNames) {
      if (textLower.includes(name)) {
        attachScore += 2;
        attachSignals.push({ type: "COMMON_NAME", value: name, source: "flis" });
        break;
      }
    }

    if (filterConfig.pscPrefixes.some(psc => text.includes(psc))) {
      attachScore += 1;
      attachSignals.push({ type: "PSC_IN_TEXT", value: opportunity.pscCode, source });
    }

    for (const kw of filterConfig.solicitationKeywords) {
      if (textLower.includes(kw.toLowerCase()) && !metaLower.includes(kw.toLowerCase())) {
        attachScore += 2;
        attachSignals.push({ type: "KEYWORD", value: kw, source });
      }
    }

    if (attachScore > bestAttachmentScore) {
      bestAttachmentScore = attachScore;
      bestAttachmentSignals = attachSignals;
    }
  }

  score += bestAttachmentScore;
  matchedSignals.push(...bestAttachmentSignals);

  return { score, matchedSignals, parsedTexts };
}

export async function runScoreNewOpportunityAttachments() {
  const filterConfig = await loadFilterConfig(prisma);

  const [flisItems, opportunities] = await Promise.all([
    prisma.federalLogisticsInformationSystem.findMany({
      where: { pscCode: { in: FLIS_PSC } },
      select: { nsn: true, itemName: true, commonName: true },
    }),
    prisma.opportunity.findMany({
      where: {
        active: true,
        OR: [
          { pscCode: { in: filterConfig.pscPrefixes } },
          { naicsCodes: { hasSome: filterConfig.naicsCodes } },
        ],
        inboxItems: { none: {} },
        scoringQueue: { is: null },
      },
      include: { attachments: true },
    }),
  ]);

  const results = { scored: 0, autoAdmitted: 0, queued: 0, dropped: 0, errors: 0 };

  for (const opp of opportunities) {
    try {
      const { score, matchedSignals, parsedTexts } = await scoreOpportunityForInbox(opp, flisItems, filterConfig);

      if (score >= 4 && parsedTexts.length > 0) {
        const now = new Date();
        for (const { attachmentId, text } of parsedTexts) {
          await prisma.opportunityAttachment.update({
            where: { id: attachmentId },
            data: { parsedText: text, parsedAt: now },
          });
        }
      }

      if (score >= 8) {
        const inboxTitle = buildInboxTitle({
          entityLabel: "Opportunity",
          naicsCodes: opp.naicsCodes,
          pscCode: opp.pscCode,
          text: opp.title ?? null,
          maxLen: 160,
        });
        await prisma.inboxItem.create({
          data: {
            source: "SAM",
            acquisitionPath: AcquisitionPath.OPEN_MARKET,
            type: opp.type ?? "OTHER",
            tag: opp.tag ?? "GENERAL",
            title: inboxTitle,
            deadline: opp.responseDeadline ?? null,
            opportunityId: opp.id,
            buyingOrganizationId: opp.buyingOrganizationId ?? null,
            attachmentScore: score,
            matchedSignals,
          },
        });
        results.autoAdmitted += 1;
      } else if (score >= 4) {
        const createdAt = new Date();
        const fourteenDaysOut = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
        const expiresAt = opp.responseDeadline
          ? new Date(Math.min(fourteenDaysOut.getTime(), new Date(opp.responseDeadline).getTime()))
          : fourteenDaysOut;
        await prisma.scoringQueue.create({
          data: { opportunityId: opp.id, score, matchedSignals, expiresAt },
        });
        results.queued += 1;
      } else {
        results.dropped += 1;
      }

      results.scored += 1;
    } catch (err) {
      console.error(`scoreNewOpportunityAttachments: error on opp ${opp.id}:`, err.message);
      results.errors += 1;
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { results };
}

/**
 * Backfill attachmentScore + matchedSignals on InboxItems that have parsed attachment text
 * but no attachmentScore yet. Null-only — does not overwrite existing scores.
 */
export async function runBackfillInboxItemScores() {
  const [filterConfig, flisItems] = await Promise.all([
    loadFilterConfig(prisma),
    prisma.federalLogisticsInformationSystem.findMany({
      where: { pscCode: { in: FLIS_PSC } },
      select: { nsn: true, itemName: true, commonName: true },
    }),
  ]);

  const inboxItems = await prisma.inboxItem.findMany({
    where: {
      opportunityId: { not: null },
      attachmentScore: null,
      opportunity: {
        attachments: { some: { parsedText: { not: null } } },
      },
    },
    select: { id: true, opportunityId: true },
  });

  const opportunityIds = inboxItems.map(i => i.opportunityId).filter(Boolean);
  const opportunities = await prisma.opportunity.findMany({
    where: { id: { in: opportunityIds } },
    select: {
      id: true,
      title: true,
      description: true,
      naicsCodes: true,
      pscCode: true,
      responseDeadline: true,
      buyingOrganizationId: true,
      attachments: {
        select: { id: true, downloadUrl: true, size: true, mimeType: true, name: true, parsedText: true },
      },
    },
  });
  const oppMap = Object.fromEntries(opportunities.map(o => [o.id, o]));

  const results = { scored: 0, failed: 0 };
  const errors = [];

  for (const item of inboxItems) {
    const opp = oppMap[item.opportunityId];
    if (!opp) continue;
    try {
      const { score, matchedSignals } = await scoreOpportunityForInbox(opp, flisItems, filterConfig);
      await prisma.inboxItem.update({
        where: { id: item.id },
        data: { attachmentScore: score, matchedSignals },
      });
      results.scored++;
    } catch (err) {
      results.failed++;
      errors.push({ inboxItemId: item.id, error: err.message });
      console.error(`runBackfillInboxItemScores: error on inbox item ${item.id}:`, err.message);
    }
  }

  return { results, errors };
}

/**
 * Score an award against SupplyTiger domain signals.
 * Returns { score, matchedSignals } or { score, matchedSignals, skip: true } if below threshold.
 *
 * @param {object} award - Award record with { naicsCodes, pscCode, description, obligatedAmount, buyingOrganizationId }
 */
export async function scoreAwardForInbox(award) {
  const matchedSignals = [];
  let score = 0;

  // PSC match
  if (award.pscCode && classificationPrefixes.some(p => award.pscCode.startsWith(p))) {
    score += 2;
    matchedSignals.push({ type: "PSC_MATCH", value: award.pscCode, source: "award" });

    if (CORE_PSC.includes(award.pscCode)) {
      score += 2;
      matchedSignals.push({ type: "PSC_PRIORITY", value: award.pscCode, source: "award" });
    }
  }

  // NAICS match
  if (award.naicsCodes?.length > 0) {
    const matchedNaics = award.naicsCodes.find(code =>
      naicsPrefixes.some(prefix => code.startsWith(prefix))
    );
    if (matchedNaics) {
      score += 2;
      matchedSignals.push({ type: "NAICS_MATCH", value: matchedNaics, source: "award" });

      if (CORE_NAICS.includes(matchedNaics)) {
        score += 3;
        matchedSignals.push({ type: "NAICS_PRIORITY", value: matchedNaics, source: "award" });
      }
    }
  }

  // Keyword match on description (first match only)
  if (award.description) {
    const descLower = award.description.toLowerCase();
    const kw = solicitationTitleKeywords.find(k => descLower.includes(k.toLowerCase()));
    if (kw) {
      score += 2;
      matchedSignals.push({ type: "KEYWORD", value: kw, source: "award" });
    }
  }

  // Micropurchase boost
  if (award.obligatedAmount != null && Number(award.obligatedAmount) < MICROPURCHASE_THRESHOLD) {
    score += 2;
    matchedSignals.push({ type: "MICROPURCHASE", value: `$${Number(award.obligatedAmount).toFixed(0)}`, source: "award" });
  }

  // Agency award history
  if (award.buyingOrganizationId) {
    const [historyCount, org] = await Promise.all([
      prisma.award.count({
        where: {
          buyingOrganizationId: award.buyingOrganizationId,
          OR: [
            { naicsCodes: { hasSome: naicsPrefixes } },
            { pscCode: { in: classificationPrefixes } },
          ],
        },
      }),
      prisma.buyingOrganization.findUnique({
        where: { id: award.buyingOrganizationId },
        select: { name: true },
      }),
    ]);
    if (historyCount > 0) {
      score += 1;
      matchedSignals.push({ type: "AGENCY_HISTORY", value: org?.name ?? award.buyingOrganizationId, source: "awards" });
    }
  }

  if (score < 2) {
    return { score, matchedSignals, skip: true };
  }

  return { score, matchedSignals };
}

/**
 * Backfill attachmentScore + matchedSignals on award-linked InboxItems that have no score yet.
 * Null-only — does not overwrite existing scores, does not delete items below threshold.
 */
export async function runBackfillAwardInboxScores() {
  const inboxItems = await prisma.inboxItem.findMany({
    where: {
      awardId: { not: null },
      attachmentScore: null,
    },
    select: { id: true, awardId: true },
  });

  const awardIds = inboxItems.map(i => i.awardId).filter(Boolean);
  const awards = await prisma.award.findMany({
    where: { id: { in: awardIds } },
    select: { id: true, naicsCodes: true, pscCode: true, description: true, obligatedAmount: true, buyingOrganizationId: true },
  });
  const awardMap = Object.fromEntries(awards.map(a => [a.id, a]));

  const results = { scored: 0, failed: 0 };
  const errors = [];

  for (const item of inboxItems) {
    const award = awardMap[item.awardId];
    if (!award) continue;
    try {
      const { score, matchedSignals } = await scoreAwardForInbox(award);
      await prisma.inboxItem.update({
        where: { id: item.id },
        data: { attachmentScore: score, matchedSignals },
      });
      results.scored++;
    } catch (err) {
      results.failed++;
      errors.push({ inboxItemId: item.id, error: err.message });
      console.error(`runBackfillAwardInboxScores: error on inbox item ${item.id}:`, err.message);
    }
  }

  return { results, errors };
}

export async function runCleanupExpiredScoringQueue() {
  const deleted = await prisma.scoringQueue.deleteMany({
    where: {
      status: "PENDING",
      OR: [
        { expiresAt: { lt: new Date() } },
        { opportunity: { active: false } },
      ],
    },
  });
  return { count: deleted.count };
}

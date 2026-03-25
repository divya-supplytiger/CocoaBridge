import { SourceSystem, AcquisitionPath, OppTag } from "@prisma/client";
import { ENV } from "../config/env.js";
import axios from "axios";
import prisma from "../config/db.js";
import { runBackfillOpportunityAttachments } from "./db.controller.js";
import { inngestClient, emitInternalEventSafe } from "../config/inngestClient.js";
import { buildInboxSummary, buildInboxTitle } from "../utils/inboxText.js";
import {
  extractContact,
  extractOrganizationChain,
  extractTag,
  matchesOpportunityIndustryDay,
  matchesOpportunitySolicitation,
  stripHTML,
} from "../utils/extractSAM.js";

import { loadFilterConfig } from "../utils/filterConfig.js";

import {
  normalizeSamIndustryDay,
  normalizeOpportunity,
  normalizeSamAward,
  normalizeSamRecipient,
  toMMDDYYYY,
} from "../utils/normalizeSAM.js";

import { MICROPURCHASE_THRESHOLD, samGovIndustryDayPTypes, samGovSolicitationPTypes } from "../utils/globals.js";

/*
  Helper functions to fetch opportunities from SAM.gov with pagination

*/
// Pagination helper function
async function fetchAllOpportunitiesFromSam(baseQuery = {}, maxPages = 10) {
  const allOpportunities = [];
  let currentPage = 0; // SAM.gov pages start at 0
  let hasMorePages = true;
  const limit = 1000; // SAM.gov max limit

  while (hasMorePages && currentPage <= maxPages) {
    try {
      console.log(`Fetching page ${currentPage}`);

      const response = await axios.get(ENV.SAMGOV_BASE_URL, {
        params: {
          api_key: ENV.SAMGOV_API_KEY,
          limit,
          offset: currentPage, // offset = page number in SAM.gov
          ...baseQuery,
        },
        timeout: 75000,
      });

      const data = response.data;

      const opportunities =
        data.response?.opportunitiesData ||
        data?.opportunitiesData ||
        data?.opportunities ||
        data?.data ||
        [];

      allOpportunities.push(...opportunities);

      // Check if we should continue paginating
      hasMorePages = opportunities.length === limit; // If we got fewer than limit, we're done
      currentPage++;

      // Add a small delay to avoid hitting rate limits
      if (hasMorePages) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error fetching page ${currentPage}:`, error.message);
      hasMorePages = false; // Stop pagination on error

      // return partial data fetched so far
      return {
        opportunities: allOpportunities,
        pagination: {
          totalPagesFetched: currentPage - 1,
          totalOpportunities: allOpportunities.length,
          incomplete: true,
          error: error.message,
        },
      };
    }
  }

  console.log(
    `Fetched ${allOpportunities.length} total opportunities across ${currentPage - 1} pages`,
  );
  return {
    opportunities: allOpportunities,
    pagination: {
      totalPagesFetched: currentPage - 1,
      totalOpportunities: allOpportunities.length,
    },
  };
}

// Single page fetch helper
async function fetchOpportunitiesFromSamWithPagination(
  baseQuery = {},
  page = 1,
  limit = 1000,
) {
  const response = await axios.get(ENV.SAMGOV_BASE_URL, {
    params: {
      api_key: ENV.SAMGOV_API_KEY,
      limit: Math.min(limit, 1000), // Ensure we don't exceed SAM.gov limit
      offset: page, // offset = page number in SAM.gov
      ...baseQuery,
    },
    timeout: 75000,
  });

  const data = response.data;
  const opportunities =
    data.response?.opportunitiesData ||
    data?.opportunitiesData ||
    data?.opportunities ||
    data?.data ||
    [];

  return {
    opportunities,
    pagination: {
      page,
      limit: Math.min(limit, 1000),
      offset: page, // SAM.gov uses offset as page number
      count: opportunities.length,
      hasMore: opportunities.length === Math.min(limit, 1000),
    },
  };
}

/*
 HELPER FUNCTIONS TO UPSERT DATA INTO DB
 */

/**
 * Upsert organization hierarchy from SAM opportunity.
 * Returns the leaf (most specific) organization ID to link to the opportunity.
 */
async function upsertOrganizationChainFromSam(db, samOpportunity) {
  const rawChain = extractOrganizationChain(samOpportunity);

  if (rawChain.length === 0) return null;

  // SAM.gov sometimes repeats the same name at consecutive levels
  // (e.g. "VETERANS AFFAIRS, DEPARTMENT OF.VETERANS AFFAIRS, DEPARTMENT OF").
  // Deduplicate by name to prevent a record from becoming its own parent.
  const seenNames = new Set();
  const chain = rawChain.filter(({ name }) => seenNames.has(name) ? false : seenNames.add(name));

  let parentId = null;

  for (const org of chain) {
    // Use name as primary key since SAM codes can be inconsistent

    const upserted = await db.buyingOrganization.upsert({
      where: { name: org.name },
      update: {
        level: org.level,
        pathName: org.pathName,
        externalId: org.externalId, // Update code if it changed
        parentId,
      },
      create: {
        name: org.name,
        externalId: org.externalId,
        level: org.level,
        pathName: org.pathName,
        parentId,
      },
    });

    parentId = upserted.id;
  }

  // Return the leaf organization ID (last in chain)
  return parentId;
}

async function upsertContactsForOpportunity(
  db,
  samOpportunity,
  opportunityId,
  buyingOrganizationId = null,
) {
  const contacts = extractContact(samOpportunity);

  /* if (contacts.length === 0) {
    console.warn(
      `[ContactLink Debug] No contacts extracted for opportunity ${opportunityId}`,
    );
    return;
  } */

  // 1) Upsert/create the PERSON (Contact)
  // Dedupe strategy: Email-first
  // If email missing, fall back to phone, else just create.
  for (const c of contacts) {
    // Clean fields, remove spaces and treat "" as null
    const phone =
      c.phone && String(c.phone).trim() ? String(c.phone).trim() : null;

    try {
      let contact;
      if (c.email) {
        contact = await db.contact.upsert({
          where: { email: c.email },
          update: {
            fullName: c.fullName,
            // title and phone are user-editable — not overwritten by sync
          },
          create: {
            fullName: c.fullName,
            title: c.title,
            email: c.email,
            phone,
          },
        });
      } else {
        // No email, create new contact record
        contact = await db.contact.create({
          data: {
            fullName: c.fullName,
            title: c.title,
            email: c.email,
            phone,
          },
        });
      }

      // 2) Upsert/create the OpportunityContact link
      // Try by (opportunityId, externalId) first. If the create path
      // violates the separate (buyingOrganizationId, externalId) unique
      // constraint (same contact already linked to this buying org via a
      // different opportunity), fall back to updating that existing row.
      try {
        await db.contactLink.upsert({
          where: {
            opportunityId_externalId: {
              opportunityId,
              externalId: c.externalId,
            },
          },
          update: {
            type: c.type,
            source: c.source,
            contactId: contact.id,
            buyingOrganizationId,
          },
          create: {
            opportunityId,
            externalId: c.externalId,
            type: c.type,
            source: c.source,
            contactId: contact.id,
            buyingOrganizationId,
          },
        });
        // error handling for unique constraint violation on buyingOrganizationId + externalId
      } catch (upsertErr) {
        if (upsertErr?.code === "P2002" && buyingOrganizationId) {
          console.log(`[ContactLink] P2002 fallback: updating by buyingOrg+externalId for ${c.externalId}`);
          await db.contactLink.update({
            where: {
              buyingOrganizationId_externalId: {
                buyingOrganizationId,
                externalId: c.externalId,
              },
            },
            data: {
              opportunityId,
              type: c.type,
              source: c.source,
              contactId: contact.id,
            },
          });
        } else {
          throw upsertErr;
        }
      }
    } catch (error) {
      console.error("Error in upsertContactsForOpportunity controller: ", {
        opportunityId,
        externalId: c.externalId,
        email: c.email ?? null,
        phone: c.phone ?? null,
        message: error?.message ?? String(error),
      });
      // continue to next contact
    }
  }
}

async function upsertAwardAndRecipientFromSam(
  db,
  samOpportunity,
  opportunityId,
) {
  const award = normalizeSamAward(samOpportunity);
  if (!award) return null;

  const normalizedOpp = normalizeOpportunity(samOpportunity);

  const awardeeRaw = samOpportunity?.award?.awardee || null;
  const recipientNormalized = normalizeSamRecipient(awardeeRaw);

  // 1) Upsert Recipient (UEI)
  let recipient = null;

  if (recipientNormalized?.uei) {
    recipient = await db.recipient.upsert({
      where: { uei: recipientNormalized.uei },
      update: { name: recipientNormalized.name },
      create: {
        name: recipientNormalized.name,
        uei: recipientNormalized.uei,
      },
    });
  }
  const existingAward = await db.award.findUnique({
    where: { externalId: award.externalId },
    select: { id: true },
  });

  // 2) Upsert Award, link to Recipient
  const awardRecord = await db.award.upsert({
    where: { externalId: award.externalId },
    update: {
      obligatedAmount: award.obligatedAmount,
      startDate: award.startDate,
      endDate: award.endDate,
      naicsCodes: award.naicsCodes,
      pscCode: award.pscCode,
      opportunityId,
      recipientId: recipient ? recipient.id : null,
      source: SourceSystem.SAM,
    },
    create: {
      source: SourceSystem.SAM,
      externalId: award.externalId,
      obligatedAmount: award.obligatedAmount,
      startDate: award.startDate,
      endDate: award.endDate,
      naicsCodes: award.naicsCodes,
      pscCode: award.pscCode,
      opportunityId,
      recipientId: recipient ? recipient.id : null,
    },
  });

  const isMicrosaction = award.obligatedAmount && award.obligatedAmount < MICROPURCHASE_THRESHOLD;


  if (!existingAward) {
    const title = buildInboxTitle({
      entityLabel: "Award",
      naicsCodes: award.naicsCodes,
      pscCode: award.pscCode,
      // SAM awards don't have a distinct title; use the parent opportunity title.
      text: normalizedOpp?.title ?? null,
      maxLen: 160,
    });
    await emitInternalEventSafe("internal/award.upserted", {
      source: awardRecord.source,
      awardId: awardRecord.id,
      opportunityId,
      op: "CREATED",
      title,
      summary: buildInboxSummary(normalizedOpp?.description ?? null, 250),
      buyingOrganizationId: awardRecord.buyingOrganizationId ?? null,
      // Default acquisition path for awards until classification rules are added.
      acquisitionPath: isMicrosaction
        ? AcquisitionPath.MICROPURCHASE
        : AcquisitionPath.OPEN_MARKET,
    });
  }

  return awardRecord;
}

async function upsertOpportunityFromSam(prisma, opportunity, filterConfig = null) {
  const normalized = normalizeOpportunity(opportunity);

  if (!normalized.noticeId) {
    throw new Error("Missing noticeId for Opportunity upsert");
  }

  // Upsert organization hierarchy and get the leaf org ID
  const buyingOrganizationId = await upsertOrganizationChainFromSam(
    prisma,
    opportunity,
  );

  const data = {
    buyingOrganizationId,
    source: SourceSystem.SAM,

    // Always overwrite noticeId with the latest amendment's value
    noticeId: normalized.noticeId,
    solicitationNumber: normalized.solicitationNumber ?? null,
    title: normalized.title ?? null,
    type: normalized.type ?? null,
    tag: extractTag(opportunity, filterConfig),
    active: normalized.active,

    postedDate: normalized.postedDate,
    responseDeadline: normalized.responseDeadline,

    naicsCodes: normalized.naicsCodes ?? [],
    pscCode: normalized.pscCode ?? null,
    setAside: normalized.setAside ?? null,

    fullParentPathName: normalized.fullParentPathName ?? null,
    city: normalized.city ?? null,
    state: normalized.state ?? null,
    zip: normalized.zip ?? null,
    countryCode: normalized.countryCode ?? null,
    resourceLinks: normalized.resourceLinks ?? [],
  };

  // Upsert by solicitationNumber when available (handles amendments without
  // creating duplicate records or duplicate inbox items). Fall back to noticeId
  // for opportunities that have no solicitation number.
  let existingOpportunity;
  let opp;

  if (normalized.solicitationNumber) {
    existingOpportunity = await prisma.opportunity.findUnique({
      where: { solicitationNumber: normalized.solicitationNumber },
      select: { id: true },
    });
    opp = await prisma.opportunity.upsert({
      where: { solicitationNumber: normalized.solicitationNumber },
      update: data,
      create: { ...data, description: null },
    });
  } else {
    existingOpportunity = await prisma.opportunity.findUnique({
      where: { noticeId: normalized.noticeId },
      select: { id: true },
    });
    opp = await prisma.opportunity.upsert({
      where: { noticeId: normalized.noticeId },
      update: data,
      create: { ...data, description: null },
    });
  }

  // Build the pending inbox event (if new) so the caller can emit it
  // AFTER the surrounding transaction commits — avoids emitting events
  // for rows that get rolled back.
  let pendingInboxEvent = null;
  if (!existingOpportunity && opp.tag !== OppTag.INDUSTRY_DAY) {
    const title = buildInboxTitle({
      entityLabel: "Opportunity",
      naicsCodes: normalized.naicsCodes,
      pscCode: normalized.pscCode,
      text: normalized.title ?? null,
      maxLen: 160,
    });

    pendingInboxEvent = {
      source: opp.source,
      opportunityId: opp.id,
      op: "CREATED",
      title,
      summary: buildInboxSummary(normalized.description ?? null, 250),
      type: opp.type ?? "OTHER",
      tag: opp.tag ?? "GENERAL",
      buyingOrganizationId: opp.buyingOrganizationId ?? null,
      acquisitionPath: AcquisitionPath.OPEN_MARKET,
    };
  }

  if (opportunity?.award?.number) {
    await upsertAwardAndRecipientFromSam(prisma, opportunity, opp.id);
  }

  await upsertContactsForOpportunity(
    prisma,
    opportunity,
    opp.id,
    buyingOrganizationId,
  );

  opp.pendingInboxEvent = pendingInboxEvent;
  return opp;
}

async function upsertIndustryDayFromSam(prisma, opportunity, opportunityId) {
  const normalized = normalizeSamIndustryDay(opportunity);

  if (!normalized.externalId) {
    throw new Error("Missing externalId (noticeId/id)");
  }

  // Ensure the opportunityId unique constraint won't be violated
  if (opportunityId) {
    await prisma.industryDay.updateMany({
      where: {
        opportunityId,
        externalId: { not: normalized.externalId },
      },
      data: { opportunityId: null },
    });
  }

  const data = {
    source: normalized.source, // SourceSystem.SAM
    title: normalized.title,
    summary: normalized.summary,
    location: normalized.location,
    eventDate: normalized.eventDate,
    host: normalized.host,
    status: normalized.status,
    opportunityId: opportunityId ?? null,
  };

  return prisma.industryDay.upsert({
    where: { externalId: normalized.externalId },
    update: data,
    create: {
      externalId: normalized.externalId,
      ...data,
    },
  });
}

export async function runCurrentOpportunitiesSyncFromSam({
  pType,
  fromDate,
  toDate,
  fullSync = "true",
  maxPages = 10,
  page,
  limit = 1000,
  cacheInDB = "true",
} = {}) {
  const filterConfig = await loadFilterConfig(prisma);

  const now = new Date();
  const lookbackDays = 7;
  const lookbackDate = new Date(now);
  lookbackDate.setUTCDate(lookbackDate.getUTCDate() - lookbackDays);

  // SAM.gov only accepts one ptype per request, so resolve to an array
  const resolvedPTypes = pType
    ? String(pType).split(",").map((p) => p.trim()).filter(Boolean)
    : [...samGovSolicitationPTypes];

  let resolvedFromDate;
  let resolvedToDate;

  if (fromDate && toDate) {
    resolvedFromDate = fromDate;
    resolvedToDate = toDate;
  } else if (fromDate && !toDate) {
    const computedToDate = new Date(fromDate);
    computedToDate.setUTCDate(computedToDate.getUTCDate() + lookbackDays);
    resolvedFromDate = fromDate;
    resolvedToDate = toMMDDYYYY(computedToDate);
  } else if (!fromDate && toDate) {
    const computedFromDate = new Date(toDate);
    computedFromDate.setUTCDate(computedFromDate.getUTCDate() - lookbackDays);
    resolvedFromDate = toMMDDYYYY(computedFromDate);
    resolvedToDate = toDate;
  } else {
    resolvedFromDate = toMMDDYYYY(lookbackDate);
    resolvedToDate = toMMDDYYYY(now);
  }

  // Loop over each ptype individually (SAM.gov only allows one at a time)
  let allOpportunities = [];
  const paginationByPType = {};

  for (const singlePType of resolvedPTypes) {
    const samQuery = {
      ptype: singlePType,
      postedFrom: resolvedFromDate,
      postedTo: resolvedToDate,
    };

    let opportunities = [];
    let paginationInfo = null;

    if (String(fullSync) === "true") {
      const result = await fetchAllOpportunitiesFromSam(
        samQuery,
        Number.parseInt(maxPages, 10) || 10,
      );
      opportunities = Array.isArray(result?.opportunities)
        ? result.opportunities
        : [];
      paginationInfo = result?.pagination ?? null;
    } else if (page !== undefined) {
      const paged = await fetchOpportunitiesFromSamWithPagination(
        samQuery,
        Number.parseInt(page, 10) || 1,
        Number.parseInt(limit, 10) || 1000,
      );
      opportunities = Array.isArray(paged?.opportunities)
        ? paged.opportunities
        : [];
      paginationInfo = paged?.pagination ?? null;
    } else {
      const response = await axios.get(ENV.SAMGOV_BASE_URL, {
        params: {
          api_key: ENV.SAMGOV_API_KEY,
          ...samQuery,
        },
        timeout: 75000,
      });

      const data = response.data;
      opportunities =
        data.response?.opportunitiesData ||
        data?.opportunitiesData ||
        data?.opportunities ||
        data?.data ||
        [];
    }

    if (!Array.isArray(opportunities)) {
      opportunities = [];
    }

    allOpportunities.push(...opportunities);
    paginationByPType[singlePType] = paginationInfo;

    // Small delay between ptype requests to avoid rate limits
    if (resolvedPTypes.indexOf(singlePType) < resolvedPTypes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  const filteredOpportunities = allOpportunities.filter((opp) =>
    matchesOpportunitySolicitation(opp, filterConfig),
  );

  let attempted = 0;
  let upserted = 0;
  let skipped = 0;
  const errors = [];

  if (String(cacheInDB) === "true") {
    for (const opp of filteredOpportunities) {
      attempted += 1;

      if (!opp?.noticeId && !opp?.id) {
        skipped += 1;
        continue;
      }

      try {
        const savedOpp = await upsertOpportunityFromSam(prisma, opp, filterConfig);
        if (savedOpp.pendingInboxEvent) {
          await emitInternalEventSafe("internal/opportunity.upserted", savedOpp.pendingInboxEvent);
        }
        upserted += 1;
      } catch (e) {
        skipped += 1;
        errors.push({
          noticeId: opp?.noticeId ?? opp?.id ?? null,
          title: opp?.title ?? null,
          message: e?.message ?? String(e),
        });
      }
    }
  }

  return {
    query: {
      ptypes: resolvedPTypes,
      postedFrom: resolvedFromDate,
      postedTo: resolvedToDate,
    },
    meta: {
      pulled: allOpportunities.length,
      returned: filteredOpportunities.length,
      paginationByPType,
      partial: Object.values(paginationByPType).some(p => p?.incomplete),
    },
    db: {
      attempted,
      upserted,
      skipped,
      errors,
    },
  };
}

export const syncCurrentOpportunitiesFromSam = async (req, res) => {
  try {
    const {
      pType,
      fromDate,
      toDate,
      fullSync = "true",
      maxPages = 10,
      page,
      limit = 1000,
      cacheInDB = "true",
    } = req.query;

    const syncResult = await runCurrentOpportunitiesSyncFromSam({
      pType,
      fromDate,
      toDate,
      fullSync,
      maxPages,
      page,
      limit,
      cacheInDB,
    });

    return res.status(200).json({
      ok: true,
      ...syncResult,
    });
  } catch (error) {
    console.error("Error in syncCurrentOpportunitiesFromSam controller:", error);
    return res.status(500).json({
      ok: false,
      error: "Internal Server Error -- failed to sync current SAM opportunities",
      details: error?.response?.data ?? error?.message,
    });
  }
};

export async function runIndustryDaySyncFromSam({
  pType,
  fromDate,
  toDate,
  fullSync = "true",
  maxPages = 10,
  page,
  limit = 1000,
  cacheInDB = "true",
} = {}) {
  const filterConfig = await loadFilterConfig(prisma);

  const now = new Date();
  const lookbackDays = 30; // Industry days are posted further in advance than solicitations

  const lookbackDate = new Date(now);
  lookbackDate.setUTCDate(lookbackDate.getUTCDate() - lookbackDays);

  const resolvedPTypes = pType
    ? String(pType).split(",").map((p) => p.trim()).filter(Boolean)
    : [...samGovIndustryDayPTypes];

  let resolvedFromDate;
  let resolvedToDate;

  if (fromDate && toDate) {
    resolvedFromDate = fromDate;
    resolvedToDate = toDate;
  } else if (fromDate && !toDate) {
    const computedToDate = new Date(fromDate);
    computedToDate.setUTCDate(computedToDate.getUTCDate() + lookbackDays);
    resolvedFromDate = fromDate;
    resolvedToDate = toMMDDYYYY(computedToDate);
  } else if (!fromDate && toDate) {
    const computedFromDate = new Date(toDate);
    computedFromDate.setUTCDate(computedFromDate.getUTCDate() - lookbackDays);
    resolvedFromDate = toMMDDYYYY(computedFromDate);
    resolvedToDate = toDate;
  } else {
    resolvedFromDate = toMMDDYYYY(lookbackDate);
    resolvedToDate = toMMDDYYYY(now);
  }

  let allOpportunities = [];
  const paginationByPType = {};

  for (const singlePType of resolvedPTypes) {
    const samQuery = {
      ptype: singlePType,
      postedFrom: resolvedFromDate,
      postedTo: resolvedToDate,
    };

    let opportunities = [];
    let paginationInfo = null;

    if (String(fullSync) === "true") {
      const result = await fetchAllOpportunitiesFromSam(
        samQuery,
        Number.parseInt(maxPages, 10) || 10,
      );
      opportunities = Array.isArray(result?.opportunities) ? result.opportunities : [];
      paginationInfo = result?.pagination ?? null;
    } else if (page !== undefined) {
      const paged = await fetchOpportunitiesFromSamWithPagination(
        samQuery,
        Number.parseInt(page, 10) || 1,
        Number.parseInt(limit, 10) || 1000,
      );
      opportunities = Array.isArray(paged?.opportunities) ? paged.opportunities : [];
      paginationInfo = paged?.pagination ?? null;
    } else {
      const response = await axios.get(ENV.SAMGOV_BASE_URL, {
        params: { api_key: ENV.SAMGOV_API_KEY, ...samQuery },
        timeout: 75000,
      });
      const data = response.data;
      opportunities =
        data.response?.opportunitiesData ||
        data?.opportunitiesData ||
        data?.opportunities ||
        data?.data ||
        [];
    }

    if (!Array.isArray(opportunities)) opportunities = [];

    allOpportunities.push(...opportunities);
    paginationByPType[singlePType] = paginationInfo;

    if (resolvedPTypes.indexOf(singlePType) < resolvedPTypes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  const filteredOpportunities = allOpportunities.filter((opp) =>
    matchesOpportunityIndustryDay(opp, filterConfig),
  );

  let attempted = 0;
  let upserted = 0;
  let skipped = 0;
  const errors = [];

  if (String(cacheInDB) === "true") {
    for (const opp of filteredOpportunities) {
      attempted += 1;

      if (!opp?.noticeId && !opp?.id) {
        skipped += 1;
        continue;
      }

      try {
        let pendingInboxEvent = null;
        await prisma.$transaction(
          async (tx) => {
            const savedOpp = await upsertOpportunityFromSam(tx, opp, filterConfig);
            pendingInboxEvent = savedOpp.pendingInboxEvent;
            await upsertIndustryDayFromSam(tx, opp, savedOpp.id);
          },
          { timeout: 30000 },
        );
        // Emit only after the transaction commits successfully
        if (pendingInboxEvent) {
          await emitInternalEventSafe("internal/opportunity.upserted", pendingInboxEvent);
        }
        upserted += 1;
      } catch (e) {
        skipped += 1;
        errors.push({
          noticeId: opp?.noticeId ?? opp?.id ?? null,
          title: opp?.title ?? null,
          message: e?.message ?? String(e),
        });
      }
    }
  }

  return {
    query: {
      ptypes: resolvedPTypes,
      postedFrom: resolvedFromDate,
      postedTo: resolvedToDate,
    },
    meta: {
      pulled: allOpportunities.length,
      returned: filteredOpportunities.length,
      paginationByPType,
      partial: Object.values(paginationByPType).some(p => p?.incomplete),
    },
    db: { attempted, upserted, skipped, errors },
  };
}

export const getIndustryDayOpportunitiesFromSam = async (req, res) => {
  try {
    const query = req.query;

    // pull out pagination params
    const {
      pType,
      fullSync,
      maxPages = 10,
      page,
      limit = 1000,
      cacheInDB = "true", // Default to caching in DB
      ...samQuery
    } = query;

    // SAM.gov only accepts one ptype per request, so resolve to an array
    const resolvedPTypes =
      typeof pType === "string" && pType.trim()
        ? pType.split(",").map((p) => p.trim()).filter(Boolean)
        : [...samGovIndustryDayPTypes];

    let allOpportunities = [];
    let paginationByPType = {};

    for (const singlePType of resolvedPTypes) {
      const resolvedSamQuery = {
        ...samQuery,
        ptype: singlePType,
      };

      let opportunities = [];
      let paginationInfo = null;

      // Fetch opportunities with pagination support
      if (fullSync === "true") {
        // Fetch all pages (for complete sync)
        const result = await fetchAllOpportunitiesFromSam(
          resolvedSamQuery,
          parseInt(maxPages),
        );
        opportunities = result.opportunities || [];
        paginationInfo = result.pagination;
      } else if (page !== undefined) {
        // Single page fetch
        const result = await fetchOpportunitiesFromSamWithPagination(
          resolvedSamQuery,
          parseInt(page) || 1, // SAM.gov pages start at 1, not 0
          parseInt(limit),
        );
        opportunities = result.opportunities;
        paginationInfo = result.pagination;
      } else {
        // Legacy single request (no pagination)
        const response = await axios.get(ENV.SAMGOV_BASE_URL, {
          params: {
            api_key: ENV.SAMGOV_API_KEY,
            ...resolvedSamQuery,
          },
          timeout: 75000,
        });

        const data = response.data;

        opportunities =
          data.response?.opportunitiesData ||
          data?.opportunitiesData ||
          data?.opportunities ||
          data?.data ||
          [];
      }

      if (!Array.isArray(opportunities)) {
        opportunities = [];
      }

      allOpportunities.push(...opportunities);
      paginationByPType[singlePType] = paginationInfo;

      // Small delay between ptype requests to avoid rate limits
      if (resolvedPTypes.indexOf(singlePType) < resolvedPTypes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    const filteredOpportunities = allOpportunities.filter(
      matchesOpportunityIndustryDay,
    );

    let attempted = 0;
    let upserted = 0;
    let skipped = 0;
    const errors = [];

    // Only upsert to DB if cacheInDB is true
    if (cacheInDB === "true") {
      for (const opp of filteredOpportunities) {
        attempted += 1;

        if (!opp?.noticeId && !opp?.id) {
          skipped += 1;
          continue;
        }

        try {
          let pendingInboxEvent = null;
          await prisma.$transaction(
            async (tx) => {
              const savedOpp = await upsertOpportunityFromSam(tx, opp);
              pendingInboxEvent = savedOpp.pendingInboxEvent;
              await upsertIndustryDayFromSam(tx, opp, savedOpp.id);
            },
            { timeout: 30000 },
          );
          if (pendingInboxEvent) {
            await emitInternalEventSafe("internal/opportunity.upserted", pendingInboxEvent);
          }
          upserted += 1;
        } catch (e) {
          skipped += 1;
          errors.push({
            noticeId: opp?.noticeId ?? opp?.id ?? null,
            title: opp?.title ?? null,
            message: e?.message ?? String(e),
          });
        }
      }
    }

    const responseData = {
      meta: {
        pulled: allOpportunities.length,
        returned: filteredOpportunities.length,
        paginationByPType,
      },
      db: { attempted, upserted, skipped, errors },
      data: {
        opportunities: filteredOpportunities,
      },
    };
    return res.status(200).json(responseData);
  } catch (error) {
    console.error(
      "Error in getIndustryDayOpportunitiesFromSam controller:",
      error,
    );

    const detailsRaw = error?.response?.data;
    const details =
      typeof detailsRaw === "string"
        ? detailsRaw.slice(0, 2000)
        : (detailsRaw ?? null);

    return res.status(500).json({
      error: "Internal Server Error -- failed to fetch data from SAM.gov",
      details,
    });
  }
};

export const getOpportunityDescriptionFromSam = async (req, res) => {
  let noticeId;
  try {
    ({ noticeId } = req.params);
    if (!noticeId) {
      return res.status(400).json({ error: "Missing noticeId parameter" });
    }

    const description = await fetchOpportunityDescriptionFromSam(noticeId);

    const filteredDescription = stripHTML(description);
    // and capture details that match our criteria

    // Cache the description in the database
    // given that caching is requested
    const cacheInDB = req.query.cacheInDB === "true";
    if (cacheInDB && description) {
      await prisma.opportunity.updateMany({
        where: { noticeId },
        data: { description: filteredDescription },
      });
    }

    return res.status(200).json({
      noticeId,
      description: filteredDescription,
      cached: cacheInDB && description ? true : false,
    });
  } catch (error) {
    console.error(
      "Error in getOpportunityDescriptionFromSam controller:",
      error,
    );

    if (error.response?.status === 404) {
      return res.status(404).json({
        error: "Opportunity not found",
        noticeId,
      });
    }

    return res.status(500).json({
      error:
        "Internal Server Error -- failed to fetch description from SAM.gov",
      details: error?.response?.data,
    });
  }
};

export const fetchOpportunityDescriptionFromSam = async (noticeId) => {
  const response = await axios.get(ENV.SAMGOV_NOTICE_DESC_URL, {
    params: {
      api_key: ENV.SAMGOV_API_KEY,
      noticeid: noticeId,
    },
    timeout: 30000,
  });

  return response.data?.description || null;
};

export const backfillNullOpportunityDescriptionsFromSam = async (req, res) => {
  try {
    const query = req?.query ?? {};
    const payload = await runBackfillNullOpportunityDescriptionsFromSam({
      cacheInDB: query.cacheInDB !== "false",
      limit: query.limit,
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error(
      "Error in backfillNullOpportunityDescriptionsFromSam controller:",
      error,
    );

    return res.status(500).json({
      ok: false,
      error:
        "Internal Server Error -- failed to backfill null opportunity descriptions",
      details: error?.response?.data ?? error?.message,
    });
  }
};

export const backfillOpportunityAttachments = async (req, res) => {
  try {
    const payload = await runBackfillOpportunityAttachments({
      limit: req?.query?.limit,
    });
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Error in backfillOpportunityAttachments controller:", error);
    return res.status(500).json({
      ok: false,
      error: "Internal Server Error -- failed to backfill attachment metadata",
      details: error?.message,
    });
  }
};

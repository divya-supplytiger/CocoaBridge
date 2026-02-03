import { SourceSystem } from "@prisma/client";
import { ENV } from "../config/env.js";
import axios from "axios";
import prisma from "../config/db.js";
import { extractContact, stripHTML } from "../utils/extractSAM.js";

import {
  matchesOpportunityIndustryDay,
  matchesOpportunitySolicitation,
  matchesOpportunityHistorical,
} from "../utils/extractSAM.js";

import {
  normalizeSamIndustryDay,
  normalizeOpportunity,
  normalizeSamHistoricalOpportunity,
  normalizeSamAward,
  normalizeSamRecipient,
} from "../utils/normalizeSAM.js";

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

// TODO: Get organization and upsert as well

async function upsertContactsForOpportunity(db, samOpportunity, opportunityId) {
  const contacts = extractContact(samOpportunity);
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
            title: c.title,
            phone,
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
      // Prisma will generate a compound unique selector name:
      // opportunityId_externalId (based on @@unique([opportunityId, externalId]))
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
        },
        create: {
          opportunityId,
          externalId: c.externalId,
          type: c.type,
          source: c.source,
          contactId: contact.id,
        },
      });
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

  const awardeeRaw = samOpportunity?.award?.awardee || null;
  const recipientNormalized = normalizeSamRecipient(awardeeRaw);

  // 1) Upsert Recipient (UEI)
  let recipient = null;

  if (recipientNormalized) {
    if (recipientNormalized.uei) {
      recipient = await db.recipient.upsert({
        where: { uei: recipientNormalized.uei },
        update: { name: recipientNormalized.name },
        create: {
          name: recipientNormalized.name,
          uei: recipientNormalized.uei,
        },
      });
    }
  }
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
  return awardRecord;
}

async function upsertHistoricalOpportunityFromSam(prisma, opportunity) {
  const normalized = normalizeSamHistoricalOpportunity(opportunity);

  if (!normalized.noticeId) {
    throw new Error("Missing noticeId for Historical Opportunity upsert");
  }

  const data = {
    source: SourceSystem.SAM,

    noticeId: normalized.noticeId,
    solicitationNumber: normalized.solicitationNumber ?? null,
    title: normalized.title ?? null,
    type: normalized.type ?? null,
    tag: normalized.tag,
    active: normalized.active,

    description: normalized.description ?? null,

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
  };

  // with historical opportunities, we do not upsert contacts
  const opp = await prisma.opportunity.upsert({
    where: { noticeId: normalized.noticeId },
    update: data,
    create: data,
  });

  if (opportunity?.award?.number) {
    // IMPORTANT: don't upsert if you don't have a unique key
    if (!opportunity?.award?.number) return null;
    await upsertAwardAndRecipientFromSam(prisma, opportunity, opp.id);
  }
  return opp;
}

async function upsertOpportunityFromSam(prisma, opportunity) {
  const normalized = normalizeOpportunity(opportunity);

  if (!normalized.noticeId) {
    throw new Error("Missing noticeId for Opportunity upsert");
  }

  const data = {
    source: SourceSystem.SAM,

    noticeId: normalized.noticeId,
    solicitationNumber: normalized.solicitationNumber ?? null,
    title: normalized.title ?? null,
    type: normalized.type ?? null,
    tag: normalized.tag,
    active: normalized.active,

    description: normalized.description ?? null,

    // Dates (still derived from raw SAM payload)
    postedDate: normalized.postedDate,
    responseDeadline: normalized.responseDeadline,

    // Classification
    naicsCodes: normalized.naicsCodes ?? [],
    pscCode: normalized.pscCode ?? null,
    setAside: normalized.setAside ?? null,

    // Org / office metadata
    fullParentPathName: normalized.fullParentPathName ?? null,
    city: normalized.city ?? null,
    state: normalized.state ?? null,
    zip: normalized.zip ?? null,
    countryCode: normalized.countryCode ?? null,
  };

  const opp = await prisma.opportunity.upsert({
    where: { noticeId: normalized.noticeId },
    update: data,
    create: data,
  });

  // NEW: Upsert award and recipient associated with this opportunity
  if (opportunity?.award?.number) {
    // IMPORTANT: don't upsert if you don't have a unique key
    if (!opportunity?.award?.number) return null;
    await upsertAwardAndRecipientFromSam(prisma, opportunity, opp.id);
  }

  // Upsert contacts associated with this opportunity
  await upsertContactsForOpportunity(prisma, opportunity, opp.id);
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

/* ROUTER FUNCTIONS */
export const getCurrentOpportunitiesFromSam = async (req, res) => {
  try {
    const query = req.query;

    // pull out pagination params and cache options
    const {
      fullSync,
      maxPages = 10,
      page,
      limit = 1000,
      cacheInDB = "true", // Default to caching in DB
      ...samQuery
    } = query;

    let opportunities = [];
    let paginationInfo = null;

    // Fetch opportunities with pagination support
    if (fullSync === "true") {
      // Fetch all pages (for complete sync)
      const result = await fetchAllOpportunitiesFromSam(
        samQuery,
        parseInt(maxPages),
      );
      opportunities = result.opportunities || [];
      paginationInfo = result.pagination;
    } else if (page !== undefined) {
      // Single page fetch
      const result = await fetchOpportunitiesFromSamWithPagination(
        samQuery,
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

    // Ensure opportunities is always an array
    if (!Array.isArray(opportunities)) {
      console.warn(
        "Opportunities is not an array:",
        typeof opportunities,
        opportunities,
      );
      opportunities = [];
    }

    const filteredOpportunities = opportunities.filter(
      matchesOpportunitySolicitation,
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
          await upsertOpportunityFromSam(prisma, opp);
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
        pulled: opportunities.length,
        returned: filteredOpportunities.length,
        ...(paginationInfo && { pagination: paginationInfo }),
      },
      db: { attempted, upserted, skipped, errors },
      data: {
        opportunities: filteredOpportunities,
      },
    };

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error in getCurrentOpportunitiesFromSam controller:", error);
    res.status(500).json({
      error: "Internal Server Error -- failed to fetch data from SAM.gov",
      details: error?.response?.data,
    });
  }
};

export const getHistoricalOpportunitiesFromSam = async (req, res) => {
  try {
    const query = req.query;

    const {
      fullSync,
      maxPages = 10,
      page,
      limit = 1000,
      cacheInDB = "true", // Default to caching in DB
      ...samQuery
    } = query;

    let opportunities = [];
    let paginationInfo = null;

    // fetch opportunities with pagination support
    if (fullSync === "true") {
      // fetch all  pages (for complete sync)
      const result = await fetchAllOpportunitiesFromSam(
        samQuery,
        parseInt(maxPages),
      );
      opportunities = result.opportunities || [];
      paginationInfo = result.pagination;
    } else if (page !== undefined) {
      // single page fetch

      const result = await fetchOpportunitiesFromSamWithPagination(
        samQuery,
        parseInt(page) || 1, // SAM.gov pages start at 1, not 0
        parseInt(limit),
      );
      opportunities = result.opportunities;
      paginationInfo = result.pagination;
    } else {
      // legacy single request (no pagination)
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

    // Ensure opportunities is always an array
    if (!Array.isArray(opportunities)) {
      console.warn(
        "Opportunities is not an array:",
        typeof opportunities,
        opportunities,
      );
      opportunities = [];
    }

    const filteredOpportunities = opportunities.filter(
      matchesOpportunityHistorical,
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
          await upsertHistoricalOpportunityFromSam(prisma, opp);
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
        pulled: opportunities.length,
        returned: filteredOpportunities.length,
        ...(paginationInfo && { pagination: paginationInfo }),
      },
      db: { attempted, upserted, skipped, errors },
      data: {
        opportunities: filteredOpportunities,
      },
    };

    return res.status(200).json(responseData);
  } catch (error) {
    console.error(
      "Error in getHistoricalOpportunitiesFromSam controller:",
      error,
    );
    res.status(500).json({
      error: "Internal Server Error -- failed to fetch data from SAM.gov",
      details: error?.response?.data,
    });
  }
};

export const getIndustryDayOpportunitiesFromSam = async (req, res) => {
  try {
    const query = req.query;

    // pull out pagination params
    const {
      fullSync,
      maxPages = 10,
      page,
      limit = 1000,
      cacheInDB = "true", // Default to caching in DB
      ...samQuery
    } = query;

    let opportunities = [];
    let paginationInfo = null;

    // Fetch opportunities with pagination support
    if (fullSync === "true") {
      // Fetch all pages (for complete sync)
      const result = await fetchAllOpportunitiesFromSam(
        samQuery,
        parseInt(maxPages),
      );
      opportunities = result.opportunities || [];
      paginationInfo = result.pagination;
    } else if (page !== undefined) {
      // Single page fetch
      const result = await fetchOpportunitiesFromSamWithPagination(
        samQuery,
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
          ...samQuery,
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
    }

    // Ensure opportunities is always an array
    if (!Array.isArray(opportunities)) {
      console.warn(
        "Opportunities is not an array:",
        typeof opportunities,
        opportunities,
      );
      opportunities = [];
    }

    const filteredOpportunities = opportunities.filter(
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
          await prisma.$transaction(
            async (tx) => {
              const savedOpp = await upsertOpportunityFromSam(tx, opp);
              await upsertIndustryDayFromSam(tx, opp, savedOpp.id);
            },
            { timeout: 30000 },
          );
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
        pulled: opportunities.length,
        returned: filteredOpportunities.length,
        ...(paginationInfo && { pagination: paginationInfo }),
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
  try {
    const { noticeId } = req.params;
    if (!noticeId) {
      return res.status(400).json({ error: "Missing noticeId parameter" });
    }

    const response = await axios.get(ENV.SAMGOV_NOTICE_DESC_URL, {
      params: {
        api_key: ENV.SAMGOV_API_KEY,
        noticeid: noticeId,
      },
      timeout: 30000,
    });

    const data = response.data;
    const description = response.data?.description || null;

    // TODO: implement description parsing logic (remove html, etc.)
    const filteredDescription = stripHTML(description);
    // and capture details that match our criteria

    // Cache the description in the database
    // given that caching is requested
    const cacheInDB = req.query.cache === "true";
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

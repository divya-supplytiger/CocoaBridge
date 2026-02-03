import axios from "axios";
import { ENV } from "../config/env.js";
import prisma from "../config/db.js";
import {
  normalizeUSASpendingAward,
  extractRecipientFromUSASpending,
  extractAwardingOrgsFromUSASpending,
} from "../utils/normalizeUSASpending.js";

/* 
HELPER FUNCTIONS TO UPSERT DATA
*/

/**
 * Upserts a Recipient based on UEI (unique) or creates by name.
 * @param {Object} recipientData - { name, uei, website }
 * @returns {Promise<string|null>} The recipient ID or null
 */
const upsertRecipient = async (recipientData) => {
  if (!recipientData) return null;

  const { name, uei, website } = recipientData;

  // If we have a UEI, use it for deduplication
  if (uei) {
    const recipient = await prisma.recipient.upsert({
      where: { uei },
      update: { name, website },
      create: { name, uei, website },
    });
    return recipient.id;
  }

  // No UEI - try to find by exact name match, or create new
  try {
    const newReceipient = await prisma.recipient.create({
      data: { name, website },
    });
    return newReceipient.id;
  } catch (error) {
    // handle unique constraint violation for name
    if (error.code === "P2002") {
      const existing = await prisma.recipient.findFirst({
        where: { name },
      });
      return existing?.id ?? null;
    }
    throw error;
  }
};

/**
 * Upserts the awarding organization chain from USASpending.
 * Returns the leaf (most specific) org ID.
 *
 * @param {Array} orgs - Array from extractAwardingOrgsFromUSASpending
 * @returns {Promise<string|null>} The leaf org ID or null
 */
const upsertBuyingOrgChainFromUSASpending = async (orgs) => {
  if (!orgs || orgs.length === 0) return null;

  let parentId = null;

  for (const org of orgs) {
    const { name, externalId, level } = org;

    // Try to find by externalId first (most reliable), then by name+parentId
    let existingOrg = null;

    if (externalId) {
      existingOrg = await prisma.buyingOrganization.findFirst({
        where: { externalId },
      });
    }

    if (!existingOrg) {
      existingOrg = await prisma.buyingOrganization.findFirst({
        where: { name, parentId },
      });
    }

    if (existingOrg) {
      // Update if needed
      await prisma.buyingOrganization.update({
        where: { id: existingOrg.id },
        data: {
          level,
          parentId,
          externalId: externalId || existingOrg.externalId,
        },
      });
      parentId = existingOrg.id;
    } else {
      // Create new org
      const newOrg = await prisma.buyingOrganization.create({
        data: {
          name,
          externalId,
          level,
          parentId,
        },
      });
      parentId = newOrg.id;
    }
  }

  return parentId; // Return the leaf org ID
};

/**
 * Upserts an Award from USASpending data.
 *
 * @param {Object} usaAward - Raw award from USASpending API
 * @returns {Promise<Object>} The upserted award
 */
export const upsertAwardFromUSASpending = async (usaAward) => {
  // 1. Normalize the award
  const normalized = normalizeUSASpendingAward(usaAward);
  if (!normalized || !normalized.externalId) {
    console.warn("Skipping award - no externalId:", usaAward?.["Award ID"]);
    return null;
  }

  // 2. Upsert Recipient
  const recipientData = extractRecipientFromUSASpending(usaAward);
  const recipientId = await upsertRecipient(recipientData);

  // 3. Upsert BuyingOrganization chain
  const orgs = extractAwardingOrgsFromUSASpending(usaAward);
  const buyingOrganizationId = await upsertBuyingOrgChainFromUSASpending(orgs);

  // 4. Upsert the Award
  const award = await prisma.award.upsert({
    where: { externalId: normalized.externalId },
    update: {
      ...normalized,
      recipientId,
      buyingOrganizationId,
    },
    create: {
      ...normalized,
      recipientId,
      buyingOrganizationId,
    },
  });

  return award;
};

/**
 * Bulk upsert awards from USASpending search results.
 *
 * @param {Array} awards - Array of raw awards from USASpending API
 * @returns {Promise<Object>} Summary of upserts
 */
export const bulkUpsertAwardsFromUSASpending = async (awards) => {
  const results = {
    total: awards.length,
    successful: 0,
    failed: 0,
    errors: [],
  };

  for (const usaAward of awards) {
    try {
      await upsertAwardFromUSASpending(usaAward);
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        awardId: usaAward?.["Award ID"] || "unknown",
        error: error.message,
      });
      console.error(
        `Failed to upsert award ${usaAward?.["Award ID"]}:`,
        error.message,
      );
    }
  }

  return results;
};
// Default fields needed for award sync and display
const DEFAULT_AWARD_FIELDS = [
  "Award ID",
  "Recipient Name",
  "Award Amount",
  "Description",
  "Contract Award Type",
  "Recipient UEI",
  "Recipient Location",
  "Primary Place of Performance",
  "def_codes",
  "Awarding Agency",
  "Awarding Sub Agency",
  "Start Date",
  "End Date",
  "NAICS",
  "PSC",
  "recipient_id",
  "prime_award_recipient_id",
  "awarding_agency_id",
  "agency_slug",
  "generated_internal_id",
];

export const searchAwardFromUsaspending = async (req, res) => {
  try {
    const response = await axios.post(
      `${ENV.USASPENDING_BASE_URL}/api/v2/search/spending_by_award/`,
      {
        ...req.body,
        limit: req.body.limit ?? 100,
        page: req.body.page ?? 1,
        fields: req.body.fields ?? DEFAULT_AWARD_FIELDS,
        spending_level: req.body.spending_level ?? "awards",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 20000,
      },
    );

    const results = response.data.results || [];

    return res.status(200).json({
      meta: {
        total: response.data.page_metadata?.total || 0,
        returned: results.length,
        page: response.data.page_metadata?.page || 1,
        hasNext: response.data.page_metadata?.hasNext || false,
      },
      data: results,
    });
  } catch (error) {
    console.error(
      "Error in searchAwardFromUsaspending controller:",
      error?.response?.data || error,
    );

    res.status(500).json({
      error: "Failed to fetch data from USAspending",
      details: error?.response?.data,
    });
  }
};

export const searchCountFromUsaspending = async (req, res) => {
  try {
    const response = await axios.post(
      `${ENV.USASPENDING_BASE_URL}/api/v2/search/spending_by_award_count/`,
      {
        ...req.body,
        spending_level: req.body.spending_level ?? "awards",
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
      },
    );
    return res.status(200).json({
      meta: {
        contracts: response.data.results?.contracts || 0,
        grants: response.data.results?.grants || 0,
        direct_payments: response.data.results?.direct_payments || 0,
        loans: response.data.results?.loans || 0,
        other: response.data.results?.other || 0,
      },
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error in searchCountFromUsaspending controller:",
      error?.response?.data || error,
    );
    res.status(500).json({
      error: "Failed to fetch data from USAspending",
      details: error?.response?.data,
    });
  }
};

export const searchCategoryFromUsaspending = async (req, res) => {
  try {
    const category = req.body.category;
    if (!category) {
      return res.status(400).json({ error: "Category is required" });
    }

    const url = `${ENV.USASPENDING_BASE_URL}/api/v2/search/spending_by_category/${category}/`;

    // remove category from payload since using category-in-path
    const { category: _omit, ...payload } = req.body;

    const response = await axios.post(
      url,
      {
        ...payload,
        limit: req.body.limit ?? 100,
        page: req.body.page ?? 1,
        spending_level: req.body.spending_level ?? "awards",
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
      },
    );
    const results = response.data.results || [];

    return res.status(200).json({
      meta: {
        category,
        total: response.data.page_metadata?.total || 0,
        returned: results.length,
        page: response.data.page_metadata?.page || 1,
      },
      data: results,
    });
  } catch (error) {
    console.error(
      "Error in searchCategoryFromUsaspending controller:",
      error?.response?.data || error,
    );
    res.status(500).json({
      error: "Failed to fetch data from USAspending",
      details: error?.response?.data,
    });
  }
};

export const getAwardByIdFromUsaspending = async (req, res) => {
  try {
    const { award_id } = req.params;
    const response = await axios.get(
      `${ENV.USASPENDING_BASE_URL}/api/v2/awards/${award_id}/`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 20000,
      },
    );
    return res.status(200).json({
      meta: {
        awardId: award_id,
        found: !!response.data,
      },
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error in getAwardByIdFromUSAspending controller:",
      error?.response?.data || error,
    );
    res.status(500).json({
      error: "Failed to fetch data from USAspending",
      details: error?.response?.data,
    });
  }
};

/**
 * Syncs awards from USASpending API to the database.
 * Fetches awards based on the request body filters and upserts them.
 *
 * Supports pagination via `page` and `limit` params.
 * Set `syncAll: true` to paginate through all results.
 */
export const syncAwardsFromUsaspending = async (req, res) => {
  try {
    const { syncAll = false, limit = 100, page = 1, ...filters } = req.body;

    let currentPage = page;
    let attempted = 0;
    let upserted = 0;
    let skipped = 0;
    const errors = [];
    const allAwards = [];
    let totalRecords = 0;
    let hasMore = true;

    do {
      console.log(`Fetching USASpending awards page ${currentPage}...`);

      const response = await axios.post(
        `${ENV.USASPENDING_BASE_URL}/api/v2/search/spending_by_award/`,
        {
          ...filters,
          limit,
          page: currentPage,
          fields: filters.fields ?? DEFAULT_AWARD_FIELDS,
          spending_level: filters.spending_level ?? "awards",
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        },
      );

      const awards = response.data.results || [];
      totalRecords = response.data.page_metadata?.total || 0;

      if (awards.length === 0) {
        hasMore = false;
        break;
      }

      // Collect awards for response
      allAwards.push(...awards);

      console.log(
        `Processing ${awards.length} awards (page ${currentPage}, total: ${totalRecords})...`,
      );

      const results = await bulkUpsertAwardsFromUSASpending(awards);
      attempted += results.total;
      upserted += results.successful;
      skipped += results.failed;
      errors.push(...results.errors);

      // Check if there are more pages
      const processedSoFar = currentPage * limit;
      hasMore = syncAll && processedSoFar < totalRecords;
      currentPage++;

      // Safety limit to prevent infinite loops
      if (currentPage > 1000) {
        console.warn("Reached page limit of 1000, stopping sync.");
        break;
      }
    } while (hasMore);

    return res.status(200).json({
      message: "Sync completed",
      meta: {
        total: totalRecords,
        returned: allAwards.length,
        pagesProcessed: currentPage - page,
        hasMore,
      },
      db: {
        attempted,
        upserted,
        skipped,
        errors: errors.slice(0, 5), // Limit errors in response
      },
      data: allAwards,
    });
  } catch (error) {
    console.error(
      "Error in syncAwardsFromUsaspending controller:",
      error?.response?.data || error,
    );
    res.status(500).json({
      error: "Failed to sync awards from USAspending",
      details: error?.response?.data || error.message,
    });
  }
};

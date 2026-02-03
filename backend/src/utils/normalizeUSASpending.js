import { SourceSystem, OrgLevel } from "@prisma/client";

/**
 * Extracts and combines description from USASpending award.
 * Combines Description, NAICS.description, and PSC.description with proper spacing.
 *
 * @param {Object} usaAward - Raw award from USASpending API
 * @returns {string|null} Combined description or null
 */
export const extractDescriptionFromUSASpending = (usaAward) => {
  if (!usaAward) return null;

  const parts = [];

  // Main description (clean up leading numbers/special chars)
  const mainDesc = usaAward.Description || usaAward.description || null;
  if (mainDesc) {
    // Remove leading patterns like "4561727484!" or similar
    const cleaned = String(mainDesc)
      .replace(/^[\d!]+/, "")
      .trim();
    if (cleaned) parts.push(cleaned);
  }

  // NAICS description
  const naicsDesc = usaAward.NAICS?.description || null;
  if (naicsDesc) {
    parts.push(`NAICS: ${naicsDesc}`);
  }

  // PSC description
  const pscDesc = usaAward.PSC?.description || null;
  if (pscDesc) {
    parts.push(`PSC: ${pscDesc}`);
  }

  return parts.length > 0 ? parts.join(" | ") : null;
};

/**
 * Normalizes a USASpending award object into the shape needed for our Award model.
 *
 * @param {Object} usaAward - Raw award from USASpending API
 * @returns {Object} Normalized award data
 */
export const normalizeUSASpendingAward = (usaAward) => {
  if (!usaAward) return null;

  // Use generated_internal_id as the unique externalId (most reliable for deduplication)
  const externalId =
    usaAward.generated_internal_id || usaAward["Award ID"] || null;

  // Parse dates
  const startDate = usaAward["Start Date"]
    ? new Date(usaAward["Start Date"])
    : null;
  const endDate = usaAward["End Date"] ? new Date(usaAward["End Date"]) : null;

  // Parse obligated amount - handle currency format like "$1,234.56"
  let obligatedAmount = null;
  if (usaAward["Award Amount"] != null) {
    const amountStr = String(usaAward["Award Amount"]).replace(/[$,]/g, "");
    const parsed = parseFloat(amountStr);
    if (!isNaN(parsed)) {
      obligatedAmount = parsed;
    }
  }

  // NAICS and PSC
  const naicsCodes = usaAward.NAICS?.code ? [usaAward.NAICS.code] : [];
  const pscCode = usaAward.PSC?.code || null;

  const description = extractDescriptionFromUSASpending(usaAward);

  return {
    source: SourceSystem.USASPENDING,
    externalId,
    description,
    naicsCodes,
    pscCode,
    obligatedAmount,
    startDate,
    endDate,
  };
};

/**
 * Extracts recipient data from a USASpending award.
 *
 * @param {Object} usaAward - Raw award from USASpending API
 * @returns {Object|null} Recipient data or null if not available
 */
export const extractRecipientFromUSASpending = (usaAward) => {
  if (!usaAward) return null;

  // USASpending uses "Recipient Name" and "Recipient UEI" field names
  const name =
    usaAward["Recipient Name"] ||
    usaAward.Recipient ||
    usaAward.recipient_name ||
    null;
  const uei = usaAward["Recipient UEI"] || usaAward.recipient_uei || null;

  // If no name and no UEI, we can't create a recipient
  if (!name && !uei) return null;

  return {
    name: name || "Unknown Recipient",
    uei,
    website: null, // USASpending doesn't provide this
  };
};

/**
 * Extracts the awarding organization chain from a USASpending award.
 * Returns an array of orgs from parent (Agency) to child (Sub Agency).
 *
 * @param {Object} usaAward - Raw award from USASpending API
 * @returns {Array} Array of organization objects in parent-to-child order
 */
export const extractAwardingOrgsFromUSASpending = (usaAward) => {
  if (!usaAward) return [];

  const orgs = [];

  // Parent: Awarding Agency
  const agencyName = usaAward["Awarding Agency"];
  const agencyId = usaAward.awarding_agency_id
    ? String(usaAward.awarding_agency_id)
    : null;

  if (agencyName) {
    orgs.push({
      name: agencyName,
      externalId: agencyId,
      level: OrgLevel.AGENCY,
    });
  }

  // Child: Awarding Sub Agency
  const subAgencyName = usaAward["Awarding Sub Agency"];
  if (subAgencyName && subAgencyName !== agencyName) {
    // Generate a pseudo-externalId for sub-agency if not available
    // This helps with deduplication
    const subAgencyExternalId = agencyId ? `${agencyId}-SUB` : null;

    orgs.push({
      name: subAgencyName,
      externalId: subAgencyExternalId,
      level: OrgLevel.SUBAGENCY,
    });
  }

  return orgs;
};

/**
 * Extracts location data from a USASpending award's primary place of performance.
 *
 * @param {Object} usaAward - Raw award from USASpending API
 * @returns {Object|null} Location data or null
 */
export const extractPerformanceLocationFromUSASpending = (usaAward) => {
  const location = usaAward?.["Primary Place of Performance"];
  if (!location) return null;

  return {
    city: location.city_name || null,
    state: location.state_code || null,
    stateFullName: location.state_name || null,
    zip: location.zip5 || null,
    countryCode: location.location_country_code || null,
    county: location.county_name || null,
  };
};

/**
 * Extracts recipient location from USASpending award.
 *
 * @param {Object} usaAward - Raw award from USASpending API
 * @returns {Object|null} Location data or null
 */
export const extractRecipientLocationFromUSASpending = (usaAward) => {
  const location = usaAward?.["Recipient Location"];
  if (!location) return null;

  return {
    city: location.city_name || null,
    state: location.state_code || null,
    stateFullName: location.state_name || null,
    zip: location.zip5 || null,
    countryCode: location.location_country_code || null,
    county: location.county_name || null,
    address1: location.address_line1 || null,
    address2: location.address_line2 || null,
    address3: location.address_line3 || null,
  };
};

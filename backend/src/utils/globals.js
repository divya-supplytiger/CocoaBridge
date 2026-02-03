// Global constants and variables that pertain to SUPPLY TIGER

import { link } from "fs";

// Used for SAM.gov filtering
export const industryDayTitleKeywords = [
  "industry day",
  "industry-day",
  "outreach",
  "conference",
  "vendor day",
  "open house",
  "industry engagement",
  "industry briefing",
  "industry forum",
  "pre-solicitation conference",
  "presolicitation conference",
  "site visit",
  "industry event",
];

export const solicitationTitleKeywords = [
  "snack",
  "food",
  "subsistence",
  "rations",
  "morale",
  "candy",
  "chocolate",
  "concessions",
  "pantry",
  "nutrition",
  "meals",
  "consumables",
  "ceremony",
  "exercise",
  "sugar",
  "MWR",
  "family",
  "appreciation",
  "holiday",
  "supplies",
  "commodities",
  "miscellaneous",
  "consumables",
  "support items",
  "general items",
];

// NAICS and Classification codes relevant to Supply Tiger's focus
export const classificationPrefixes = ["89"]; // 89: Subsistence
export const naicsPrefixes = ["445", "424", "311340"]; // 445: Grocery Stores, 424: Grocery and Related Product Merchant Wholesalers, 311340: Nonchocolate Confectionery Manufacturing
export const validCountries = ["USA", "US"];

// USASpending filter presets for common searches
export const usaSpendingFilters = {
  searchByAward: {
    link: "/api/v2/search/spending_by_award/",
    allAwards: {
      filters: {
        time_period: [
          {
            start_date: "2021-01-01",
            end_date: "2026-09-30",
          },
        ],
        award_type_codes: ["A", "B", "C"],
        naics_codes: ["424450", "424490"],
        psc_codes: {
          require: [["Product", "89", "8925"]],
        },
      },
      page: 1,
      limit: 100,
      sort: "Award Amount",
      order: "desc",
      auditTrail: "Results Table - Spending by award search",
      fields: [
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
      ],
      spending_level: "awards",
    },
    microtransactions: {
      filters: {
        time_period: [
          {
            start_date: "2021-01-01",
            end_date: "2026-09-30",
          },
        ],
        award_amounts: [{ upper_bound: 10000 }],
        award_type_codes: ["A", "B", "C"],
        naics_codes: ["424450", "424490", "455219", "445292"],
        psc_codes: {
          require: [["Product", "89", "8925"]],
        },
      },
      page: 1,
      limit: 100,
      sort: "Award Amount",
      order: "desc",
      auditTrail: "Results Table - Spending by award search",
      fields: [
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
      ],
      spending_level: "awards",
    },
    smallBusiness: {
      filters: {
        time_period: [
          {
            start_date: "2007-10-01",
            end_date: "2026-09-30",
          },
        ],
        award_type_codes: ["A", "B", "C"],
        naics_codes: ["424450", "424490"],
        recipient_type_names: ["small_business"],
        psc_codes: {
          require: [["Product", "89", "8925"]],
        },
      },
      page: 1,
      limit: 100,
      sort: "Award Amount",
      order: "desc",
      auditTrail: "Results Table - Spending by award search",
      fields: [
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
      ],

      spending_level: "awards",
    },
  },
};

export const usaSpendingPresetNames = [
  "allAwards",
  "microtransactions",
  "smallBusiness",
];

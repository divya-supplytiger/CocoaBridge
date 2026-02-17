// Global constants and variables that pertain to SUPPLY TIGER

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
  "snacks",
  "food",
  "foods",
  "subsistence",
  "rations",
  "morale",
  "candy",
  "nuts",
  "PB&J",
  "chocolate",
  "concessions",
  "confectionery",
  "gratuities",
  "pantry",
  "meals",
  "meal",
  "consumables",
  "ceremony",
  "exercise",
  "sugar",
  "MWR",
  "family",
  "appreciation",
  "holiday",
  "commodities",
  "miscellaneous",
  "consumables",
  "choc"
];

// NAICS and Classification codes relevant to Supply Tiger's focus
export const classificationPrefixes = ["89"]; // 89: Subsistence (8925)
export const naicsPrefixes = [
  "311340",
  "311351",
  "311352",
  "311999",
  "311991",
  "311812",
  "424410",
  "424450",
  "424490",
  "445292",
  "455219",
]; // 445: Grocery Stores, 424: Grocery and Related Product Merchant Wholesalers, 311340: Nonchocolate Confectionery Manufacturing
export const validCountries = ["USA", "US"];

// USASpending filter presets for common searches
const UPPER_BOUND = 10000000;
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
        naics_codes: naicsPrefixes,
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
        award_amounts: [{ upper_bound: UPPER_BOUND }],
        award_type_codes: ["A", "B", "C"],
        naics_codes: naicsPrefixes,
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
        naics_codes: naicsPrefixes,
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

export const samGovIndustryDayPTypes = ["s", "r", "p", "k"];
export const samGovSolicitationPTypes = ["r", "k", "o", "s", "p"];

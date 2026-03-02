import {
  solicitationTitleKeywords,
  naicsPrefixes,
  classificationPrefixes,
  industryDayTitleKeywords,
} from "./globals.js";

// All valid AppConfig keys — active lists + word banks
export const VALID_CONFIG_KEYS = [
  "solicitationKeywords",
  "naicsCodes",
  "pscPrefixes",
  "industryDayKeywords",
  "solicitationKeywordsBank",
  "naicsCodesBank",
  "pscPrefixesBank",
  "industryDayKeywordsBank",
];

// Seeds used on first deploy if AppConfig table is empty
const SEEDS = {
  solicitationKeywords: solicitationTitleKeywords,
  naicsCodes: naicsPrefixes,
  pscPrefixes: classificationPrefixes,
  industryDayKeywords: industryDayTitleKeywords,
  solicitationKeywordsBank: [],
  naicsCodesBank: [],
  pscPrefixesBank: [],
  industryDayKeywordsBank: [],
};

/**
 * Load the four active filter arrays from the DB.
 * On first call with an empty AppConfig table, seeds each key from globals.js.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @returns {Promise<{ solicitationKeywords: string[], naicsCodes: string[], pscPrefixes: string[], industryDayKeywords: string[] }>}
 */
export async function loadFilterConfig(db) {
  // Seed any missing keys from globals.js
  for (const [key, seed] of Object.entries(SEEDS)) {
    const existing = await db.appConfig.findUnique({ where: { key } });
    if (!existing) {
      await db.appConfig.create({ data: { key, values: seed } });
    }
  }

  const [solicitationKeywords, naicsCodes, pscPrefixes, industryDayKeywords] =
    await Promise.all([
      db.appConfig.findUnique({ where: { key: "solicitationKeywords" } }),
      db.appConfig.findUnique({ where: { key: "naicsCodes" } }),
      db.appConfig.findUnique({ where: { key: "pscPrefixes" } }),
      db.appConfig.findUnique({ where: { key: "industryDayKeywords" } }),
    ]);

  return {
    solicitationKeywords: solicitationKeywords?.values ?? [],
    naicsCodes: naicsCodes?.values ?? [],
    pscPrefixes: pscPrefixes?.values ?? [],
    industryDayKeywords: industryDayKeywords?.values ?? [],
  };
}

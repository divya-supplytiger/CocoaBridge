import prisma from "../config/db.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTEXT_DIR = resolve(__dirname, "../../../.agent/context/PublogInfoContext");

const SUPPLY_TIGER_PSC_CODES = ["8925", "8950"];

const PSC_CODES = ["8925", "8950", "8970"];

// ---------- H2 HTML parsing ----------

function parseH2Html(html) {
  // Extract FSC title from the FSC table's first <td>
  const fscTableMatch = html.match(
    /FEDERAL SUPPLY CLASS[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i
  );
  let title = null;
  let inclusions = null;
  let exclusions = null;

  if (fscTableMatch) {
    const rows = fscTableMatch[1];
    // Extract all <td> values from the data row (skip header row)
    const tdMatches = [...rows.matchAll(/<td>([\s\S]*?)<\/td>/gi)];
    // Pattern: FSC_TITLE, FSC_NOTES, FSC_INCLUSIONS, FSC_EXCLUSIONS
    if (tdMatches.length >= 1) title = cleanHtml(tdMatches[0][1]);
    if (tdMatches.length >= 3) inclusions = cleanHtml(tdMatches[2][1]);
    if (tdMatches.length >= 4) exclusions = cleanHtml(tdMatches[3][1]);
  }

  // Extract FSG notes
  const fsgTableMatch = html.match(
    /FEDERAL SUPPLY GROUP[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i
  );
  let notes = null;
  if (fsgTableMatch) {
    const tdMatches = [...fsgTableMatch[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length >= 2) notes = cleanHtml(tdMatches[1][1]);
  }

  return { title, inclusions, exclusions, notes };
}

function cleanHtml(str) {
  const cleaned = str.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return cleaned || null;
}

// ---------- CSV parsing ----------

function parseDescriptionsCsv(filePath) {
  const content = readFileSync(filePath, "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

// ---------- CID JSON parsing ----------

function parseCidJson(filePath) {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

// ---------- Seed logic ----------

async function seedPscClasses() {
  console.log("Seeding PSC classes...");

  for (const psc of PSC_CODES) {
    const htmlPath = resolve(CONTEXT_DIR, `${psc}_H2.html`);
    const html = readFileSync(htmlPath, "utf-8");
    const { title, inclusions, exclusions, notes } = parseH2Html(html);

    if (!title) {
      console.warn(`  Warning: Could not parse title for PSC ${psc}`);
      continue;
    }

    await prisma.pscClass.upsert({
      where: { psc },
      update: { title, inclusions, exclusions, notes, isSupplyTigerPsc: SUPPLY_TIGER_PSC_CODES.includes(psc) },
      create: { psc, title, inclusions, exclusions, notes, isSupplyTigerPsc: SUPPLY_TIGER_PSC_CODES.includes(psc) },
    });

    console.log(`  PSC ${psc}: ${title}`);
  }
}

async function seedNationalStockNumbers() {
  console.log("Seeding National Stock Numbers...");

  for (const psc of PSC_CODES) {
    const csvPath = resolve(CONTEXT_DIR, `${psc}_DESCRIPTIONS.csv`);
    const records = parseDescriptionsCsv(csvPath);

    let count = 0;
    for (const row of records) {
      const niin = row.NIIN?.trim();
      const fsc = row.FSC?.trim();
      if (!niin || !fsc) continue;

      const nsn = `${fsc}${niin}`;
      const itemName = row.ITEM_NAME?.trim() || "";
      const characteristics = row.CHARACTERISTICS?.trim() || null;
      const commonName = row.COMMON_NAME?.trim() || null;

      await prisma.nationalStockNumber.upsert({
        where: { nsn },
        update: { niin, pscCode: fsc, itemName, characteristics, commonName },
        create: { nsn, niin, pscCode: fsc, itemName, characteristics, commonName },
      });
      count++;
    }

    console.log(`  PSC ${psc}: ${count} items`);
  }
}

async function seedCommercialItemDescs() {
  console.log("Seeding Commercial Item Descriptions...");

  const cidFiles = [
    // { path: resolve(CONTEXT_DIR, "8970-A-A-20331B_CID_NUMBERS.txt"), psc: "8970" },
    { path: resolve(CONTEXT_DIR, "8950-A-A-20001C_CID_NUMBERS.txt"), psc: "8950" },
  ];

  for (const { path: cidPath, psc } of cidFiles) {
    const cidRecords = parseCidJson(cidPath);

    let count = 0;
    for (const entry of cidRecords) {
      const cid = entry.cid;
      if (!cid) continue;

      // Handle array or string dates
      const date = Array.isArray(entry.date) ? entry.date.join("; ") : (entry.date || null);
      const description = entry.description || "";
      const qaPkg = entry.qapkg || null;
      const qaPkgDate = Array.isArray(entry.qapkg_date) ? entry.qapkg_date.join("; ") : (entry.qapkg_date || null);

      await prisma.commercialItemDesc.upsert({
        where: { cid },
        update: { date, description, qaPkg, qaPkgDate, pscCode: psc },
        create: { cid, date, description, qaPkg, qaPkgDate, pscCode: psc },
      });
      count++;
    }

    console.log(`  PSC ${psc} CIDs: ${count} entries`);
  }
}

async function main() {
  console.log("=== Publog Reference Data Seed ===\n");

  try {
    // await seedPscClasses();
    // await seedNationalStockNumbers();
    await seedCommercialItemDescs();
    console.log("\nSeed complete.");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

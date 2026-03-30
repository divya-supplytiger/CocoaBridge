// Utility functions for generating and parsing CSV files.
function escapeCsv(val) {
  // Convert null/undefined to empty string, and escape if it contains special characters.
  const str = String(val ?? "");
  // If the string contains a comma, quote, or newline, wrap it in quotes and escape internal quotes.
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

export function writeCsv(res, filename, headers, rows) {
  // Set headers to indicate a CSV file attachment.
  res.setHeader("Content-Type", "text/csv");

  // Use Content-Disposition to suggest a filename for download.
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.write(headers.map(escapeCsv).join(",") + "\n");

  // Write each row as a line in the CSV.
  for (const row of rows) res.write(row.map(escapeCsv).join(",") + "\n");
  res.end();
}

export function fmtDate(val) {
  return val ? new Date(val).toLocaleDateString() : "";
}

export function fmtCurrency(val) {
  return val != null ? `$${Number(val).toFixed(2)}` : "";
}


/**
 * Extract only relevant sections from solicitation text.
 * Keeps: Section B (CLINs/prices), Section C (item description/components/tables).
 * Falls back to CLIN blocks, item description patterns, or full text.
 */
export const MAX_PARSE_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_PARSE_TYPES = [".pdf", ".docx"];

export function extractRelevantSections(rawText) {
  const sections = [];

  // Try to extract Section B (Supplies/Services, CLINs)
  const sectionBMatch = rawText.match(
    /SECTION\s+B[\s\S]*?(?=SECTION\s+[C-Z]|$)/i,
  );
  if (sectionBMatch) sections.push(sectionBMatch[0].trim());

  // Try to extract Section C (Description/Specs/Item Info)
  const sectionCMatch = rawText.match(
    /SECTION\s+C[\s\S]*?(?=SECTION\s+[D-Z]|$)/i,
  );
  if (sectionCMatch) sections.push(sectionCMatch[0].trim());

  // If no section headers found, try CLIN-based extraction
  if (sections.length === 0) {
    const clinBlocks = rawText.match(
      /CLIN\s+\d{4}[\s\S]*?(?=CLIN\s+\d{4}|SECTION|$)/gi,
    );
    if (clinBlocks) sections.push(...clinBlocks.map((b) => b.trim()));
  }

  // If still nothing, try item description / item info / component patterns
  if (sections.length === 0) {
    const itemMatches = rawText.match(
      /(?:ITEM\s+(?:DESCRIPTION|INFO(?:RMATION)?|DETAIL(?:S)?)|COMPONENT\s+(?:LIST|DESCRIPTION|DETAIL(?:S)?))[\s\S]*?(?=PACKAGING|INSPECTION|QUALITY|DELIVERY|SECTION|$)/gi,
    );
    if (itemMatches) sections.push(...itemMatches.map((m) => m.trim()));
  }

  // Fallback: return cleaned full text if no structure detected
  const result = sections.length > 0 ? sections.join("\n\n---\n\n") : rawText;

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

export function resolveFileExtension(attachment) {
  if (attachment.mimeType) return attachment.mimeType.toLowerCase();
  const match = attachment.name?.match(/\.\w+$/);
  return match ? match[0].toLowerCase() : "";
}
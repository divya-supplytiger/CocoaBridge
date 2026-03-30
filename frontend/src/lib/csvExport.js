// Client-side CSV export utilities.

// These mirror the backend's csv.js functions but generate the CSV content in-memory
// useful for exporting selected rows or detail fields without needing a server round-trip.
function escapeCsv(val) {
  const str = String(val ?? "");
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(headers, rows) {
  const lines = [headers.map(escapeCsv).join(",")];
  for (const row of rows) lines.push(row.map(escapeCsv).join(","));
  return lines.join("\n");
}


function downloadCsv(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export selected table rows as CSV (client-side).
 * @param {Array<{header: string, accessor: string, format?: Function}>} csvColumns
 * @param {Array<Object>} rows - Selected row data objects
 * @param {string} filename
 */
export function exportSelectedToCsv(csvColumns, rows, filename) {
  const headers = csvColumns.map((c) => c.header);
  const data = rows.map((row) =>
    csvColumns.map((c) => {
      const val = row[c.accessor];
      return c.format ? c.format(val, row) : (val ?? "");
    })
  );
  downloadCsv(toCsv(headers, data), filename);
}

/**
 * Export detail page fields as CSV (label/value pairs).
 * @param {Array<{label: string, value: any}>} fields
 * @param {string} filename
 */
export function exportDetailToCsv(fields, filename) {
  const headers = ["Field", "Value"];
  const data = fields.map((f) => [f.label, String(f.value ?? "")]);
  downloadCsv(toCsv(headers, data), filename);
}

/**
 * Download a blob response as a file.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function timestamp() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build a consistent CSV filename.
 * @param {string} entity - e.g. "opportunity", "award", "contact", "inbox-item"
 * @param {string} [id] - row id for detail exports; omit for bulk "rows" export
 * @returns {string} e.g. "opportunity-rows-2026-03-27.csv" or "award-abc123-2026-03-27.csv"
 */
export function csvFilename(entity, id) {
  return `${entity}-${id ?? "rows"}-${timestamp()}.csv`;
}

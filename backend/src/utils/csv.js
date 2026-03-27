function escapeCsv(val) {
  const str = String(val ?? "");
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"` : str;
}

export function writeCsv(res, filename, headers, rows) {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.write(headers.map(escapeCsv).join(",") + "\n");
  for (const row of rows) res.write(row.map(escapeCsv).join(",") + "\n");
  res.end();
}

export function fmtDate(val) {
  return val ? new Date(val).toLocaleDateString() : "";
}

export function fmtCurrency(val) {
  return val != null ? `$${Number(val).toFixed(2)}` : "";
}

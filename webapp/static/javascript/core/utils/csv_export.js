/**
 * CSV export utilities.
 *
 * Organigram reference:
 * - Export & Analyse
 *   → CSV Export
 *
 * Responsibility:
 * Converts result rows into a CSV string.
 *
 * Important:
 * Non-finite numbers such as NaN and Infinity are exported as empty cells.
 */

function csvClean(value) {
  if (typeof value === "number" && !Number.isFinite(value)) {
    return "";
  }

  if (value === null || value === undefined) {
    return "";
  }

  return value;
}

function csvEscape(value) {
  const cleaned = csvClean(value);
  const s = String(cleaned);

  return /[,"\n]/.test(s)
    ? `"${s.replaceAll('"', '""')}"`
    : s;
}

export function toCSV(rows) {
  if (!rows.length) {
    return "";
  }

  const cols = Object.keys(rows[0]);

  return [
    cols.join(","),
    ...rows.map((row) =>
      cols.map((col) => csvEscape(row[col])).join(",")
    ),
  ].join("\n");
}
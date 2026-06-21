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

/**
 * Normalize a value before CSV export.
 *
 * Args:
 *   value: Raw cell value from a result row.
 *
 * Returns:
 *   Cleaned value. Null, undefined and non-finite numbers are converted to an
 *   empty string.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Prevents NaN, Infinity and missing values from appearing as literal text in
 *   exported CSV files.
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

/**
 * Escape one CSV cell value.
 *
 * Args:
 *   value: Raw cell value.
 *
 * Returns:
 *   CSV-safe string representation of the value.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Values containing commas, double quotes or line breaks are wrapped in
 *   double quotes. Existing double quotes are escaped by doubling them.
 */
function csvEscape(value) {
  const cleaned = csvClean(value);
  const s = String(cleaned);

  return /[,"\n]/.test(s)
    ? `"${s.replaceAll('"', '""')}"`
    : s;
}

/**
 * Convert result rows to a CSV string.
 *
 * Args:
 *   rows: Array of result row objects.
 *
 * Returns:
 *   CSV string including a header row, or an empty string if rows is empty.
 *
 * Side effects:
 *   None.
 *
 * Important:
 *   The column order is defined by Object.keys(rows[0]). Therefore, all result
 *   rows should use a consistent object structure.
 *
 * Related usage:
 *   Used for frontend/local CSV downloads. Backend CSV exports are handled
 *   separately in app/database/csv_export.py.
 */
export function toCSV(rows) {
  if (!rows.length) {
  return "";
  }

  // Use the first row to define the exported column order.
  const cols = Object.keys(rows[0]);

  // Build header row first, then serialize each result row using the same column
  // order so the CSV remains rectangular.
  return [
    cols.join(","),
    ...rows.map((row) =>
      cols.map((col) => csvEscape(row[col])).join(",")
    ),
  ].join("\n");
}
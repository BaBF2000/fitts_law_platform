/**
 * Experiment export helpers.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Result Export
 *   → Local CSV Download
 *
 * Responsibility:
 * Handles local CSV download of collected experiment results.
 *
 * Important:
 * This module only exports locally collected results from the browser.
 * Backend persistence is handled separately by the server/save handlers.
 *
 * Related modules:
 * - experiment.js exposes downloadCSV() through the experiment runtime API.
 * - exportHandlers.js connects the CSV download button to this helper.
 * - core/helpers.js provides CSV serialization and timestamp generation.
 */

import {
  isoNow,
  toCSV,
} from "../../core/helpers.js";

/**
 * Build a filesystem-safe timestamp string.
 *
 * Returns:
 *   ISO timestamp string where ":" characters are replaced by "-".
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   ISO timestamps contain ":" characters, which can be inconvenient in file
 *   names on some systems. Replacing them makes the generated CSV filename
 *   safer and more portable.
 */
function makeSafeTimestamp() {
  return isoNow().replaceAll(":", "-");
}

/**
 * Download the current experiment results as a local CSV file.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing collected result rows.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Creates a CSV Blob, creates a temporary download link, triggers the browser
 *   download, removes the link and revokes the object URL shortly afterwards.
 *
 * Filename format:
 *   fitts_<participantId>_<sessionId>_<timestamp>.csv
 *
 * Behavior:
 *   If participant or session IDs are missing, fallback values "P" and "S" are
 *   used.
 *
 * Important:
 *   This function does not validate or modify state.results. It exports the
 *   result rows exactly as collected by the experiment runtime.
 */
export function downloadExperimentCSV({
  dom,
  state,
}) {
  const csv = toCSV(state.results);

  const blob = new Blob(
    [csv],
    { type: "text/csv;charset=utf-8" }
  );

  const a = document.createElement("a");

  const participantId =
    dom.participantId?.value || "P";

  const sessionId =
    dom.sessionId?.value || "S";

  const filename =
    `fitts_${participantId}_${sessionId}_${makeSafeTimestamp()}.csv`;

  a.href = URL.createObjectURL(blob);
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(a.href);
  }, 1000);
}
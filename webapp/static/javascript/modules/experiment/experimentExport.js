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
 */

import {
  isoNow,
  toCSV,
} from "../../core/helpers.js";

function makeSafeTimestamp() {
  return isoNow().replaceAll(":", "-");
}

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
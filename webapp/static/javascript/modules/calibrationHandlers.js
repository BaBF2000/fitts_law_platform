/**
 * Calibration button handlers.
 *
 * Organigram reference:
 * - Calibration
 *   → UI Controls
 *
 * Responsibility:
 * Wires calibration panel buttons to the calibration workflow.
 */

import {
  requestFullscreenSafe,
  unlockOrientationIfPossible,
} from "../core/helpers.js";

import {
  clearCalibration,
} from "../core/storage.js";

export function setupCalibrationHandlers({
  dom,
  state,
  ui,
  cal,
}) {
  dom.buttonCalibration?.addEventListener("click", async () => {
    await requestFullscreenSafe();

    dom.app?.classList.remove("running");
    ui.show(dom, "cal");
    cal.initRect();
  });

  dom.buttonBack?.addEventListener("click", async () => {
    cal.cancel?.();

    await unlockOrientationIfPossible();

    dom.app?.classList.remove("running");
    ui.show(dom, "start");
  });

  dom.buttonValidateCal?.addEventListener("click", () => {
    const done = cal.validate();

    if (done) {
      ui.show(dom, "start");
    }
  });

  dom.btnClearCalibration?.addEventListener("click", () => {
    clearCalibration();

    state.mmPerPx = null;
    state.calErrorPct = null;
    state.calSamples = [];

    ui.updateHudSize(dom, state);
    ui.updateCalibrationStatus?.(state);
  });
}
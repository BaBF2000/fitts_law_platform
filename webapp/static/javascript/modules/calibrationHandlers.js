/**
 * Calibration button handlers.
 *
 * Organigram reference:
 * - Calibration
 *   → UI Controls
 *
 * Responsibility:
 * Wires calibration panel controls to the calibration workflow.
 *
 * This module connects:
 * - opening the calibration panel
 * - slider-based calibration rectangle scaling
 * - cancelling/leaving calibration
 * - validating the calibration rectangle
 * - clearing stored calibration data
 *
 * Important:
 * The actual calibration logic lives in the calibration module.
 * This file only connects UI controls to that workflow.
 */

import {
  requestFullscreenSafe,
  unlockOrientationIfPossible,
} from "../core/helpers.js";

import {
  clearCalibration,
} from "../core/storage.js";

/**
 * Register calibration-related button and slider handlers.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing calibration values.
 *   ui: Core UI helper module, expected to provide show(), updateHudSize() and
 *     updateCalibrationStatus().
 *   cal: Calibration workflow object, expected to provide initRect(),
 *     setWidthPx(), validate() and optionally cancel().
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Registers event listeners on calibration-related controls.
 *
 * Handled controls:
 *   - buttonCalibration: opens the calibration screen.
 *   - calScaleRange: scales the calibration rectangle through a range slider.
 *   - buttonBack: cancels calibration and returns to setup.
 *   - buttonValidateCal: validates the current calibration rectangle.
 *   - btnClearCalibration: clears saved calibration data.
 */
export function setupCalibrationHandlers({
  dom,
  state,
  ui,
  cal,
}) {
  /**
   * Open the calibration workflow.
   *
   * Side effects:
   *   Requests fullscreen mode, removes running UI state, switches to the
   *   calibration view and initializes the calibration rectangle.
   *
   * Reason:
   *   Fullscreen improves calibration consistency because viewport dimensions
   *   should match the later experiment display context.
   */
  dom.buttonCalibration?.addEventListener("click", async () => {
    await requestFullscreenSafe();

    dom.app?.classList.remove("running");
    ui.show(dom, "cal");
    cal.initRect();
  });

  /**
   * Scale the calibration rectangle through an external range slider.
   *
   * Side effects:
   *   Delegates the selected slider value to the calibration workflow.
   *
   * Reason:
   *   On touch displays, the physical reference card can generate unwanted
   *   touches on the screen. A separate slider avoids direct manipulation of the
   *   reference area and provides a stable touchscreen-safe calibration control.
   */
  const calScaleRange =
    dom.calScaleRange ?? document.getElementById("calScaleRange");

  calScaleRange?.addEventListener("input", (e) => {
    cal.setWidthPx?.(e.target.value);
  });

  /**
   * Leave the calibration workflow and return to the start screen.
   *
   * Side effects:
   *   Cancels active calibration if supported, unlocks orientation, removes
   *   running UI state and shows the start/setup view.
   */
  dom.buttonBack?.addEventListener("click", async () => {
    cal.cancel?.();

    await unlockOrientationIfPossible();

    dom.app?.classList.remove("running");
    ui.show(dom, "start");
  });

  /**
   * Validate the current calibration measurement.
   *
   * Side effects:
   *   Delegates validation to the calibration workflow. If calibration succeeds,
   *   the UI returns to the start/setup view.
   *
   * Behavior:
   *   cal.validate() returns true when calibration is complete and valid.
   */
  dom.buttonValidateCal?.addEventListener("click", () => {
    const done = cal.validate();

    if (done) {
      ui.show(dom, "start");
    }
  });

  /**
   * Clear the stored calibration and reset runtime calibration state.
   *
   * Side effects:
   *   Removes calibration from storage, clears calibration fields in state,
   *   updates HUD size information and refreshes the calibration status label.
   *
   * Important:
   *   After this action, millimeter-based protocol units are no longer valid
   *   until the display is calibrated again.
   */
  dom.btnClearCalibration?.addEventListener("click", () => {
    clearCalibration();

    state.mmPerPx = null;
    state.calErrorPct = null;
    state.calSamples = [];

    ui.updateHudSize(dom, state);
    ui.updateCalibrationStatus?.(state);
  });
}
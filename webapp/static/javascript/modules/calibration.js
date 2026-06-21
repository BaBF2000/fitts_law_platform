/**
 * Calibration orchestrator.
 *
 * Organigram reference:
 * - Calibration
 *   → Reference Object
 *   → Slider Resize
 *   → mm/px Estimation
 *
 * Responsibility:
 * Coordinates the calibration workflow.
 *
 * This module connects:
 * - calibrationMath.js for mm/px calculations
 * - calibrationGestures.js for desktop mouse resizing and passive touch behavior
 * - storage.js for saving the final calibration result
 * - ui.js for HUD/status updates
 *
 * Important:
 * This module should orchestrate calibration only.
 * Gesture logic and calibration math should stay in their own helper modules.
 *
 * Extension guide:
 * - To change the reference object dimensions: edit calibrationMath.js.
 * - To change resize behavior: edit calibrationGestures.js.
 * - To change persistence: edit core/storage.js.
 * - To change calibration status display: edit core/ui.js.
 */

import {
  CARD_WIDTH_MM,
  CARD_RATIO,
  computeMmPerPx,
  computeCalibrationResult,
} from "./calibration/calibrationMath.js";

import {
  createCalibrationGestureController,
} from "./calibration/calibrationGestures.js";

import { clamp } from "../core/helpers.js";
import { saveCalibration } from "../core/storage.js";

/**
 * Initialize the calibration workflow.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing calibration values.
 *   ui: Core UI helper module, expected to provide updateHudSize() and
 *     updateCalibrationStatus().
 *
 * Returns:
 *   Calibration controller object containing:
 *   - initRect()
 *   - setWidthPx()
 *   - validate()
 *   - cancel()
 *
 * Side effects:
 *   Creates and binds the calibration gesture controller.
 *
 * Responsibility:
 *   Coordinates the visual calibration rectangle, slider-based resizing,
 *   repeated calibration samples, final mm/px estimation, persistence and UI
 *   refresh.
 */
export function initCalibration(dom, state, ui) {
  /**
   * Number of confirmation samples used before accepting calibration.
   *
   * Purpose:
   *   Multiple samples reduce the influence of a single imprecise resize action.
   */
  const N_SAMPLES = 5;

  /**
   * Optional snap reference width.
   *
   * This is set after the first validation sample and is used to softly assist
   * the user when the rectangle width is close to the previous confirmed width.
   */
  let snapRefWidthPx = null;

  /**
   * Maximum distance from the reference width where snap assistance is applied.
   *
   * Unit:
   *   CSS pixels.
   */
  const SNAP_THRESHOLD_PX = 10;

  /**
   * Strength of the soft snap correction.
   *
   * Range:
   *   0 means no correction, 1 means full jump to the reference width.
   */
  const SNAP_STRENGTH = 0.35;

  /**
   * Minimum allowed calibration rectangle width.
   *
   * Unit:
   *   CSS pixels.
   */
  const MIN_RECT_WIDTH_PX = 120;

  /**
   * Initial calibration rectangle width.
   *
   * Unit:
   *   CSS pixels.
   */
  const INITIAL_RECT_WIDTH_PX = 340;

  /**
   * Read the current calibration rectangle width.
   *
   * Returns:
   *   Calibration rectangle width in CSS pixels, or 0 if unavailable.
   *
   * Side effects:
   *   Reads the DOM layout through getBoundingClientRect().
   */
  function getRectWidthPx() {
    return dom.calRect?.getBoundingClientRect?.().width ?? 0;
  }

  /**
   * Read the current maximum allowed calibration rectangle width.
   *
   * Returns:
   *   Maximum width in CSS pixels.
   *
   * Side effects:
   *   Reads the current viewport width.
   */
  function getMaxRectWidthPx() {
    return Math.floor(window.innerWidth * 0.95);
  }

  /**
   * Resolve the external calibration scale slider.
   *
   * Returns:
   *   HTMLInputElement or null.
   *
   * Side effects:
   *   May query the DOM if dom.calScaleRange is not provided by getDom().
   */
  function getScaleSlider() {
    return dom.calScaleRange ?? document.getElementById("calScaleRange");
  }

  /**
   * Synchronize the external calibration scale slider with the rectangle width.
   *
   * Args:
   *   wPx: Current rectangle width in CSS pixels.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Updates slider min, max, step and value.
   *
   * Purpose:
   *   Keeps the range slider consistent with mouse dragging, initialization and
   *   viewport-dependent limits.
   */
  function syncScaleSlider(wPx = getRectWidthPx()) {
    const slider = getScaleSlider();

    if (!slider) return;

    slider.min = String(MIN_RECT_WIDTH_PX);
    slider.max = String(getMaxRectWidthPx());
    slider.step = "1";
    slider.value = String(Math.round(wPx));
  }

  /**
   * Set the calibration rectangle width while preserving card aspect ratio.
   *
   * Args:
   *   wPx: Desired rectangle width in CSS pixels.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Updates calRect width and height styles and synchronizes the scale slider.
   *
   * Behavior:
   *   The width is clamped between MIN_RECT_WIDTH_PX and 95% of the current
   *   window width. The height is derived from CARD_RATIO to keep the
   *   reference-object shape.
   */
  function setRectWidthPx(wPx) {
    if (!dom.calRect) return;

    const w =
      clamp(wPx, MIN_RECT_WIDTH_PX, getMaxRectWidthPx());

    const h =
      w / CARD_RATIO;

    dom.calRect.style.width = `${w}px`;
    dom.calRect.style.height = `${h}px`;

    syncScaleSlider(w);
  }

  /**
   * Apply soft snapping near the reference width.
   *
   * Args:
   *   wPx: Current proposed rectangle width in CSS pixels.
   *
   * Returns:
   *   Possibly adjusted rectangle width in CSS pixels.
   *
   * Side effects:
   *   None.
   *
   * Behavior:
   *   If no snap reference exists, the input width is returned unchanged.
   *   If the current width is close to the reference width, it is softly pulled
   *   toward that reference instead of jumping abruptly.
   */
  function maybeSnapWidth(wPx) {
    if (!snapRefWidthPx) return wPx;

    const d = snapRefWidthPx - wPx;

    if (Math.abs(d) <= SNAP_THRESHOLD_PX) {
      return wPx + d * SNAP_STRENGTH;
    }

    return wPx;
  }

  /**
   * Update the calibration readout labels.
   *
   * Args:
   *   extra: Optional text appended to the mm/px label, for example sample
   *     progress or final uncertainty.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Updates calibration pixel and mm/px text labels and synchronizes the
   *   scale slider.
   *
   * Behavior:
   *   The mm/px factor is computed from the current visual rectangle width and
   *   the known physical reference width.
   */
  function updateCalReadout(extra = "") {
    if (!dom.calRect) return;

    const w = getRectWidthPx();

    syncScaleSlider(w);

    if (dom.calPx) {
      dom.calPx.textContent = `${Math.round(w)} px`;
    }

    const factor =
      computeMmPerPx({
        referenceMm: CARD_WIDTH_MM,
        widthPx: w,
      });

    if (dom.calMmPerPx) {
      dom.calMmPerPx.textContent =
        Number.isFinite(factor)
          ? `${factor.toFixed(4)} mm/px${extra ? " " + extra : ""}`
          : `— mm/px${extra ? " " + extra : ""}`;
    }
  }

  /**
   * Gesture controller responsible for desktop mouse resizing and passive touch
   * behavior of the calibration rectangle.
   *
   * The gesture module receives small callbacks so the orchestration stays here
   * while pointer/touch gesture details stay in calibrationGestures.js.
   */
  const gestures =
    createCalibrationGestureController({
      dom,
      getRectWidthPx,
      setRectWidthPx,
      updateCalReadout,
      maybeSnapWidth,
    });

  gestures.bind();

  /**
   * Reset collected calibration samples.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Clears state.calSamples and refreshes the calibration readout.
   */
  function resetSamples() {
    state.calSamples = [];
    updateCalReadout();
  }

  return {
    /**
     * Initialize the calibration rectangle and reset the sampling workflow.
     *
     * Returns:
     *   undefined.
     *
     * Side effects:
     *   Sets the initial visual rectangle size, clears previous samples,
     *   resets snap assistance, synchronizes the slider and restores the
     *   validation button label.
     *
     * Purpose:
     *   Called when the calibration view is opened.
     */
    initRect() {
      if (!dom.calRect) return;

      // Initial visual card size in CSS pixels.
      // Only used as a starting point before user adjustment.
      setRectWidthPx(INITIAL_RECT_WIDTH_PX);

      // Reset sampling and snap reference before a new calibration sequence.
      resetSamples();
      snapRefWidthPx = null;

      const btn = document.getElementById("buttonValidateCalibration");

      if (btn) {
        btn.textContent = "Kalibrierung bestätigen";
      }
    },

    /**
     * Set the calibration rectangle width from an external UI control.
     *
     * Args:
     *   widthPx: Desired rectangle width in CSS pixels.
     *
     * Returns:
     *   undefined.
     *
     * Side effects:
     *   Updates the calibration rectangle and readout.
     *
     * Purpose:
     *   Used by the touchscreen-safe range slider.
     */
    setWidthPx(widthPx) {
      const w = Number(widthPx);

      if (!Number.isFinite(w)) return;

      setRectWidthPx(w);
      updateCalReadout();
    },

    /**
     * Validate one calibration sample or finalize calibration.
     *
     * Returns:
     *   true when calibration is complete, otherwise false.
     *
     * Side effects:
     *   Adds one mm/px sample, updates progress labels, and after N_SAMPLES
     *   computes the final calibration result, stores it in state and persists it.
     *
     * Workflow:
     *   1. Read current rectangle width.
     *   2. Convert it to one mm/px sample.
     *   3. Store the sample.
     *   4. Continue collecting until N_SAMPLES is reached.
     *   5. Compute final robust calibration result.
     *   6. Save calibration and update HUD/status labels.
     */
    validate() {
      if (!dom.calRect) return false;

      const w = getRectWidthPx();

      const sample =
        computeMmPerPx({
          referenceMm: CARD_WIDTH_MM,
          widthPx: w,
        });

      state.calSamples = state.calSamples || [];
      state.calSamples.push(sample);

      const k = state.calSamples.length;

      // Set the snap reference after the first confirmation.
      if (!snapRefWidthPx) {
        snapRefWidthPx = w;
      }

      if (k < N_SAMPLES) {
        updateCalReadout(`(Probe ${k}/${N_SAMPLES})`);

        const btn = document.getElementById("buttonValidateCalibration");

        if (btn) {
          btn.textContent = `Bestätigen (${k}/${N_SAMPLES})`;
        }

        return false;
      }

      // Finalize with robust median and uncertainty estimation.
      const result =
        computeCalibrationResult(state.calSamples);

      state.mmPerPx = result.mmPerPx;
      state.calErrorPct = result.calErrorPct;

      saveCalibration({
        mmPerPx: state.mmPerPx,
        calRectWidthPx: w,
        calErrorPct: state.calErrorPct,
      });

      state.calSamples = [];

      ui.updateHudSize(dom, state);
      ui.updateCalibrationStatus?.(state);

      const btn = document.getElementById("buttonValidateCalibration");

      if (btn) {
        btn.textContent = "Kalibrierung bestätigen";
      }

      updateCalReadout(`(fertig • ±${state.calErrorPct.toFixed(2)}%)`);

      return true;
    },

    /**
     * Cancel the current calibration sampling sequence.
     *
     * Returns:
     *   undefined.
     *
     * Side effects:
     *   Clears collected samples and restores the validation button label.
     *
     * Important:
     *   This does not delete a previously saved calibration. It only cancels the
     *   currently active sampling workflow.
     */
    cancel() {
      resetSamples();

      const btn = document.getElementById("buttonValidateCalibration");

      if (btn) {
        btn.textContent = "Kalibrierung bestätigen";
      }
    },
  };
}
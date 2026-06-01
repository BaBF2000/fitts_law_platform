/**
 * Calibration orchestrator.
 *
 * Organigram reference:
 * - Calibration
 *   → Reference Object
 *   → Gesture Resize
 *   → mm/px Estimation
 *
 * Responsibility:
 * Coordinates the calibration workflow.
 *
 * This module connects:
 * - calibrationMath.js for mm/px calculations
 * - calibrationGestures.js for touch/mouse resizing
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

export function initCalibration(dom, state, ui) {
  const N_SAMPLES = 5;

  // Optional snap (helps when user is close to target width)
  let snapRefWidthPx = null; // set after first validation
  const SNAP_THRESHOLD_PX = 10; // how close before we assist
  const SNAP_STRENGTH = 0.35;   // 0..1 (soft pull toward ref)

  function getRectWidthPx() {
    return dom.calRect?.getBoundingClientRect?.().width ?? 0;
  }

  function setRectWidthPx(wPx) {
    if (!dom.calRect) return;
    const w = clamp(wPx, 120, window.innerWidth * 0.95);
    const h = w / CARD_RATIO;
    dom.calRect.style.width = `${w}px`;
    dom.calRect.style.height = `${h}px`;
  }

  function maybeSnapWidth(wPx) {
    if (!snapRefWidthPx) return wPx;
    const d = snapRefWidthPx - wPx;
    if (Math.abs(d) <= SNAP_THRESHOLD_PX) {
      return wPx + d * SNAP_STRENGTH;
    }
    return wPx;
  }

  function updateCalReadout(extra = "") {
    if (!dom.calRect) return;

    const w = getRectWidthPx();
    if (dom.calPx) dom.calPx.textContent = `${Math.round(w)} px`;

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

  const gestures =
    createCalibrationGestureController({
      dom,
      getRectWidthPx,
      setRectWidthPx,
      updateCalReadout,
      maybeSnapWidth,
    });
  
  gestures.bind();

  function resetSamples() {
    state.calSamples = [];
    updateCalReadout();
  }

  return {
    initRect() {
      if (!dom.calRect) return;

      // Initial visual card size in CSS pixels.
      // Only used as a starting point before user adjustment.
      setRectWidthPx(340);

      // reset sampling + snap reference
      resetSamples();
      snapRefWidthPx = null;

      const btn = document.getElementById("buttonValidateCalibration");
      if (btn) btn.textContent = "Kalibrierung bestätigen";
    },

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

      // Set snap reference after first “confirm”
      if (!snapRefWidthPx) snapRefWidthPx = w;

      if (k < N_SAMPLES) {
        updateCalReadout(`(Probe ${k}/${N_SAMPLES})`);
        const btn = document.getElementById("buttonValidateCalibration");
        if (btn) btn.textContent = `Bestätigen (${k}/${N_SAMPLES})`;
        return false;
      }

      // Finalize with robust median + uncertainty
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
      if (btn) btn.textContent = "Kalibrierung bestätigen";

      updateCalReadout(`(fertig • ±${state.calErrorPct.toFixed(2)}%)`);
      return true;
    },

    cancel() {
      resetSamples();
      const btn = document.getElementById("buttonValidateCalibration");
      if (btn) btn.textContent = "Kalibrierung bestätigen";
    },
  };
}
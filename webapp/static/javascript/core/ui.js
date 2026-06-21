/**
 * Core UI view helpers.
 *
 * Organigram reference:
 * - UI Layer
 *   → View Switching
 *   → HUD Updates
 *   → Calibration Status
 *
 * Responsibility:
 * Handles simple top-level UI updates that are shared across modules.
 *
 * This module controls:
 * - visible application panels
 * - fullscreen/wake-lock policy
 * - HUD viewport/calibration display
 * - calibration status badge
 *
 * Important:
 * This file should not contain experiment logic.
 * It only updates UI state based on already-computed application state.
 *
 * Extension guide:
 * - To add a new top-level view: extend show().
 * - To add a new HUD field: extend updateHudSize().
 * - To change calibration badge behavior: edit updateCalibrationStatus().
 *
 * UI text is German by design.
 */

import { setFullscreenEnforcement, setWakeLock } from "./helpers.js";

// Calibration uncertainty threshold in percent.
// Values above this threshold show a warning badge instead of a normal OK badge.
const CALIBRATION_WARN_THRESHOLD_PCT = 2.0;

/**
 * Switch between top-level application views.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   which: View identifier. Supported values are:
 *     - "start": setup screen
 *     - "cal": calibration screen
 *     - "touchability": finger/touchability test
 *     - "adminSettings": advanced experiment constraints
 *     - "run": experiment running
 *     - "end": end/summary screen
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates panel display styles, fullscreen enforcement and wake-lock state.
 *
 * Fullscreen / wake-lock policy:
 *   Fullscreen enforcement and wake lock are active only during "run" and
 *   "end". The end screen remains protected so participants can save/export
 *   results without the display dimming.
 *
 * Important:
 *   UI text is German by design; do not translate user-facing strings here.
 */
export function show(dom, which) {
  if (!dom) return;

  if (dom.startCard) {
    dom.startCard.style.display = which === "start" ? "flex" : "none";
  }

  if (dom.calPanel) {
    dom.calPanel.style.display = which === "cal" ? "flex" : "none";
  }

  if (dom.touchabilityPanel) {
    dom.touchabilityPanel.style.display =
      which === "touchability" ? "flex" : "none";
  }

  if (dom.adminSettingsPanel) {
    dom.adminSettingsPanel.style.display =
      which === "adminSettings" ? "flex" : "none";
  }

  if (dom.endPanel) {
    dom.endPanel.style.display = which === "end" ? "flex" : "none";
  }

  const running = which === "run" || which === "end";

  setFullscreenEnforcement(running);
  setWakeLock(running);
}

/**
 * Update viewport, calibration and display-size readouts.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing calibration values such as
 *     mmPerPx and calErrorPct.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates HUD text, fullscreen dimension text and calibration status badge.
 *
 * Behavior:
 *   - HUD right shows viewport size in CSS pixels.
 *   - If calibration exists, HUD right also shows mm/px and optional error.
 *   - Start card shows estimated fullscreen dimensions in centimeters.
 *   - Calibration badge is updated through updateCalibrationStatus().
 */
export function updateHudSize(dom, state) {
  if (!dom || !state) return;

  // --- HUD right (viewport + optional calibration info) ---
  if (dom.hudRight) {
    const base = `W×H: ${window.innerWidth}×${window.innerHeight}`;

    if (state.mmPerPx) {
      const err = Number.isFinite(state.calErrorPct)
        ? ` ±${state.calErrorPct.toFixed(2)}%`
        : "";
      dom.hudRight.textContent = `${base} • ${state.mmPerPx.toFixed(4)} mm/px${err}`;
    } else {
      dom.hudRight.textContent = base;
    }
  }

  // --- Start card: fullscreen dimensions in cm ---
  if (dom.fullscreenDimsCm) {
    if (state.mmPerPx) {
      const wCm = (window.innerWidth * state.mmPerPx) / 10;
      const hCm = (window.innerHeight * state.mmPerPx) / 10;

      const err = Number.isFinite(state.calErrorPct)
        ? ` (±${state.calErrorPct.toFixed(2)}%)`
        : "";

      dom.fullscreenDimsCm.textContent =
        `Vollbildmodusabmessungen (W×H): ${wCm.toFixed(1)} cm × ${hCm.toFixed(1)} cm${err}`;
    } else {
      dom.fullscreenDimsCm.textContent =
        "Vollbildmodusabmessungen (W×H): — cm × — cm";
    }
  }

  // --- Keep status badge in sync (if present) ---
  updateCalibrationStatus(dom, state);
}

/**
 * Update the calibration status badge and enable/disable the reset control.
 *
 * UI text MUST remain German.
 *
 * Behavior:
 *  - Not calibrated => neutral badge, reset disabled
 *  - Calibrated => OK or WARN depending on calErrorPct threshold
 *  - Meta line shows mm/px and optional ±% uncertainty
 */
export function updateCalibrationStatus(dom, state) {
  const box = dom?.calStatus;
  const dot = dom?.calDot;
  const txt = dom?.calStatusText;
  const meta = dom?.calStatusMeta;
  const resetBtn = dom?.btnClearCalibration;

  const calibrated = !!state?.mmPerPx;

  // Reset is only usable when calibration exists.
  if (resetBtn) resetBtn.disabled = !calibrated;

  // Badge is optional (don't crash if missing).
  if (!box || !dot || !txt || !meta) return;

  // Reset state each time
  box.classList.remove("ok", "warn");

  if (!calibrated) {
    dot.style.opacity = "0.55";
    txt.textContent = "Nicht kalibriert";
    meta.textContent = "";
    return;
  }

  // Decide ok vs warn based on uncertainty (tunable threshold).
  const hasErr = Number.isFinite(state.calErrorPct);
  const errPct = hasErr ? Number(state.calErrorPct) : null;

  // Warning threshold in percent (e.g., 2%).
  if (hasErr && errPct > CALIBRATION_WARN_THRESHOLD_PCT) {
    box.classList.add("warn");
    txt.textContent = "Kalibriert (prüfen)";
  } else {
    box.classList.add("ok");
    txt.textContent = "Kalibriert";
  }

  dot.style.opacity = "1";

  // Compact meta: factor + optional uncertainty
  const errText = hasErr ? ` ±${errPct.toFixed(2)}%` : "";
  meta.textContent = `${Number(state.mmPerPx).toFixed(4)} mm/px${errText}`;
}
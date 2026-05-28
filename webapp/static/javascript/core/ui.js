import { setFullscreenEnforcement, setWakeLock } from "./helpers.js";

/**
 * Switch between top-level views.
 *
 * Views:
 *  - "start": setup screen
 *  - "cal": calibration screen
 *  - "touchability": finger/touchability test
 *  - "run": experiment running
 *  - "end": end/summary screen
 *
 * Fullscreen / wake-lock policy:
 *  - Enforce fullscreen + keep screen awake only while the experiment is running
 *    (end screen included so participants can safely export/save without dimming).
 *  - Do not enforce on start or calibration screens.
 *
 * Note: UI text is German by design; do not translate user-facing strings here.
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

  if (dom.endPanel) {
    dom.endPanel.style.display = which === "end" ? "flex" : "none";
  }

  const running = which === "run" || which === "end";

  setFullscreenEnforcement(running);
  setWakeLock(running);
}

/**
 * Update HUD readouts and start-card dimension info.
 *
 * - HUD right: viewport px + optional calibration factor (mm/px) and uncertainty
 * - Start card: fullscreen dimensions in cm if calibrated
 * - Calibration badge: delegated to updateCalibrationStatus()
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
  updateCalibrationStatus(state);
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
export function updateCalibrationStatus(state) {
  const box = document.getElementById("calStatus");
  const dot = document.getElementById("calDot");
  const txt = document.getElementById("calStatusText");
  const meta = document.getElementById("calStatusMeta");
  const resetBtn = document.getElementById("btnClearCalibration");

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
  const WARN_THRESHOLD_PCT = 2.0;

  if (hasErr && errPct > WARN_THRESHOLD_PCT) {
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
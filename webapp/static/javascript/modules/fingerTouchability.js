/**
 * Finger touchability module.
 *
 * Organigram reference:
 * - Touchability
 *   → Finger Contact Model
 *   → Minimum Target Size
 *
 * Responsibility:
 * Estimates the participant's touch contact diameter and derives
 * shape-specific minimum target widths.
 *
 * This module uses:
 * - PointerEvent.width / PointerEvent.height when available
 * - a calibrated millimeter fallback when screen calibration exists
 * - a default pixel fallback otherwise
 *
 * Important:
 * Touchability affects protocol validation and target-size constraints.
 * It does not directly place targets or validate trial hits.
 *
 * Extension guide:
 * - To change fallback diameter: edit FALLBACK_TOUCH_DIAMETER_MM.
 * - To change allowed diameter range: edit MIN/MAX_TOUCH_DIAMETER_PX.
 * - To change shape-specific safety factors: edit computeWMinByShape().
 * - To change saved participant touchability: edit core/storage/touchabilityStorage.js.
 */

import { DEFAULT_TOUCH_DIAMETER_PX } from "../core/constants.js";

const FALLBACK_TOUCH_DIAMETER_MM = 10;
const FALLBACK_TOUCH_DIAMETER_PX = DEFAULT_TOUCH_DIAMETER_PX;
const MIN_TOUCH_DIAMETER_PX = 8;
const MAX_TOUCH_DIAMETER_PX = 140;

function pxToMm(px, state) {
  return state.mmPerPx ? px * state.mmPerPx : null;
}

function mmToPx(mm, state) {
  return state.mmPerPx ? mm / state.mmPerPx : null;
}

function clampTouchDiameterPx(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return FALLBACK_TOUCH_DIAMETER_PX;
  }

  return Math.max(
    MIN_TOUCH_DIAMETER_PX,
    Math.min(MAX_TOUCH_DIAMETER_PX, n)
  );
}

function readPointerDiameter(e) {
  const width = Number(e.width) || 0;
  const height = Number(e.height) || 0;

  return Math.max(width, height);
}

function computeWMinByShape(touchDiameterPx) {
  const d = Number(touchDiameterPx);

  if (!Number.isFinite(d) || d <= 0) {
    return {};
  }

  return {
    circle: d,
    square: d,
    triangle: d * 1.35,
    pentagon: d * 1.15,
    hexagon: d * 1.1,
    octagon: d * 1.05,
    diamond: d * 1.42,
    band1d_h: d,
    band1d_v: d,
    polygon: d * 1.35,
  };
}

/**
 * Resize the visible touchability circle to match the stored touch diameter.
 */
function updateTouchCircle(dom, diameterPx, measured) {
  const el = dom.fingerMeasureTarget;
  if (!el) return;

  const visualPx = clampTouchDiameterPx(diameterPx);

  el.style.width = `${visualPx}px`;
  el.style.height = `${visualPx}px`;
  el.style.borderRadius = "999px";

  el.dataset.measured = measured ? "1" : "0";
}

/**
 * Refresh all touchability labels and the visual circle.
 */
function updateTouchabilityUI(dom, state) {
  const diameterPx = state.touchDiameterPx;
  const diameterMm = state.touchDiameterMm;

  if (dom.touchDiameterStatus) {
    dom.touchDiameterStatus.textContent = diameterPx
      ? `${diameterPx.toFixed(1)} px${diameterMm ? ` / ${diameterMm.toFixed(1)} mm` : ""}`
      : "—";
  }

  if (dom.touchDiameterPx) {
    dom.touchDiameterPx.textContent = diameterPx
      ? `${diameterPx.toFixed(1)} px`
      : "— px";
  }

  if (dom.touchDiameterMm) {
    dom.touchDiameterMm.textContent = diameterMm
      ? `${diameterMm.toFixed(1)} mm`
      : "— mm";
  }

  if (dom.wMinCircle) {
    const v = state.touchabilityByShape?.circle;
    dom.wMinCircle.textContent = v ? `${v.toFixed(1)} px` : "—";
  }

  if (dom.wMinSquare) {
    const v = state.touchabilityByShape?.square;
    dom.wMinSquare.textContent = v ? `${v.toFixed(1)} px` : "—";
  }

  if (dom.wMinPolygon) {
    const v = state.touchabilityByShape?.polygon;
    dom.wMinPolygon.textContent = v ? `${v.toFixed(1)} px` : "—";
  }

  updateTouchCircle(dom, diameterPx, state.touchabilityMeasured);
}

/**
 * Store a touch diameter and update all derived values.
 */
function applyTouchDiameterPx(dom, state, diameterPx, measured = true) {
  const safePx = clampTouchDiameterPx(diameterPx);

  state.touchDiameterPx = safePx;
  state.touchDiameterMm = pxToMm(safePx, state);
  state.touchabilityByShape = computeWMinByShape(safePx);
  state.touchabilityMeasured = measured;
  state.touchabilitySource = measured ? "measured" : "fallback";

  updateTouchabilityUI(dom, state);
}

/**
 * Use a fallback touch diameter.
 *
 * If screen calibration is available, the fallback is defined in mm.
 * Otherwise, it falls back to a fixed px value.
 */
function applyFallback(dom, state) {
  let diameterPx = null;

  if (state.mmPerPx) {
    diameterPx = mmToPx(FALLBACK_TOUCH_DIAMETER_MM, state);
  }

  if (!diameterPx) {
    diameterPx = FALLBACK_TOUCH_DIAMETER_PX;
  }

  applyTouchDiameterPx(dom, state, diameterPx, false);
}

export function initFingerTouchability(dom, state) {
  let activePointerId = null;
  let maxMeasuredDiameterPx = 0;

  /**
   * Begin measuring one pointer contact.
   */
  function handlePointerDown(e) {
    touchStartTime = performance.now();
    activePointerId = e.pointerId;
    maxMeasuredDiameterPx = readPointerDiameter(e);

    dom.fingerMeasureTarget?.setPointerCapture?.(e.pointerId);

    const initialDiameter =
      maxMeasuredDiameterPx > 1
        ? maxMeasuredDiameterPx
        : FALLBACK_TOUCH_DIAMETER_PX;

    applyTouchDiameterPx(
      dom,
      state,
      initialDiameter,
      maxMeasuredDiameterPx > 1
    );

    e.preventDefault();
  }

  /**
   * Update the measured diameter while the finger moves.
   *
   * Some browsers update e.width/e.height during contact.
   * Others keep it fixed at 1, in which case fallback stays active.
   */
  function handlePointerMove(e) {
    if (activePointerId !== e.pointerId) return;

    const d = readPointerDiameter(e);

    if (d > maxMeasuredDiameterPx) {
      maxMeasuredDiameterPx = d;
      applyTouchDiameterPx(dom, state, d, true);
    }

    e.preventDefault();
  }

  /**
   * Finish measuring the current pointer contact.
   */
  function handlePointerUp(e) {
    if (activePointerId !== e.pointerId) return;

    //const elapsed = performance.now() - touchStartTime;
    const measured = maxMeasuredDiameterPx > 1;

    const finalDiameter =
      measured
        ? maxMeasuredDiameterPx
        : FALLBACK_TOUCH_DIAMETER_PX;

    applyTouchDiameterPx(
      dom,
      state,
      finalDiameter,
      measured
    );

    activePointerId = null;
    maxMeasuredDiameterPx = 0;

    e.preventDefault();
  }

  /**
   * Reset pointer state if the browser cancels the touch.
   */
  function handlePointerCancel() {
    activePointerId = null;
    maxMeasuredDiameterPx = 0;
  }

  function open() {
    updateTouchabilityUI(dom, state);
  }

  dom.fingerMeasureTarget?.addEventListener("pointerdown", handlePointerDown);
  dom.fingerMeasureTarget?.addEventListener("pointermove", handlePointerMove);
  dom.fingerMeasureTarget?.addEventListener("pointerup", handlePointerUp);
  dom.fingerMeasureTarget?.addEventListener("pointercancel", handlePointerCancel);

  updateTouchabilityUI(dom, state);

  return {
    open,
    applyFallback,
    applyTouchDiameterPx: (diameterPx, measured = true) =>
      applyTouchDiameterPx(dom, state, diameterPx, measured),
    updateUI: () => updateTouchabilityUI(dom, state),
  };
}
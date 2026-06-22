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

/**
 * Physical fallback finger diameter used when screen calibration exists.
 *
 * Unit:
 *   Millimeters.
 *
 * Purpose:
 *   Provides a realistic default index-finger contact diameter when the browser
 *   cannot provide reliable PointerEvent.width/height values.
 */
const FALLBACK_TOUCH_DIAMETER_MM = 10;

/**
 * Pixel fallback finger diameter used when no calibration exists.
 *
 * Unit:
 *   CSS pixels.
 */
const FALLBACK_TOUCH_DIAMETER_PX = DEFAULT_TOUCH_DIAMETER_PX;

/**
 * Minimum accepted touch diameter.
 *
 * Unit:
 *   CSS pixels.
 *
 * Purpose:
 *   Prevents unusably small pointer-width values from creating unrealistic
 *   minimum target sizes.
 */
const MIN_TOUCH_DIAMETER_PX = 8;

/**
 * Maximum accepted touch diameter.
 *
 * Unit:
 *   CSS pixels.
 *
 * Purpose:
 *   Prevents extreme browser/device values from creating unrealistic target
 *   constraints.
 */
const MAX_TOUCH_DIAMETER_PX = 140;

/**
 * Convert pixels to millimeters using the current calibration.
 *
 * Args:
 *   px: Value in CSS pixels.
 *   state: Shared application state containing optional mmPerPx calibration.
 *
 * Returns:
 *   Value in millimeters, or null if calibration is unavailable.
 *
 * Side effects:
 *   None.
 */
function pxToMm(px, state) {
  return state.mmPerPx ? px * state.mmPerPx : null;
}

/**
 * Convert millimeters to pixels using the current calibration.
 *
 * Args:
 *   mm: Value in millimeters.
 *   state: Shared application state containing optional mmPerPx calibration.
 *
 * Returns:
 *   Value in CSS pixels, or null if calibration is unavailable.
 *
 * Side effects:
 *   None.
 */
function mmToPx(mm, state) {
  return state.mmPerPx ? mm / state.mmPerPx : null;
}

/**
 * Clamp a raw touch diameter to the accepted pixel range.
 *
 * Args:
 *   value: Raw touch diameter value.
 *
 * Returns:
 *   Safe touch diameter in CSS pixels.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Invalid values fall back to FALLBACK_TOUCH_DIAMETER_PX. Valid values are
 *   constrained to [MIN_TOUCH_DIAMETER_PX, MAX_TOUCH_DIAMETER_PX].
 */
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

/**
 * Prevent default browser behavior only when the event is cancelable.
 *
 * Args:
 *   e: Event object.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   May call preventDefault().
 *
 * Purpose:
 *   Avoids console warnings and prevents touch handling from blocking page
 *   scrolling after the measurement panel has been closed.
 */
function preventDefaultIfCancelable(e) {
  if (e?.cancelable) {
    e.preventDefault();
  }
}

/**
 * Read the touch contact diameter from a pointer event.
 *
 * Args:
 *   e: PointerEvent from the finger measurement target.
 *
 * Returns:
 *   Maximum of PointerEvent.width and PointerEvent.height in CSS pixels.
 *
 * Side effects:
 *   None.
 *
 * Notes:
 *   Some browsers report meaningful contact size values. Others report 1 or 0,
 *   so fallback logic is still required.
 */
function readPointerDiameter(e) {
  const width = Number(e.width) || 0;
  const height = Number(e.height) || 0;

  return Math.max(width, height);
}

/**
 * Compute shape-specific minimum target widths from touch diameter.
 *
 * Args:
 *   touchDiameterPx: Estimated finger contact diameter in CSS pixels.
 *
 * Returns:
 *   Object mapping target shape names to minimum target widths in CSS pixels.
 *   Returns an empty object if the input diameter is invalid.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Simple shapes such as circles and squares use the measured diameter
 *   directly. Shapes with narrower corners or reduced effective touchable area
 *   receive larger safety factors.
 *
 * Important:
 *   These values are later used by protocol validation and experiment
 *   constraints to prevent targets that are too small for the participant.
 */
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
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   diameterPx: Touch diameter in CSS pixels.
 *   measured: Whether the displayed diameter comes from pointer measurement.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates the size, border radius and dataset flag of the visual measurement
 *   target.
 *
 * Purpose:
 *   Gives the user immediate visual feedback about the estimated touch contact
 *   diameter.
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
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing touchability values.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates touchability UI labels and the visual measurement circle.
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
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   diameterPx: Raw or measured touch diameter in CSS pixels.
 *   measured: Whether the value comes from an actual pointer measurement.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates touchability fields in state and refreshes the touchability UI.
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
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing optional calibration.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Applies a fallback touch diameter and updates state/UI.
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

/**
 * Initialize the finger touchability measurement workflow.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *
 * Returns:
 *   Object containing:
 *   - open()
 *   - close()
 *   - applyFallback()
 *   - applyTouchDiameterPx()
 *   - updateUI()
 *
 * Side effects:
 *   Registers pointer event listeners on dom.fingerMeasureTarget and initializes
 *   the touchability UI.
 */
export function initFingerTouchability(dom, state) {
  // Currently measured pointer. null means no active measurement is running.
  let activePointerId = null;

  // Largest contact diameter observed during the active pointer contact.
  let maxMeasuredDiameterPx = 0;

  // Measurement start timestamp. Reserved for possible future dwell-time or
  // measurement-quality checks.
  let touchStartTime = null;

  /**
   * Release pointer capture if the measurement target currently owns it.
   *
   * Args:
   *   pointerId: Pointer ID to release. Defaults to activePointerId.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   May release pointer capture on the measurement element.
   *
   * Reason:
   *   If pointer capture remains active after leaving the touchability panel,
   *   scrolling on the main screen can be blocked on tablets.
   */
  function releasePointerCaptureIfNeeded(pointerId = activePointerId) {
    const el = dom.fingerMeasureTarget;

    if (!el || pointerId === null || pointerId === undefined) {
      return;
    }

    try {
      if (!el.hasPointerCapture || el.hasPointerCapture(pointerId)) {
        el.releasePointerCapture?.(pointerId);
      }
    } catch (_) {
      // The browser may already have released the pointer capture.
    }
  }

  /**
   * Clear active pointer measurement state.
   *
   * Args:
   *   pointerId: Optional pointer ID whose capture should be released.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Releases pointer capture and resets local measurement state.
   */
  function resetPointerMeasurement(pointerId = activePointerId) {
    releasePointerCaptureIfNeeded(pointerId);

    activePointerId = null;
    maxMeasuredDiameterPx = 0;
    touchStartTime = null;
  }

  /**
   * Begin measuring one pointer contact.
   *
   * Args:
   *   e: PointerEvent from the measurement target.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Stores active pointer ID, captures the pointer, initializes the measured
   *   diameter and updates state/UI.
   */
  function handlePointerDown(e) {
    // Clear a stale measurement before starting a new one.
    if (activePointerId !== null && activePointerId !== e.pointerId) {
      resetPointerMeasurement(activePointerId);
    }

    touchStartTime = performance.now();
    activePointerId = e.pointerId;
    maxMeasuredDiameterPx = readPointerDiameter(e);

    try {
      dom.fingerMeasureTarget?.setPointerCapture?.(e.pointerId);
    } catch (_) {
      // Pointer capture is optional. Measurement can continue without it.
    }

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

    preventDefaultIfCancelable(e);
  }

  /**
   * Update the measured diameter while the finger moves.
   *
   * Args:
   *   e: PointerEvent from the active pointer contact.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   May update maxMeasuredDiameterPx, state and UI.
   */
  function handlePointerMove(e) {
    if (activePointerId !== e.pointerId) return;

    const d = readPointerDiameter(e);

    if (d > maxMeasuredDiameterPx) {
      maxMeasuredDiameterPx = d;
      applyTouchDiameterPx(dom, state, d, true);
    }

    preventDefaultIfCancelable(e);
  }

  /**
   * Finish measuring the current pointer contact.
   *
   * Args:
   *   e: PointerEvent from the active pointer contact.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Applies the final measured/fallback diameter and resets pointer state.
   */
  function handlePointerUp(e) {
    if (activePointerId !== e.pointerId) return;

    // Reserved for possible future measurement-quality checks.
    // const elapsed = performance.now() - touchStartTime;

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

    resetPointerMeasurement(e.pointerId);
    preventDefaultIfCancelable(e);
  }

  /**
   * Reset pointer state if the browser cancels the touch.
   *
   * Args:
   *   e: PointerEvent from pointercancel.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Clears active measurement state.
   */
  function handlePointerCancel(e) {
    resetPointerMeasurement(e?.pointerId ?? activePointerId);
  }

  /**
   * Clear local state if pointer capture is lost externally.
   *
   * Args:
   *   e: PointerEvent from lostpointercapture.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Clears local pointer state.
   */
  function handleLostPointerCapture(e) {
    if (activePointerId !== e.pointerId) return;

    activePointerId = null;
    maxMeasuredDiameterPx = 0;
    touchStartTime = null;
  }

  /**
   * Open or refresh the touchability workflow UI.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Clears stale pointer state, refreshes labels and the visual touch circle.
   */
  function open() {
    resetPointerMeasurement();
    updateTouchabilityUI(dom, state);
  }

  /**
   * Close the touchability workflow.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Releases pointer capture and clears local measurement state.
   *
   * Purpose:
   *   Prevents the measurement target from keeping pointer capture after the
   *   touchability panel is hidden.
   */
  function close() {
    resetPointerMeasurement();
  }

  // Register pointer handlers on the visual measurement target.
  dom.fingerMeasureTarget?.addEventListener(
    "pointerdown",
    handlePointerDown,
    { passive: false }
  );

  dom.fingerMeasureTarget?.addEventListener(
    "pointermove",
    handlePointerMove,
    { passive: false }
  );

  dom.fingerMeasureTarget?.addEventListener(
    "pointerup",
    handlePointerUp,
    { passive: false }
  );

  dom.fingerMeasureTarget?.addEventListener(
    "pointercancel",
    handlePointerCancel,
    { passive: false }
  );

  dom.fingerMeasureTarget?.addEventListener(
    "lostpointercapture",
    handleLostPointerCapture
  );

  // Initial UI refresh.
  updateTouchabilityUI(dom, state);

  return {
    open,
    close,
    applyFallback,

    // Expose a bound wrapper so external modules do not need to pass dom/state.
    applyTouchDiameterPx: (diameterPx, measured = true) =>
      applyTouchDiameterPx(dom, state, diameterPx, measured),

    updateUI: () => updateTouchabilityUI(dom, state),
  };
}


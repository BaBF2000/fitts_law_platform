/**
 * Calibration gesture helpers.
 *
 * Organigram reference:
 * - Calibration
 *   → Reference Object Resize
 *   → Passive Touch Area
 *   → Mouse / Pen Handle Interaction
 *
 * Responsibility:
 * Encapsulates safe resize behavior for the calibration rectangle.
 *
 * Important:
 * The calibration reference rectangle is passive for touch input. On large
 * touch displays, a physical reference card placed on the screen may generate
 * unwanted touch events. Therefore, direct touch resizing on the reference area
 * is disabled. Touchscreen-safe resizing is handled through an external range
 * slider. Mouse or pen resizing through the calibration handle remains available
 * for desktop use.
 *
 * This module only manages gesture state and width updates.
 * It does not compute final mm/px calibration results.
 */

/**
 * Compute the distance between two touch points.
 *
 * Kept as an exported helper for possible future gesture modes. Direct touch
 * resizing is currently disabled for calibration safety.
 */
export function touchDistance(t1, t2) {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;

  return Math.hypot(dx, dy);
}

function preventDefaultIfCancelable(e) {
  if (e.cancelable) {
    e.preventDefault();
  }
}

export function createCalibrationGestureController({
  dom,
  getRectWidthPx,
  setRectWidthPx,
  updateCalReadout,
  maybeSnapWidth,
}) {
  let dragging = false;
  let activePointerId = null;
  let dragStartX = 0;
  let startW = 0;

  /**
   * Start desktop-style resizing from the calibration handle.
   *
   * Touch input is ignored so tablet scrolling remains possible and the
   * physical calibration card cannot resize the rectangle accidentally.
   */
  function onHandlePointerDown(e) {
    if (!dom.calRect) return;

    if (e.pointerType === "touch") {
      return;
    }

    preventDefaultIfCancelable(e);

    dragging = true;
    activePointerId = e.pointerId;
    dragStartX = e.clientX;
    startW = getRectWidthPx();

    dom.handle?.setPointerCapture?.(e.pointerId);
  }

  function onHandlePointerMove(e) {
    if (!dragging || activePointerId !== e.pointerId || !dom.calRect) {
      return;
    }

    preventDefaultIfCancelable(e);

    const dx = e.clientX - dragStartX;

    let newW = startW + dx;
    newW = maybeSnapWidth(newW);

    setRectWidthPx(newW);
    updateCalReadout();
  }

  function onHandlePointerUp(e) {
    if (activePointerId !== e.pointerId) return;

    dragging = false;
    activePointerId = null;

    dom.handle?.releasePointerCapture?.(e.pointerId);
  }

  function bind() {
    dom.handle?.addEventListener(
      "pointerdown",
      onHandlePointerDown,
      { passive: false }
    );

    dom.handle?.addEventListener(
      "pointermove",
      onHandlePointerMove,
      { passive: false }
    );

    dom.handle?.addEventListener(
      "pointerup",
      onHandlePointerUp
    );

    dom.handle?.addEventListener(
      "pointercancel",
      onHandlePointerUp
    );
  }

  return {
    bind,
  };
}
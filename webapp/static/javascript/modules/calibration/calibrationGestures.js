/**
 * Calibration gesture helpers.
 *
 * Organigram reference:
 * - Calibration
 *   → Reference Object Resize
 *   → Touch / Mouse Interaction
 *
 * Responsibility:
 * Encapsulates mouse and touch resize gestures for the calibration rectangle.
 *
 * Important:
 * This module only manages gesture state and width updates.
 * It does not compute final mm/px calibration results.
 */

export function touchDistance(t1, t2) {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;

  return Math.hypot(dx, dy);
}

export function createCalibrationGestureController({
  dom,
  getRectWidthPx,
  setRectWidthPx,
  updateCalReadout,
  maybeSnapWidth,
}) {
  let dragging = false;
  let dragStartX = 0;
  let startW = 0;

  let pinching = false;
  let pinchStartDist = 0;
  let pinchStartW = 0;

  function onRectTouchStart(e) {
    if (!dom.calRect) return;

    e.preventDefault();

    const touches = e.touches;
    if (!touches) return;

    if (touches.length === 1) {
      dragging = true;
      pinching = false;

      dragStartX = touches[0].clientX;
      startW = getRectWidthPx();
      return;
    }

    if (touches.length >= 2) {
      pinching = true;
      dragging = false;

      pinchStartDist =
        touchDistance(touches[0], touches[1]);

      pinchStartW =
        getRectWidthPx();
    }
  }

  function onRectTouchMove(e) {
    if (!dom.calRect) return;
    if (!dragging && !pinching) return;

    e.preventDefault();

    const touches = e.touches;
    if (!touches) return;

    if (pinching && touches.length < 2) {
      pinching = false;
      dragging = true;

      dragStartX =
        touches[0]?.clientX ?? dragStartX;

      startW =
        getRectWidthPx();
    } else if (!pinching && touches.length >= 2) {
      pinching = true;
      dragging = false;

      pinchStartDist =
        touchDistance(touches[0], touches[1]);

      pinchStartW =
        getRectWidthPx();
    }

    let newW =
      getRectWidthPx();

    if (pinching && touches.length >= 2) {
      const dist =
        touchDistance(touches[0], touches[1]);

      const scale =
        dist / Math.max(1, pinchStartDist);

      newW =
        pinchStartW * scale;
    } else if (dragging && touches.length === 1) {
      const dx =
        touches[0].clientX - dragStartX;

      newW =
        startW + dx;
    }

    newW =
      maybeSnapWidth(newW);

    setRectWidthPx(newW);
    updateCalReadout();
  }

  function onRectTouchEnd(e) {
    const touches = e.touches;

    if (!touches || touches.length === 0) {
      dragging = false;
      pinching = false;
    }
  }

  function onHandleDown(e) {
    if (!dom.calRect) return;

    e.preventDefault();

    dragging = true;
    pinching = false;

    dragStartX = e.clientX;
    startW = getRectWidthPx();
  }

  function onMouseMove(e) {
    if (!dragging || !dom.calRect) return;

    const dx =
      e.clientX - dragStartX;

    let newW =
      startW + dx;

    newW =
      maybeSnapWidth(newW);

    setRectWidthPx(newW);
    updateCalReadout();
  }

  function onMouseUp() {
    dragging = false;
  }

  function bind() {
    dom.calRect?.addEventListener(
      "touchstart",
      onRectTouchStart,
      { passive: false }
    );

    dom.calRect?.addEventListener(
      "touchmove",
      onRectTouchMove,
      { passive: false }
    );

    dom.calRect?.addEventListener(
      "touchend",
      onRectTouchEnd,
      { passive: false }
    );

    dom.calRect?.addEventListener(
      "touchcancel",
      onRectTouchEnd,
      { passive: false }
    );

    dom.handle?.addEventListener(
      "mousedown",
      onHandleDown,
      { passive: false }
    );

    window.addEventListener(
      "mousemove",
      onMouseMove,
      { passive: false }
    );

    window.addEventListener(
      "mouseup",
      onMouseUp
    );
  }

  return {
    bind,
  };
}
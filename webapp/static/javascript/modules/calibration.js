import { clamp } from "../core/helpers.js";
import { saveCalibration } from "../core/storage.js";

export function initCalibration(dom, state, ui) {
  // Bank card size (ISO/IEC 7810 ID-1)
  const REF_MM = 85.60;
  const CARD_RATIO = 85.60 / 53.98;

  const N_SAMPLES = 3;

  // Pinch/drag state (local, not global app state)
  let dragging = false;
  let dragStartX = 0;
  let startW = 0;

  let pinching = false;
  let pinchStartDist = 0;
  let pinchStartW = 0;

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

    const factor = REF_MM / w;
    if (dom.calMmPerPx) {
      dom.calMmPerPx.textContent = `${factor.toFixed(4)} mm/px${extra ? " " + extra : ""}`;
    }
  }

  function touchDistance(t1, t2) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.hypot(dx, dy);
  }

  // ---- Touch handlers on the rectangle itself (best UX on tablets) ----

  function onRectTouchStart(e) {
    if (!dom.calRect) return;

    // CRITICAL: must be non-passive to prevent native zoom/scroll
    e.preventDefault();

    const touches = e.touches;
    if (!touches) return;

    if (touches.length === 1) {
      // One finger: drag-resize horizontally (dynamic, no tiny handle needed)
      dragging = true;
      pinching = false;

      dragStartX = touches[0].clientX;
      startW = getRectWidthPx();
      return;
    }

    if (touches.length >= 2) {
      // Two fingers: pinch-resize
      pinching = true;
      dragging = false;

      pinchStartDist = touchDistance(touches[0], touches[1]);
      pinchStartW = getRectWidthPx();
      return;
    }
  }

  function onRectTouchMove(e) {
    if (!dom.calRect) return;
    if (!dragging && !pinching) return;

    e.preventDefault();

    const touches = e.touches;
    if (!touches) return;

    // If user added/removed fingers mid-gesture, re-initialize cleanly
    if (pinching && touches.length < 2) {
      pinching = false;
      dragging = true;
      dragStartX = touches[0]?.clientX ?? dragStartX;
      startW = getRectWidthPx();
    } else if (!pinching && touches.length >= 2) {
      pinching = true;
      dragging = false;
      pinchStartDist = touchDistance(touches[0], touches[1]);
      pinchStartW = getRectWidthPx();
    }

    let newW = getRectWidthPx();

    if (pinching && touches.length >= 2) {
      const dist = touchDistance(touches[0], touches[1]);
      const scale = dist / Math.max(1, pinchStartDist);
      newW = pinchStartW * scale;
    } else if (dragging && touches.length === 1) {
      const dx = touches[0].clientX - dragStartX;
      newW = startW + dx;
    }

    newW = maybeSnapWidth(newW);
    setRectWidthPx(newW);
    updateCalReadout();
  }

  function onRectTouchEnd(e) {
    // end if no touches left
    const touches = e.touches;
    if (!touches || touches.length === 0) {
      dragging = false;
      pinching = false;
    }
  }

  // ---- Mouse handlers kept for desktop ----

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

    const dx = e.clientX - dragStartX;
    let newW = startW + dx;
    newW = maybeSnapWidth(newW);

    setRectWidthPx(newW);
    updateCalReadout();
  }

  function onMouseUp() {
    dragging = false;
  }

  // ---- Bind listeners ----
  // Touch on rectangle (main fix)
  dom.calRect?.addEventListener("touchstart", onRectTouchStart, { passive: false });
  dom.calRect?.addEventListener("touchmove", onRectTouchMove, { passive: false });
  dom.calRect?.addEventListener("touchend", onRectTouchEnd, { passive: false });
  dom.calRect?.addEventListener("touchcancel", onRectTouchEnd, { passive: false });

  // Optional: keep handle for mouse users (or if you like it)
  if (dom.handle) {
    dom.handle.addEventListener("mousedown", onHandleDown, { passive: false });
  }
  window.addEventListener("mousemove", onMouseMove, { passive: false });
  window.addEventListener("mouseup", onMouseUp);

  function resetSamples() {
    state.calSamples = [];
    updateCalReadout();
  }

  return {
    initRect() {
      if (!dom.calRect) return;

      // initial size
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
      const sample = REF_MM / w;

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
      const sorted = [...state.calSamples].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = (sorted.length % 2)
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;

      const varr =
        sorted.reduce((acc, v) => acc + (v - median) * (v - median), 0) /
        Math.max(1, sorted.length - 1);

      const sd = Math.sqrt(varr);

      state.mmPerPx = median;
      state.calErrorPct = (sd / median) * 100;

      saveCalibration({
        mmPerPx: state.mmPerPx,
        calRectWidthPx: w,
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
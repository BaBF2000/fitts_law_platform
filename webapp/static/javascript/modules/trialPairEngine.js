/**
 * Trial pair engine.
 *
 * Manages the runtime logic for one trial with two alternating targets:
 * - renders active and inactive targets
 * - validates touches against the active target
 * - detects wrong-target touches
 * - records interaction-level measurements
 * - alternates the active target after each valid hit
 * - summarizes repeated interactions at trial end
 */

import { nowMs, computeID } from "../core/helpers.js";
import { TouchArea } from "../targets/TouchArea.js";
import { DEFAULT_TOUCH_DIAMETER_PX } from "../core/constants.js";

function mean(values) {
  const xs = values.filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function renderTargetElement(el, targetObj, active) {
  if (!el || !targetObj) return;

  targetObj.render(el);
  el.classList.toggle("inactiveTarget", !active);
  el.classList.toggle("activeTarget", active);

  if (!active) {
    el.style.opacity = "0.35";
    el.style.filter = "grayscale(1)";
  } else {
    el.style.opacity = "1";
    el.style.filter = "none";
  }
}

export function createTrialPairEngine({
  dom,
  state,
  getDeviceContext,
  createTargetElement,
  onTrialFinished,
  onError,
  targetDebugOverlay = null,
}) {
  let debugPauseActive = false;

  function getActiveTarget() {
    return state.activeTargetKey === "a"
      ? state.currentPair?.targetA
      : state.currentPair?.targetB;
  }

  function getInactiveTarget() {
    return state.activeTargetKey === "a"
      ? state.currentPair?.targetB
      : state.currentPair?.targetA;
  }

  function renderPair() {
    if (!state.currentPair) return;

    renderTargetElement(
      state.currentPair.elA,
      state.currentPair.targetA,
      state.activeTargetKey === "a"
    );

    renderTargetElement(
      state.currentPair.elB,
      state.currentPair.targetB,
      state.activeTargetKey === "b"
    );
  }

  function startPairTrial(trialContext) {
    const {
      trial,
      targetA,
      targetB,
      plannedAxisWidth,
      resolved,
      prev,
      next,
    } = trialContext;

    const elA = createTargetElement("targetA");
    const elB = createTargetElement("targetB");

    state.currentPair = {
      trial,
      targetA,
      targetB,
      elA,
      elB,
      plannedAxisWidth,
      resolved,
      prev,
      next,
    };

    state.activeTargetKey = "b";
    state.interactionIndex = 0;
    state.interactionResults = [];
    state.startTime = nowMs();

    state.current = {
      ...trialContext.currentBase,
      targetObj: targetB,
      active_target_key: state.activeTargetKey,
      errors: 0,
      error_reasons: [],
      clicks_before_hit: 0,
    };

    renderPair();
  }

  async function handlePointerDown(e) {
    if (debugPauseActive) return;

    if (!state.currentPair || !state.current) return;

    const tag = (e.target?.tagName || "").toLowerCase();
    if (["input", "select", "button", "textarea", "label"].includes(tag)) return;

    e.preventDefault();

    const p = e.touches ? e.touches[0] : e;
    const touchDiameterPx =
      state.current.touch_diameter_px ?? DEFAULT_TOUCH_DIAMETER_PX;

    const touchArea = new TouchArea({
      x: p.clientX,
      y: p.clientY,
      diameterPx: touchDiameterPx,
    });

    const activeTarget = getActiveTarget();
    const inactiveTarget = getInactiveTarget();

    state.current.clicks_before_hit += 1;

    const inactiveValidation = inactiveTarget?.validateTouch(touchArea);
    if (inactiveValidation?.valid) {
      onError?.("wrong_target");
      return;
    }

    const validation = activeTarget.validateTouch(touchArea);

    if (!validation.valid) {
      const reason =
        validation.measuredOverlap > 0
          ? "partial_overlap"
          : "miss";
    
      onError?.(reason);
      return;
    }

    const end = nowMs();
    const mt = end - state.startTime;

    const from =
      state.activeTargetKey === "a"
        ? state.currentPair.next
        : state.currentPair.prev;

    const effectiveAxisWidth = activeTarget.getWidthOnMovementAxis(
      from.x,
      from.y,
      touchArea.x,
      touchArea.y
    );

    if (targetDebugOverlay) {
      let debugPauseActive = false;

      targetDebugOverlay.drawABCD({
        a: state.currentPair.prev,
        b: state.currentPair.next,
        c: state.currentPair.plannedAxisWidth.c,
        d: state.currentPair.plannedAxisWidth.d,
        effectiveA: from,
        effectiveB: { x: touchArea.x, y: touchArea.y },
        effectiveC: effectiveAxisWidth.c,
        effectiveD: effectiveAxisWidth.d,
        touchArea,
      });
    
      await new Promise((resolve) => setTimeout(resolve, 1200));

      debugPauseActive = false;
    }

    const DpxEff = Math.hypot(touchArea.x - from.x, touchArea.y - from.y);
    const DmmEff = state.mmPerPx ? DpxEff * state.mmPerPx : null;

    const WaxisEffMm =
      state.mmPerPx && Number.isFinite(effectiveAxisWidth.widthPx)
        ? effectiveAxisWidth.widthPx * state.mmPerPx
        : null;

    const IDeff =
      Number.isFinite(DmmEff) && Number.isFinite(WaxisEffMm)
        ? computeID(DmmEff, WaxisEffMm, "shannon")
        : null;

    const dev = getDeviceContext();
    const targetJSON = activeTarget.toResultJSON();
    const touchJSON = touchArea.toJSON();

    state.interactionResults.push({
      interaction_no: state.interactionIndex + 1,
      active_target_key: state.activeTargetKey,

      ua: dev.ua,
      platform: dev.platform,
      mobile_ua: dev.mobile_ua,

      screen_w: dev.screen_w,
      screen_h: dev.screen_h,
      viewport_w: dev.viewport_w,
      viewport_h: dev.viewport_h,
      dpr: dev.dpr,

      touch_support: dev.touch_support,
      max_touch_points: dev.max_touch_points,
      pointer_coarse: dev.pointer_coarse,
      pointer_fine: dev.pointer_fine,
      hover_capable: dev.hover_capable,

      hardware_concurrency: dev.hardware_concurrency,
      device_memory_gb: dev.device_memory_gb,
      prefers_reduced_motion: dev.prefers_reduced_motion,
      language: dev.language,
      timezone: dev.timezone,

      participant_id: state.current.participant_id,
      session_id: state.current.session_id,
      session_comment: state.current.session_comment,

      trial_no: state.current.trial_no,
      timestamp_iso: new Date().toISOString(),

      unit: state.current.unit,
      formula: "shannon",
      shape: state.current.shape ?? "circle",
      target_shape: state.current.target_shape,

      ...targetJSON,
      ...touchJSON,

      measured_overlap: validation.measuredOverlap,
      required_overlap: validation.requiredOverlap,
      hit_valid: validation.valid,

      W_axis_effective_px: effectiveAxisWidth.widthPx,
      W_axis_effective_mm: WaxisEffMm,

      D_px_effective: DpxEff,
      D_mm_effective: DmmEff,
      ID_effective: IDeff,

      mt_ms: mt,
      errors: state.current.errors,
      error_reasons: state.current.error_reasons.join("|"),
      clicks_before_hit: state.current.clicks_before_hit,

      mm_per_px: state.mmPerPx,
      touch_diameter_px_session: state.touchDiameterPx,
      touch_diameter_mm_session: state.touchDiameterMm,
    });

    state.interactionIndex += 1;

    const maxInteractions = Math.max(
      1,
      Math.min(10, Number(state.interactionsPerTrial) || 1)
    );

    if (state.interactionIndex >= maxInteractions) {
      const trialRows = state.interactionResults;
      const mtMean = mean(trialRows.map((r) => r.mt_ms));
      const idMean = mean(trialRows.map((r) => r.ID_effective));

      onTrialFinished?.({
        trialRows,
        summary: {
          mt_ms_mean: mtMean,
          ID_effective_mean: idMean,
          interactions: trialRows.length,
        },
      });

      return;
    }

    state.activeTargetKey = state.activeTargetKey === "a" ? "b" : "a";
    state.current.active_target_key = state.activeTargetKey;
    state.current.targetObj = getActiveTarget();
    state.startTime = nowMs();

    renderPair();
  }

  function clearPair() {
    state.currentPair?.elA?.remove?.();
    state.currentPair?.elB?.remove?.();

    state.currentPair = null;
    state.interactionIndex = 0;
    state.interactionResults = [];
    state.activeTargetKey = "a";
  }

  return {
    startPairTrial,
    handlePointerDown,
    clearPair,
  };
}
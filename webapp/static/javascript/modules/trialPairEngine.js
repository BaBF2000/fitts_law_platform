/**
 * Trial pair engine.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Pair Engine
 *   → Touch Validation
 *   → Interaction Recording
 *
 * Responsibility:
 * This module manages one running trial with two alternating targets.
 *
 * It handles:
 * - rendering active/inactive targets
 * - validating touches against the active target
 * - detecting wrong-target touches
 * - computing effective movement distance
 * - computing effective target width on the movement axis
 * - recording interaction-level result rows
 * - summarizing repeated interactions at trial end
 *
 * Extension guide:
 * - To change target geometry: edit targets/Target.js.
 * - To change touch-area behavior: edit targets/TouchArea.js.
 * - To change trial parameter generation: edit modules/trialParameters.js.
 * - To change final CSV fields: update buildInteractionResultRow().
 */

import { nowMs, isoNow, computeID } from "../core/helpers.js";
import { TouchArea } from "../targets/TouchArea.js";
import { DEFAULT_TOUCH_DIAMETER_PX } from "../core/constants.js";

/* -------------------------------------------------------------------------- */
/* Small statistics helpers                                                    */
/* -------------------------------------------------------------------------- */

function mean(values) {
  const xs = values.filter(Number.isFinite);
  return xs.length
    ? xs.reduce((a, b) => a + b, 0) / xs.length
    : NaN;
}

/* -------------------------------------------------------------------------- */
/* Target helpers                                                              */
/* -------------------------------------------------------------------------- */

function renderTargetElement(el, targetObj, active) {
  if (!el || !targetObj) return;

  targetObj.render(el);

  el.classList.toggle("inactiveTarget", !active);
  el.classList.toggle("activeTarget", active);

  el.style.opacity = active ? "1" : "0.35";
  el.style.filter = active ? "none" : "grayscale(1)";
}

function getActiveTarget(state) {
  return state.activeTargetKey === "a"
    ? state.currentPair?.targetA
    : state.currentPair?.targetB;
}

function getInactiveTarget(state) {
  return state.activeTargetKey === "a"
    ? state.currentPair?.targetB
    : state.currentPair?.targetA;
}

function getMovementOrigin(state) {
  return state.activeTargetKey === "a"
    ? state.currentPair.next
    : state.currentPair.prev;
}

/* -------------------------------------------------------------------------- */
/* Touch validation                                                            */
/* -------------------------------------------------------------------------- */

function shouldIgnorePointerEvent(e) {
  const tag = (e.target?.tagName || "").toLowerCase();

  return [
    "input",
    "select",
    "button",
    "textarea",
    "label",
  ].includes(tag);
}

function buildTouchAreaFromEvent(e, touchDiameterPx) {
  const p = e.touches ? e.touches[0] : e;

  return new TouchArea({
    x: p.clientX,
    y: p.clientY,
    diameterPx: touchDiameterPx,
  });
}

function validateTouchAgainstTargets({
  activeTarget,
  inactiveTarget,
  touchArea,
}) {
  const inactiveValidation =
    inactiveTarget?.validateTouch(touchArea);

  if (inactiveValidation?.valid) {
    return {
      valid: false,
      reason: "wrong_target",
      validation: null,
    };
  }

  const validation = activeTarget.validateTouch(touchArea);

  if (!validation.valid) {
    return {
      valid: false,
      reason:
        validation.measuredOverlap > 0
          ? "partial_overlap"
          : "miss",
      validation,
    };
  }

  return {
    valid: true,
    reason: null,
    validation,
  };
}

/* -------------------------------------------------------------------------- */
/* Measurement helpers                                                         */
/* -------------------------------------------------------------------------- */

function computeEffectiveMovement({
  state,
  activeTarget,
  touchArea,
}) {
  const from = getMovementOrigin(state);

  const effectiveAxisWidth =
    activeTarget.getWidthOnMovementAxis(
      from.x,
      from.y,
      touchArea.x,
      touchArea.y
    );

  const DpxEff =
    Math.hypot(touchArea.x - from.x, touchArea.y - from.y);

  const DmmEff =
    state?.mmPerPx ? DpxEff * state.mmPerPx : null;
  
  const WaxisEffMm =
    state?.mmPerPx &&
    Number.isFinite(effectiveAxisWidth.widthPx)
      ? effectiveAxisWidth.widthPx * state.mmPerPx
      : null;

  const IDeff =
    Number.isFinite(DmmEff) &&
    Number.isFinite(WaxisEffMm)
      ? computeID(DmmEff, WaxisEffMm, "shannon")
      : null;

  return {
    from,
    effectiveAxisWidth,
    DpxEff,
    DmmEff,
    WaxisEffMm,
    IDeff,
  };
}

async function drawDebugOverlayIfNeeded({
  targetDebugOverlay,
  state,
  movement,
  touchArea,
}) {
  if (!targetDebugOverlay) return;

  targetDebugOverlay.drawABCD({
    a: state.currentPair.prev,
    b: state.currentPair.next,

    c: state.currentPair.plannedAxisWidth.c,
    d: state.currentPair.plannedAxisWidth.d,

    effectiveA: movement.from,
    effectiveB: {
      x: touchArea.x,
      y: touchArea.y,
    },

    effectiveC: movement.effectiveAxisWidth.c,
    effectiveD: movement.effectiveAxisWidth.d,

    touchArea,
  });

  await new Promise((resolve) => setTimeout(resolve, 1200));
}

/* -------------------------------------------------------------------------- */
/* Result row construction                                                     */
/* -------------------------------------------------------------------------- */

function buildInteractionResultRow({
  state,
  validation,
  movement,
  touchArea,
  activeTarget,
  mt,
  getDeviceContext,
}) {
  const dev = getDeviceContext();
  const targetJSON = activeTarget.toResultJSON();
  const touchJSON = touchArea.toJSON();

  return {
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
    timestamp_iso: isoNow(),

    unit: state.current.unit,
    formula: "shannon",
    shape: state.current.shape ?? "circle",
    target_shape: state.current.target_shape,

    ...targetJSON,
    ...touchJSON,

    measured_overlap: validation.measuredOverlap,
    required_overlap: validation.requiredOverlap,
    hit_valid: validation.valid,

    W_axis_effective_px: movement.effectiveAxisWidth.widthPx,
    W_axis_effective_mm: movement.WaxisEffMm,

    D_px_effective: movement.DpxEff,
    D_mm_effective: movement.DmmEff,
    ID_effective: movement.IDeff,

    mt_ms: mt,

    errors: state.current.errors,
    error_reasons: state.current.error_reasons.join("|"),
    clicks_before_hit: state.current.clicks_before_hit,

    mm_per_px: state.mmPerPx,
    touch_diameter_px_session: state.touchDiameterPx,
    touch_diameter_mm_session: state.touchDiameterMm,
  };
}

/* -------------------------------------------------------------------------- */
/* Public engine factory                                                       */
/* -------------------------------------------------------------------------- */

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
    if (shouldIgnorePointerEvent(e)) return;

    e.preventDefault();

    const touchDiameterPx =
      state.current.touch_diameter_px ??
      DEFAULT_TOUCH_DIAMETER_PX;

    const touchArea =
      buildTouchAreaFromEvent(e, touchDiameterPx);

    const activeTarget = getActiveTarget(state);
    const inactiveTarget = getInactiveTarget(state);

    state.current.clicks_before_hit += 1;

    const touchCheck = validateTouchAgainstTargets({
      activeTarget,
      inactiveTarget,
      touchArea,
    });

    if (!touchCheck.valid) {
      onError?.(touchCheck.reason);
      return;
    }

    const mt = nowMs() - state.startTime;

    const movement = computeEffectiveMovement({
      state,
      activeTarget,
      touchArea,
    });

    if (targetDebugOverlay) {
      debugPauseActive = true;

      await drawDebugOverlayIfNeeded({
        targetDebugOverlay,
        state,
        movement,
        touchArea,
      });

      debugPauseActive = false;
    }

    const row = buildInteractionResultRow({
      state,
      validation: touchCheck.validation,
      movement,
      touchArea,
      activeTarget,
      mt,
      getDeviceContext,
    });

    state.interactionResults.push(row);
    state.interactionIndex += 1;

    const maxInteractions = Math.max(
      1,
      Math.min(10, Number(state.interactionsPerTrial) || 1)
    );

    if (state.interactionIndex >= maxInteractions) {
      finishTrial();
      return;
    }

    switchActiveTarget();
  }

  function finishTrial() {
    const trialRows = state.interactionResults;

    const mtMean =
      mean(trialRows.map((r) => r.mt_ms));

    const idMean =
      mean(trialRows.map((r) => r.ID_effective));

    onTrialFinished?.({
      trialRows,
      summary: {
        mt_ms_mean: mtMean,
        ID_effective_mean: idMean,
        interactions: trialRows.length,
      },
    });
  }

  function switchActiveTarget() {
    state.activeTargetKey =
      state.activeTargetKey === "a" ? "b" : "a";

    state.current.active_target_key =
      state.activeTargetKey;

    state.current.targetObj =
      getActiveTarget(state);

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
    debugPauseActive = false;
  }

  return {
    startPairTrial,
    handlePointerDown,
    clearPair,
  };
}
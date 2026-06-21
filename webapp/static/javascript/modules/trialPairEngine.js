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
/* Small statistics helpers                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Compute the arithmetic mean of finite numeric values.
 *
 * Args:
 *   values: Array of numeric values.
 *
 * Returns:
 *   Mean of all finite values, or NaN if no finite value exists.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Used to summarize movement time and effective ID across repeated
 *   interactions within one trial.
 */
function mean(values) {
  const xs = values.filter(Number.isFinite);
  return xs.length
    ? xs.reduce((a, b) => a + b, 0) / xs.length
    : NaN;
}

/* -------------------------------------------------------------------------- */
/* Target helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Render one target element and mark it as active or inactive.
 *
 * Args:
 *   el: DOM element used to display the target.
 *   targetObj: Target instance to render.
 *   active: Whether this target is currently the active target.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Mutates the target DOM element by rendering geometry, toggling CSS classes
 *   and changing visual opacity/filter.
 *
 * Behavior:
 *   Active targets are fully visible. Inactive targets remain visible but are
 *   visually de-emphasized.
 */
function renderTargetElement(el, targetObj, active) {
  if (!el || !targetObj) return;

  targetObj.render(el);

  el.classList.toggle("inactiveTarget", !active);
  el.classList.toggle("activeTarget", active);

  el.style.opacity = active ? "1" : "0.35";
  el.style.filter = active ? "none" : "grayscale(1)";
}

/**
 * Return the currently active target object.
 *
 * Args:
 *   state: Shared application state containing currentPair and activeTargetKey.
 *
 * Returns:
 *   Active Target instance, or undefined if no current pair exists.
 *
 * Side effects:
 *   None.
 */
function getActiveTarget(state) {
  return state.activeTargetKey === "a"
    ? state.currentPair?.targetA
    : state.currentPair?.targetB;
}

/**
 * Return the currently inactive target object.
 *
 * Args:
 *   state: Shared application state containing currentPair and activeTargetKey.
 *
 * Returns:
 *   Inactive Target instance, or undefined if no current pair exists.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Used to detect touches on the wrong target before validating the active
 *   target.
 */
function getInactiveTarget(state) {
  return state.activeTargetKey === "a"
    ? state.currentPair?.targetB
    : state.currentPair?.targetA;
}

/**
 * Return the planned movement origin for the current active target.
 *
 * Args:
 *   state: Shared application state containing currentPair and activeTargetKey.
 *
 * Returns:
 *   Point object { x, y } representing the origin of the current movement.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   When target B is active, the movement starts from prev.
 *   When target A is active, the movement starts from next.
 */
function getMovementOrigin(state) {
  return state.activeTargetKey === "a"
    ? state.currentPair.next
    : state.currentPair.prev;
}

/* -------------------------------------------------------------------------- */
/* Touch validation                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Check whether a pointer event should be ignored by the experiment engine.
 *
 * Args:
 *   e: Pointer or touch event.
 *
 * Returns:
 *   true if the event target is an interactive UI element, otherwise false.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Prevents clicks on inputs, buttons or labels from being interpreted as
 *   experiment touches.
 */
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

/**
 * Build a circular TouchArea object from a pointer or touch event.
 *
 * Args:
 *   e: Pointer event or touch event.
 *   touchDiameterPx: Touch diameter in CSS pixels.
 *
 * Returns:
 *   TouchArea instance centered at the event coordinates.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   For touch events, the first touch point is used. For pointer/mouse events,
 *   the event itself provides clientX/clientY.
 */
function buildTouchAreaFromEvent(e, touchDiameterPx) {
  const p = e.touches ? e.touches[0] : e;

  return new TouchArea({
    x: p.clientX,
    y: p.clientY,
    diameterPx: touchDiameterPx,
  });
}

/**
 * Validate a touch against the active and inactive targets.
 *
 * Args:
 *   activeTarget: Target that should be hit.
 *   inactiveTarget: Other target in the pair, used for wrong-target detection.
 *   touchArea: TouchArea instance representing the finger contact.
 *
 * Returns:
 *   Object containing:
 *   - valid: whether the touch is accepted
 *   - reason: null, "wrong_target", "partial_overlap" or "miss"
 *   - validation: active-target validation result, or null for wrong target
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Wrong-target touches are detected first. If the inactive target is hit, the
 *   interaction is rejected as "wrong_target" even if the active target may also
 *   overlap partly.
 */
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
/* Measurement helpers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Compute effective movement metrics from the actual touch location.
 *
 * Args:
 *   state: Shared application state containing current pair and calibration.
 *   activeTarget: Target that was successfully hit.
 *   touchArea: TouchArea instance created from the actual pointer event.
 *
 * Returns:
 *   Object containing:
 *   - from: effective movement origin
 *   - effectiveAxisWidth: target width geometry along the actual movement axis
 *   - DpxEff: effective movement distance in CSS pixels
 *   - DmmEff: effective movement distance in millimeters, or null
 *   - WaxisEffMm: effective axis width in millimeters, or null
 *   - IDeff: effective Fitts ID, or null
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Effective values are based on the actual touch point, not only on planned
 *   target centers. This makes the recorded interaction more representative of
 *   the participant's movement.
 */
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

/**
 * Draw the target debug overlay after a valid touch, if debugging is enabled.
 *
 * Args:
 *   targetDebugOverlay: TargetDebugOverlay instance, or null.
 *   state: Shared application state containing current pair geometry.
 *   movement: Effective movement data from computeEffectiveMovement().
 *   touchArea: TouchArea instance for the actual touch.
 *
 * Returns:
 *   Promise<void>.
 *
 * Side effects:
 *   Draws an SVG debug overlay and pauses briefly so the developer can inspect
 *   the geometry.
 *
 * Important:
 *   This helper is only used in debug mode. It must not run during normal
 *   experiment measurement unless target debugging is intentionally enabled.
 */
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
/* Result row construction                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Build one interaction-level result row.
 *
 * Args:
 *   state: Shared application state containing current trial/session metadata.
 *   validation: Active-target validation result.
 *   movement: Effective movement metrics.
 *   touchArea: TouchArea instance for the accepted touch.
 *   activeTarget: Target instance that was hit.
 *   mt: Movement time in milliseconds.
 *   getDeviceContext: Function returning browser/device metadata.
 *
 * Returns:
 *   Flat result row object used for frontend CSV export and backend storage.
 *
 * Side effects:
 *   Reads current device context and current ISO timestamp.
 *
 * Stored data:
 *   - interaction number and active target key
 *   - browser/device context
 *   - participant/session/trial metadata
 *   - target geometry
 *   - touch geometry
 *   - validation and overlap values
 *   - effective D, W and ID values
 *   - movement time and error counters
 */
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

    // Device and browser context.
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

    // Participant/session/trial metadata.
    participant_id: state.current.participant_id,
    session_id: state.current.session_id,
    session_comment: state.current.session_comment,

    trial_no: state.current.trial_no,
    timestamp_iso: isoNow(),

    unit: state.current.unit,
    formula: "shannon",
    shape: state.current.shape ?? "circle",
    target_shape: state.current.target_shape,

    // Target and touch geometry.
    ...targetJSON,
    ...touchJSON,

    // Validation outcome.
    measured_overlap: validation.measuredOverlap,
    required_overlap: validation.requiredOverlap,
    hit_valid: validation.valid,

    // Effective movement and target-width values.
    W_axis_effective_px: movement.effectiveAxisWidth.widthPx,
    W_axis_effective_mm: movement.WaxisEffMm,

    D_px_effective: movement.DpxEff,
    D_mm_effective: movement.DmmEff,
    ID_effective: movement.IDeff,

    // Timing and error counters.
    mt_ms: mt,

    errors: state.current.errors,
    error_reasons: state.current.error_reasons.join("|"),
    clicks_before_hit: state.current.clicks_before_hit,

    // Calibration and touchability session context.
    mm_per_px: state.mmPerPx,
    touch_diameter_px_session: state.touchDiameterPx,
    touch_diameter_mm_session: state.touchDiameterMm,
  };
}

/* -------------------------------------------------------------------------- */
/* Public engine factory                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Create the trial-pair runtime engine.
 *
 * Args:
 *   dom: Centralized DOM reference object.
 *   state: Shared application state.
 *   getDeviceContext: Function returning device/browser metadata.
 *   createTargetElement: Function that creates DOM elements for target A/B.
 *   onTrialFinished: Callback called when all interactions for the trial are done.
 *   onError: Callback called when an invalid touch occurs.
 *   targetDebugOverlay: Optional TargetDebugOverlay instance.
 *
 * Returns:
 *   Object containing:
 *   - startPairTrial()
 *   - handlePointerDown()
 *   - clearPair()
 *
 * Side effects:
 *   Creates closures over state and runtime callbacks.
 *
 * Responsibility:
 *   Manages one two-target trial with alternating active targets.
 */
export function createTrialPairEngine({
  dom,
  state,
  getDeviceContext,
  createTargetElement,
  onTrialFinished,
  onError,
  targetDebugOverlay = null,
}) {
  // Prevent pointer handling while the debug overlay pause is active.
  let debugPauseActive = false;

  /**
   * Render both targets in their current active/inactive state.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Updates both target DOM elements.
   */
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

  /**
   * Start a new two-target trial.
   *
   * Args:
   *   trialContext: Object containing trial data, target instances, planned
   *   geometry, resolved parameters and base result metadata.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Creates target DOM elements, initializes currentPair/current state,
   *   resets interaction counters and renders the first active target.
   *
   * Behavior:
   *   The trial starts with target B as the active target, so the first movement
   *   is from prev to next.
   */
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

      // The first valid contact starts the timing sequence.
      // It is not stored as a movement-time row.
      awaiting_first_successful_contact: true,
    };

    renderPair();
  }

  /**
   * Handle one pointer/touch event during a running pair trial.
   *
   * Args:
   *   e: Pointer or touch event.
   *
   * Returns:
   *   Promise<void>.
   *
   * Side effects:
   *   May prevent default browser behavior, update error counters through
   *   onError(), append interaction result rows, switch active targets or finish
   *   the trial.
   *
   * Behavior:
   *   - ignores UI element events
   *   - builds a TouchArea from the event
   *   - validates against active/inactive targets
   *   - computes movement time and effective geometry
   *   - records one interaction row after a valid hit
   *   - switches target or finishes the trial
   */
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
    
    // The first valid touch is used as the starting contact.
    // It starts the timer for the next movement but is not recorded as MT.
    if (state.current.awaiting_first_successful_contact) {
      state.current.awaiting_first_successful_contact = false;
      switchActiveTarget();
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

    // Limit repeated interactions per trial to a safe range.
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

  /**
   * Finish the current pair trial and emit interaction rows plus summary values.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Calls onTrialFinished() with all interaction rows and summary statistics.
   *
   * Summary:
   *   - mean movement time
   *   - mean effective ID
   *   - number of valid interactions
   */
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

  /**
   * Switch the active target after a valid interaction.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Updates activeTargetKey, current target object, start time and rendered
   *   target states.
   *
   * Behavior:
   *   Resets the movement timer so the next interaction measures movement time
   *   from the moment the active target changes.
   */
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

  /**
   * Clear the current target pair and reset pair-trial state.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Removes target DOM elements and resets current pair/interactions/debug
   *   state fields.
   *
   * Related usage:
   *   Called when a trial ends, when the experiment is reset or when the run is
   *   aborted.
   */
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
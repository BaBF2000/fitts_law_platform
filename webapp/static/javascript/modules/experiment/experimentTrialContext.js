/**
 * Trial context builder.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Generator
 *   → Trial Context
 *
 * Responsibility:
 * Builds the runtime trial context stored in state.current.
 *
 * Important:
 * This module does not place targets and does not validate pointer hits.
 * It only collects all metadata needed during the active trial and later result
 * export.
 *
 * Related modules:
 * - experiment.js calls buildCurrentTrialContext() after target placement.
 * - trialPairEngine.js reads this context while recording interactions.
 * - experimentResultRows.js reuses this context to build trial summary rows.
 */

/**
 * Build the runtime context object for the current trial.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   trial: Trial definition generated from the protocol/session blocks.
 *   trialShape: Concrete runtime shape used for this trial.
 *
 *   paramMode: Active parameter mode, for example "A_W", "ID_W" or "ID_A".
 *
 *   A_in: User-entered or sampled amplitude value in the selected unit.
 *   W_in: User-entered or sampled width value in the selected unit.
 *   ID_in: User-entered or sampled index-of-difficulty value.
 *
 *   ApxPlannedActual: Planned center-to-center amplitude after placement.
 *   Wpx: Effective target width in CSS pixels.
 *
 *   Amm: Planned amplitude in millimeters, when calibration is available.
 *   Wmm: Effective target width in millimeters, when calibration is available.
 *
 *   ID_planned: Planned index of difficulty computed from planned geometry.
 *
 *   plannedAxisWidth: Width of the active target along the movement axis.
 *
 *   prev: Previous target center position.
 *   next: Next target center position.
 *
 *   touchDiameterPx: Active finger/touch diameter in CSS pixels.
 *   requiredOverlap: Required overlap ratio used for hit validation.
 *
 * Returns:
 *   Runtime trial context object stored in state.current.
 *
 * Side effects:
 *   None. This function only builds and returns a plain object.
 *
 * Purpose:
 *   Centralizes all trial metadata required for:
 *   - interaction recording
 *   - hit validation context
 *   - final trial summary rows
 *   - CSV export
 *   - backend result saving
 */
export function buildCurrentTrialContext({
  dom,
  state,
  trial,
  trialShape,

  paramMode,

  A_in,
  W_in,
  ID_in,

  ApxPlannedActual,
  Wpx,

  Amm,
  Wmm,

  ID_planned,

  plannedAxisWidth,

  prev,
  next,

  touchDiameterPx,
  requiredOverlap,
}) {
  return {
    // Participant and session metadata are read from the setup form.
    participant_id:
      dom.participantId?.value?.trim() || "P?",

    session_id:
      dom.sessionId?.value?.trim() || "S?",

    session_comment:
      state.sessionComment || "",

    // Trial identity and basic design metadata.
    trial_no: trial.trial_no,
    demo: false,

    unit: trial.unit,
    formula: "shannon",

    // Protocol-level shape value. This can still be "shuffle".
    shape: trial.shape,

    // Concrete runtime shape actually used in this trial.
    target_shape: trialShape,

    // Original user-entered or sampled values before runtime conversion.
    A_in,
    W_in,
    ID_in,

    // Planned amplitude after placement, expressed in CSS pixels.
    A_px_planned:
      ApxPlannedActual,

    // Effective target width in CSS pixels.
    W_px:
      Wpx,

    // Planned amplitude and target width in millimeters when calibration exists.
    A_mm_planned:
      Amm,

    W_mm:
      Wmm,

    // Planned Fitts' Law index of difficulty.
    ID_planned,

    // Target width measured along the planned movement axis.
    W_axis_planned_px:
      plannedAxisWidth.widthPx,

    W_axis_planned_mm:
      state.mmPerPx &&
      Number.isFinite(plannedAxisWidth.widthPx)
        ? plannedAxisWidth.widthPx * state.mmPerPx
        : null,

    // Axis boundary points used for geometry inspection/debugging.
    axis_planned_c_x:
      plannedAxisWidth.c?.x ?? null,

    axis_planned_c_y:
      plannedAxisWidth.c?.y ?? null,

    axis_planned_d_x:
      plannedAxisWidth.d?.x ?? null,

    axis_planned_d_y:
      plannedAxisWidth.d?.y ?? null,

    // Parameter-generation mode used for this trial.
    param_mode:
      paramMode,

    // Randomization flags inherited from the generated trial definition.
    random_A:
      !!trial.random_A,

    random_W:
      !!trial.random_W,

    random_ID:
      !!trial.random_ID,

    // Previous target position.
    prev_x:
      prev.x,

    prev_y:
      prev.y,

    // Current/next target position.
    x:
      next.x,

    y:
      next.y,

    // Placement status or diagnostic flag returned by the placement helper.
    placed:
      next.placed,

    // Touchability and hit-validation parameters.
    touch_diameter_px:
      touchDiameterPx,

    required_overlap:
      requiredOverlap,

    // Runtime fields updated later by interaction validation.
    lastTouchArea: null,
    lastValidation: null,
  };
}
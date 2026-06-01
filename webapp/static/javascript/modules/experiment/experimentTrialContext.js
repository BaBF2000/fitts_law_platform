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
    participant_id:
      dom.participantId?.value?.trim() || "P?",

    session_id:
      dom.sessionId?.value?.trim() || "S?",

    session_comment:
      state.sessionComment || "",

    trial_no: trial.trial_no,
    demo: false,

    unit: trial.unit,
    formula: "shannon",
    shape: trial.shape,

    target_shape: trialShape,

    A_in,
    W_in,
    ID_in,

    A_px_planned:
      ApxPlannedActual,

    W_px:
      Wpx,

    A_mm_planned:
      Amm,

    W_mm:
      Wmm,

    ID_planned,

    W_axis_planned_px:
      plannedAxisWidth.widthPx,

    W_axis_planned_mm:
      state.mmPerPx &&
      Number.isFinite(plannedAxisWidth.widthPx)
        ? plannedAxisWidth.widthPx * state.mmPerPx
        : null,

    axis_planned_c_x:
      plannedAxisWidth.c?.x ?? null,

    axis_planned_c_y:
      plannedAxisWidth.c?.y ?? null,

    axis_planned_d_x:
      plannedAxisWidth.d?.x ?? null,

    axis_planned_d_y:
      plannedAxisWidth.d?.y ?? null,

    param_mode:
      paramMode,

    random_A:
      !!trial.random_A,

    random_W:
      !!trial.random_W,

    random_ID:
      !!trial.random_ID,

    prev_x:
      prev.x,

    prev_y:
      prev.y,

    x:
      next.x,

    y:
      next.y,

    placed:
      next.placed,

    touch_diameter_px:
      touchDiameterPx,

    required_overlap:
      requiredOverlap,

    lastTouchArea: null,
    lastValidation: null,
  };
}
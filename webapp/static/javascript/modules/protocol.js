/**
 * Protocol builder and validator.
 *
 * Organigram reference:
 * - Experiment Design
 *   → Protocol Builder
 *   → Protocol Validation
 * - Monte-Carlo-Simulation
 *   → Protocol Diagnostics
 *
 * Responsibility:
 * Builds, applies and validates protocol objects used by the experiment.
 *
 * This module handles:
 * - reading protocol settings from the UI
 * - normalizing sampling modes
 * - validating A/W/ID entries
 * - validating touchability and W constraints
 * - attaching Monte Carlo summary data
 * - applying a saved protocol back to the UI/state
 *
 * Important:
 * This module does not persist protocols.
 * Database persistence is handled by core/server.js.
 *
 * Historical session snapshots are saved separately when experiment results
 * are sent to the backend.
 *
 * Extension guide:
 * - To add a new parameter mode: extend validateProtocol().
 * - To add a new sampling mode: update normalizeSampling().
 * - To change Monte Carlo summary fields: edit attachMonteCarloSummary().
 * - To change DB save/load behavior: edit core/server.js.
 */

import {
  getTargetSizeBoundsPx,
} from "./experimentConstraints.js";

import {
  convertToPxAndMm,
  parseNumberOrList,
} from "../core/helpers.js";

import {
  runMonteCarloProtocol,
} from "./monteCarlo.js";

/**
 * Parse an integer and clamp it to a safe range.
 *
 * Args:
 *   value: Raw input value, usually read from a DOM input.
 *   min: Minimum accepted integer.
 *   max: Maximum accepted integer.
 *   fallback: Value returned when input cannot be parsed as a finite number.
 *
 * Returns:
 *   Rounded integer constrained to [min, max], or fallback for invalid input.
 *
 * Side effects:
 *   None.
 *
 * Related usage:
 *   Used to normalize trial count and interactions per trial.
 */
function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Normalize a sampling mode identifier.
 *
 * Args:
 *   value: Raw sampling mode from UI or legacy protocol data.
 *
 * Returns:
 *   Supported sampling mode string.
 *
 * Side effects:
 *   None.
 *
 * Supported modes:
 *   - uniform
 *   - truncated_uniform
 *   - normal
 *   - truncated_normal
 *
 * Legacy aliases:
 *   - safe_uniform → truncated_uniform
 *   - centered_normal → normal
 *
 * Behavior:
 *   Unknown values fall back to "uniform".
 */
function normalizeSampling(value) {
  if (value === "safe_uniform") return "truncated_uniform";
  if (value === "centered_normal") return "normal";

  if (
    value === "uniform" ||
    value === "truncated_uniform" ||
    value === "normal" ||
    value === "truncated_normal"
  ) {
    return value;
  }

  return "uniform";
}

/**
 * Return the minimum touchable W in pixels for a given shape.
 *
 * Args:
 *   shape: Target shape identifier.
 *   state: Shared application state containing touchabilityByShape.
 *
 * Returns:
 *   Minimum touchable target width in CSS pixels, or null if no shape-specific
 *   touchability data exists.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   - For "shuffle", the safest maximum minimum size across all shuffled shapes
 *     is used.
 *   - For a specific shape, the matching shape value is used when available.
 *   - If the shape has no direct entry, polygon or circle fallback values are
 *     used.
 *
 * Important:
 *   This check protects directly entered W values against measured
 *   participant-specific touchability constraints.
 */
function getWMinForShape(shape, state) {
  if (!state.touchabilityByShape) return null;

  if (shape === "shuffle") {
    return Math.max(
      state.touchabilityByShape.circle ?? 0,
      state.touchabilityByShape.square ?? 0,
      state.touchabilityByShape.triangle ?? 0,
      state.touchabilityByShape.pentagon ?? 0,
      state.touchabilityByShape.hexagon ?? 0,
      state.touchabilityByShape.octagon ?? 0,
      state.touchabilityByShape.diamond ?? 0
    );
  }

  return (
    state.touchabilityByShape[shape] ??
    state.touchabilityByShape.polygon ??
    state.touchabilityByShape.circle ??
    null
  );
}

/**
 * Return current target-width clamp bounds in pixels.
 *
 * Args:
 *   state: Shared application state containing calibration, viewport and admin
 *     constraint settings.
 *
 * Returns:
 *   Object containing:
 *   - minW: minimum allowed target width in CSS pixels
 *   - maxW: maximum allowed target width in CSS pixels
 *
 * Side effects:
 *   None.
 *
 * Related usage:
 *   Used by warnAboutWClamp() to warn about planned W values outside active
 *   technical bounds.
 */
function getWClampBoundsPx(state) {
  const { minPx, maxPx } =
    getTargetSizeBoundsPx(state);

  return {
    minW: minPx,
    maxW: maxPx,
  };
}

/**
 * Validate directly entered W values against measured touchability.
 *
 * Args:
 *   block: Session block definition.
 *   protocol: Protocol object containing global unit mode.
 *   state: Shared application state containing calibration and touchability data.
 *   index: Zero-based block index used for user-facing messages.
 *
 * Returns:
 *   Validation result object:
 *   - ok: true when W is valid
 *   - message: German error message when W is invalid
 *
 * Side effects:
 *   None.
 *
 * Checked modes:
 *   Only modes with user-defined W are checked here:
 *   - A_W
 *   - ID_W
 *
 * Important:
 *   In ID_A mode, W is computed later from A and ID, then protected in
 *   trialParameters.js.
 */
function validateBlockW(block, protocol, state, index) {
  const shape = block.shape ?? "circle";
  const paramMode = block.param_mode ?? "A_W";
  const wMinPx = getWMinForShape(shape, state);

  // If no touchability information exists, W cannot be shape-validated here.
  if (!wMinPx) return { ok: true };

  // Only validate W when W is directly entered by the user.
  if (!["A_W", "ID_W"].includes(paramMode)) {
    return { ok: true };
  }

  const spec = parseNumberOrList(block.width_entered);

  if (spec.kind === "invalid") {
    return {
      ok: false,
      message: `Block ${index + 1}: W ist ungültig.`,
    };
  }

  for (const value of spec.values) {
    const conv =
      convertToPxAndMm(value, protocol.distanceMode, state.mmPerPx);

    if (!Number.isFinite(conv.px)) {
      return {
        ok: false,
        message: `Block ${index + 1}: W konnte nicht in Pixel umgerechnet werden.`,
      };
    }

    if (conv.px < wMinPx) {
      return {
        ok: false,
        message:
          `Block ${index + 1}: Zielbreite W ist zu klein.\n` +
          `Eingegeben: ${conv.px.toFixed(1)} px\n` +
          `Erforderlich: mindestens ${wMinPx.toFixed(1)} px\n` +
          `Bitte W erhöhen oder die Zielform ändern.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Build a serializable protocol object from the current UI state.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing sessionBlocks.
 *   sessionDesign: Session design editor API, expected to provide
 *     applyBlocksFromUI().
 *
 * Returns:
 *   Protocol object representing the current editable experiment design.
 *
 * Side effects:
 *   Reads block values from the UI into state.sessionBlocks and normalizes
 *   trial count / interactions per trial DOM input values.
 *
 * Stored fields:
 *   - protocol name and comment
 *   - trial count
 *   - distance unit/mode
 *   - sampling modes for A, W and ID
 *   - timeout
 *   - interactions per trial
 *   - session block definitions
 *
 * Important:
 *   This object is a reusable protocol template until a run starts. The final
 *   session snapshot is created later in runHandlers.js.
 */
export function buildProtocolObject(dom, state, sessionDesign) {
  sessionDesign.applyBlocksFromUI();

  const trialCount =
    clampInt(dom.trialCount?.value, 5, 25, 10);

  const interactionsPerTrial =
    clampInt(dom.interactionsPerTrial?.value, 1, 10, 1);

  // Keep UI inputs synchronized with the normalized values.
  if (dom.trialCount) {
    dom.trialCount.value = String(trialCount);
  }

  if (dom.interactionsPerTrial) {
    dom.interactionsPerTrial.value = String(interactionsPerTrial);
  }

  const protocol = {
    protocol_name: dom.protocolName?.value?.trim() || "",
    protocol_comment: dom.protocolComment?.value?.trim() || "",

    trialCount,
    distanceMode: dom.distanceMode?.value || "relative",
    a_sampling: normalizeSampling(dom.aSampling?.value),
    w_sampling: normalizeSampling(dom.wSampling?.value),
    id_sampling: normalizeSampling(dom.idSampling?.value),
    timeoutMs: Number(dom.timeoutMs?.value) || 0,
    interactionsPerTrial,
    sessionBlocks: state.sessionBlocks || [],
  };

  return protocol;
}

/**
 * Attach a compact Monte Carlo summary to a protocol object.
 *
 * Args:
 *   protocol: Protocol object to enrich.
 *   state: Shared application state used by the Monte Carlo simulation.
 *
 * Returns:
 *   The same protocol object with monte_carlo_summary attached.
 *
 * Side effects:
 *   Mutates the given protocol object by adding monte_carlo_summary.
 *
 * Behavior:
 *   Runs a reduced Monte Carlo simulation and stores only summary diagnostics
 *   that are relevant for protocol review and database persistence.
 *
 * Important:
 *   This is not the full dashboard simulation. It uses a smaller n and fewer
 *   histogram bins to keep saving/validation responsive.
 */
export function attachMonteCarloSummary(protocol, state) {
  const monteCarlo = runMonteCarloProtocol({
    protocol,
    state,
    n: 2000,
    histogramBins: 40,
  });

  protocol.monte_carlo_summary = {
    generated_at: Date.now(),

    warning_count:
      monteCarlo?.meta?.warning_count ?? 0,

    worst_clamp_pct:
      monteCarlo?.meta?.worst_clamp_pct ?? 0,

    worst_diagnostic:
      monteCarlo?.meta?.worst_diagnostic ?? "unknown",

    mean_clamped_min_pct:
      monteCarlo?.meta?.mean_clamped_min_pct ?? 0,

    mean_clamped_max_pct:
      monteCarlo?.meta?.mean_clamped_max_pct ?? 0,
  };

  return protocol;
}

/**
 * Apply a saved protocol object back to the UI and runtime state.
 *
 * Args:
 *   protocol: Saved protocol object loaded from the backend or existing state.
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   sessionDesign: Session design editor API.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates protocol inputs, sampling controls, distance mode, timeout,
 *   interactions per trial, state.sessionBlocks, protocol status and rendered
 *   block editor UI.
 *
 * Compatibility:
 *   Supports old property names such as protocolName/name and
 *   protocolComment/comment.
 *
 * Important:
 *   Applying a protocol loads it into the editable protocol draft. It does not
 *   start a run and does not modify historical session snapshots.
 */
export function applyProtocolObject(protocol, dom, state, sessionDesign) {
  if (!protocol) return;

  if (dom.protocolName) {
    dom.protocolName.value =
      protocol.protocol_name ??
      protocol.protocolName ??
      protocol.name ??
      "";
  }

  if (dom.protocolComment) {
    dom.protocolComment.value =
      protocol.protocol_comment ??
      protocol.protocolComment ??
      protocol.comment ??
      "";
  }

  if (dom.trialCount) {
    dom.trialCount.value = protocol.trialCount ?? 10;
  }

  if (dom.aSampling) {
    dom.aSampling.value = normalizeSampling(protocol.a_sampling);
  }

  if (dom.wSampling) {
    dom.wSampling.value = normalizeSampling(protocol.w_sampling);
  }

  if (dom.idSampling) {
    dom.idSampling.value = normalizeSampling(protocol.id_sampling);
  }

  if (dom.distanceMode) {
    dom.distanceMode.value = protocol.distanceMode ?? "relative";
  }

  if (dom.timeoutMs) {
    dom.timeoutMs.value = protocol.timeoutMs ?? 0;
  }

  if (dom.interactionsPerTrial) {
    dom.interactionsPerTrial.value = protocol.interactionsPerTrial ?? 1;
  }

  state.interactionsPerTrial = protocol.interactionsPerTrial ?? 1;
  state.sessionBlocks = protocol.sessionBlocks || [];
  state.protocolReady = !!state.sessionBlocks.length;

  // Re-render the session block editor so the UI reflects the loaded protocol.
  sessionDesign.updateTrialCount();
  sessionDesign.renderBlocks({ allowEmpty: true });

  if (dom.protocolStatus) {
    dom.protocolStatus.textContent =
      state.protocolReady ? "Bereit" : "Nicht bereit";
  }
}

/**
 * Validate the current protocol before saving or starting the experiment.
 *
 * Args:
 *   protocol: Protocol object built from the current UI.
 *   state: Shared application state containing calibration and touchability data.
 *
 * Returns:
 *   Validation result object:
 *   - ok: true when the protocol is valid
 *   - message: German error message when invalid
 *
 * Side effects:
 *   None.
 *
 * Validation checks:
 *   - At least one session block exists.
 *   - Millimeter mode requires calibration.
 *   - A/W/ID fields are valid depending on parameter mode.
 *   - Required overlap is between 0 and 1.
 *   - Directly entered W values respect participant touchability constraints.
 */
export function validateProtocol(protocol, state) {
  if (!protocol.sessionBlocks?.length) {
    return {
      ok: false,
      message: "Bitte mindestens einen Block definieren.",
    };
  }

  if (protocol.distanceMode === "mm" && !state.mmPerPx) {
    return {
      ok: false,
      message: "Einheit mm gewählt, aber keine Kalibrierung vorhanden.",
    };
  }

  for (let i = 0; i < protocol.sessionBlocks.length; i++) {
    const block = protocol.sessionBlocks[i];
    const paramMode = block.param_mode ?? "A_W";

    const A = parseNumberOrList(block.dist_entered);
    const W = parseNumberOrList(block.width_entered);
    const ID = parseNumberOrList(block.id_entered);

    if (["A_W", "ID_A"].includes(paramMode) && A.kind === "invalid") {
      return {
        ok: false,
        message: `Block ${i + 1}: A ist ungültig.`,
      };
    }

    if (["A_W", "ID_W"].includes(paramMode) && W.kind === "invalid") {
      return {
        ok: false,
        message: `Block ${i + 1}: W ist ungültig.`,
      };
    }

    if (["ID_A", "ID_W"].includes(paramMode) && ID.kind === "invalid") {
      return {
        ok: false,
        message: `Block ${i + 1}: ID ist ungültig.`,
      };
    }

    const overlap = Number(block.required_overlap ?? 1);

    if (!Number.isFinite(overlap) || overlap < 0 || overlap > 1) {
      return {
        ok: false,
        message: `Block ${i + 1}: Required Overlap muss zwischen 0 und 1 liegen.`,
      };
    }

    const wCheck = validateBlockW(block, protocol, state, i);
    if (!wCheck.ok) return wCheck;
  }

  return { ok: true };
}

/**
 * Update protocol readiness state and UI label.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   ready: Whether the current protocol is considered ready.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates state.protocolReady and the protocol status label.
 *
 * Important:
 *   UI text is German by design.
 */
export function markProtocolStatus(dom, state, ready) {
  state.protocolReady = !!ready;

  if (dom.protocolStatus) {
    dom.protocolStatus.textContent = ready ? "Bereit" : "Nicht bereit";
  }
}

/**
 * Warn the user when planned W values will be clamped by target-size bounds.
 *
 * Args:
 *   WpxValues: Array of planned W values in CSS pixels.
 *   randomW: Whether W values come from a randomized distribution.
 *   state: Shared application state containing current target-size constraints.
 *
 * Returns:
 *   true if the user accepts or no warning is needed, otherwise false.
 *
 * Side effects:
 *   May show blocking browser confirmation dialogs.
 *
 * Behavior:
 *   - For fixed W, warns when the entered value lies below Wmin or above Wmax.
 *   - For random W, warns when the entire distribution collapses to a bound.
 *   - For partly out-of-range random W, warns that the effective distribution
 *     will be distorted by clamping.
 *
 * Important:
 *   This is a manual warning helper. If Monte Carlo diagnostics already handle
 *   these cases elsewhere, this function may be legacy or backup logic.
 */
export function warnAboutWClamp({ WpxValues, randomW, state }) {
  const { minW, maxW } = getWClampBoundsPx(state);

  const below = WpxValues.filter((w) => w < minW).length;
  const above = WpxValues.filter((w) => w > maxW).length;
  const total = WpxValues.length;

  if (!total) return true;

  if (!randomW) {
    const w = WpxValues[0];

    if (w < minW) {
      return confirm(
        `Achtung: Die eingegebene Zielbreite W liegt unter Wmin.\n\n` +
        `W entered: ${w.toFixed(1)} px\n` +
        `Wmin: ${minW.toFixed(1)} px\n\n` +
        `Die Zielbreite wird auf Wmin recadriert.`
      );
    }

    if (w > maxW) {
      return confirm(
        `Achtung: Die eingegebene Zielbreite W liegt über Wmax.\n\n` +
        `W entered: ${w.toFixed(1)} px\n` +
        `Wmax: ${maxW.toFixed(1)} px\n\n` +
        `Die Zielbreite wird auf Wmax recadriert.`
      );
    }

    return true;
  }

  if (below === total) {
    return confirm(
      `Achtung: Alle randomisierten W-Werte liegen unter Wmin.\n\n` +
      `Dadurch gibt es praktisch keine Variabilität in der Zielgröße, ` +
      `weil alle Werte auf Wmin recadriert werden.`
    );
  }

  if (above === total) {
    return confirm(
      `Achtung: Alle randomisierten W-Werte liegen über Wmax.\n\n` +
      `Dadurch gibt es praktisch keine Variabilität in der Zielgröße, ` +
      `weil alle Werte auf Wmax recadriert werden.`
    );
  }

  if (below > 0 || above > 0) {
    return confirm(
      `Achtung: Die randomisierte W-Verteilung wird durch Clamp verzerrt.\n\n` +
      `${below}/${total} Werte liegen unter Wmin.\n` +
      `${above}/${total} Werte liegen über Wmax.\n\n` +
      `Werte außerhalb der Grenzen werden auf Wmin oder Wmax recadriert. ` +
      `Die effektive Verteilung ist daher nicht mehr wirklich uniform.`
    );
  }

  return true;
}
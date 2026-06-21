/**
 * Parameter sampling module.
 *
 * Organigram reference:
 * - Experiment Design
 *   → Session Blocks
 *   → Sampling
 * - Monte Carlo Simulation
 *   → Parameter Generator
 *
 * Responsibility:
 * This file converts user-entered parameter definitions into numeric values
 * or numeric ranges. It is used by both the real experiment engine and the
 * Monte Carlo simulation.
 *
 * Extension guide:
 * To add a new probability distribution, do NOT modify this file first.
 * Add the new distribution in:
 *
 *   core/distributions.js
 *
 * Then make sure the distribution name is passed from the UI/protocol into
 * sampleParameter().
 */

import { parseNumberOrList } from "../core/helpers.js";
import { sampleDistribution } from "../core/distributions.js";

/**
 * Default fallback ranges for Monte Carlo parameter exploration.
 *
 * These values are used only when a block input cannot be converted into a
 * valid numeric range. They provide safe baseline ranges for A, W and ID.
 *
 * Units:
 * - A and W defaults are relative values.
 * - ID is unitless.
 */
const DEFAULT_RANGES = {
  A: [0.05, 0.8],
  W: [0.02, 0.3],
  ID: [1, 7],
};

/**
 * Parse a user input specification into numeric values.
 *
 * Args:
 *   input: User-entered value, either a single number or a JSON-style list.
 *
 * Returns:
 *   Array of numeric values. Returns an empty array when the input is invalid.
 *
 * Side effects:
 *   None.
 *
 * Supported examples:
 *   - "0.5"           -> [0.5]
 *   - "[0.1,0.3,0.5]" -> [0.1, 0.3, 0.5]
 *   - invalid input   -> []
 *
 * Related helper:
 *   parseNumberOrList() performs the actual parsing and validation.
 */
export function valuesFromSpec(input) {
  const spec = parseNumberOrList(input);

  if (spec.kind === "invalid") {
    return [];
  }

  return spec.values;
}

/**
 * Return the min/max range represented by a user specification.
 *
 * Args:
 *   input: User-entered value, either a single number or a list.
 *   fallback: Range returned when the input is invalid or empty.
 *
 * Returns:
 *   Two-element array [min, max].
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   - Single value input returns [value, value].
 *   - List input returns [min(list), max(list)].
 *   - Invalid input returns fallback.
 */
export function rangeFromSpec(input, fallback = [0, 1]) {
  const values = valuesFromSpec(input);

  if (!values.length) {
    return fallback;
  }

  return [
    Math.min(...values),
    Math.max(...values),
  ];
}

/**
 * Build the effective sampling range for one parameter.
 *
 * Args:
 *   input: User-entered value, either a single number or a list.
 *   random: Whether random sampling is enabled for this parameter.
 *   fallback: Range returned when the input is invalid or empty.
 *
 * Returns:
 *   Two-element array [min, max].
 *
 * Side effects:
 *   None.
 *
 * Rules:
 *   - list input: range is min(list) to max(list)
 *   - fixed input + random=false: range is [value, value]
 *   - fixed input + random=true: range is [0, value]
 *
 * Related usage:
 *   Used for Monte Carlo range construction, not for drawing one runtime
 *   parameter sample directly.
 */
function rangeFromSpecWithRandom(input, random, fallback = [0, 1]) {
  const values = valuesFromSpec(input);

  if (!values.length) {
    return fallback;
  }

  if (values.length > 1) {
    return [
      Math.min(...values),
      Math.max(...values),
    ];
  }

  const value = values[0];

  if (random) {
    return [0, value];
  }

  return [value, value];
}

/**
 * Compute optional truncation bounds for truncated distributions.
 *
 * Args:
 *   distribution: Sampling distribution identifier.
 *   requestedMin: Lower bound requested by the protocol/input.
 *   requestedMax: Upper bound requested by the protocol/input.
 *   minOverride: Optional feasible lower bound in the same unit as the input.
 *   maxOverride: Optional feasible upper bound in the same unit as the input.
 *
 * Returns:
 *   Object containing:
 *   - truncateMin: lower truncation bound or null
 *   - truncateMax: upper truncation bound or null
 *   - valid: whether the resulting truncation interval is valid
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Truncation is only applied for:
 *   - truncated_uniform
 *   - truncated_normal
 *
 * Important:
 *   minOverride and maxOverride do not affect normal/uniform sampling here.
 *   They are passed only to explicitly truncated distributions.
 */
function getTruncationBounds({
  distribution,
  requestedMin,
  requestedMax,
  minOverride,
  maxOverride,
}) {
  const usesTruncation =
    distribution === "truncated_uniform" ||
    distribution === "truncated_normal";

  if (!usesTruncation) {
    return {
      truncateMin: null,
      truncateMax: null,
      valid: true,
    };
  }

  const truncateMin = Number.isFinite(minOverride)
    ? Math.max(requestedMin, minOverride)
    : null;

  const truncateMax = Number.isFinite(maxOverride)
    ? Math.min(requestedMax, maxOverride)
    : null;

  const valid =
    !Number.isFinite(truncateMin) ||
    !Number.isFinite(truncateMax) ||
    truncateMax >= truncateMin;

  return {
    truncateMin,
    truncateMax,
    valid,
  };
}

/**
 * Sample one numeric parameter from a user specification.
 *
 * Args:
 *   input: User-entered value, either a single number or a list.
 *   random: Whether continuous random sampling is enabled for a single value.
 *   distribution: Distribution used for continuous random sampling.
 *   fallback: Value returned when sampling cannot be performed.
 *   minOverride: Optional feasible lower bound in the same unit as the input.
 *   maxOverride: Optional feasible upper bound in the same unit as the input.
 *
 * Returns:
 *   One numeric sampled value.
 *
 * Side effects:
 *   Uses Math.random() indirectly for randomized sampling.
 *
 * Rules:
 *   - lists are sampled uniformly from the listed values
 *   - fixed values remain fixed when random=false
 *   - fixed values become a continuous range [0, value] when random=true
 *   - distribution controls the continuous sampling behavior
 *
 * Feasible bounds:
 *   minOverride and maxOverride are optional bounds in the same unit as the
 *   input. They are only used by truncated distributions.
 *
 * Important:
 *   This function is used by both the runtime experiment and Monte Carlo
 *   simulation, so changes here affect both planned trials and diagnostics.
 */
export function sampleParameter({
  input,
  random = false,
  distribution = "uniform",
  fallback = NaN,

  minOverride = null,
  maxOverride = null,
} = {}) {
  const values = valuesFromSpec(input);

  if (!values.length) {
    return fallback;
  }

  // A list represents discrete choices. One listed value is selected uniformly.
  if (values.length > 1) {
    const index = Math.floor(Math.random() * values.length);
    return values[index];
  }

  const value = values[0];

  // A single value remains fixed unless random sampling is explicitly enabled.
  if (!random) {
    return value;
  }

  const requestedMin = 0;
  const requestedMax = value;

  const {
    truncateMin,
    truncateMax,
    valid,
  } = getTruncationBounds({
    distribution,
    requestedMin,
    requestedMax,
    minOverride,
    maxOverride,
  });

  if (!valid) {
    return fallback;
  }

  return sampleDistribution({
    distribution,
    min: requestedMin,
    max: requestedMax,
    truncateMin,
    truncateMax,
  });
}

/**
 * Build Monte Carlo ranges for one protocol block.
 *
 * Args:
 *   block: Protocol/session block object containing A, W and ID definitions.
 *
 * Returns:
 *   Object containing:
 *   - ARange: effective amplitude range
 *   - WRange: effective target-width range
 *   - IDRange: effective index-of-difficulty range
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   These ranges are used to estimate how the planned parameter space behaves
 *   under the real application constraints.
 *
 * Important:
 *   The returned ranges describe the planned input space. Later Monte Carlo
 *   steps may still clamp or transform values according to viewport and target
 *   size constraints.
 */
export function buildRangesFromBlock(block) {
  return {
    ARange: rangeFromSpecWithRandom(
      block?.dist_entered,
      !!block?.random_A,
      DEFAULT_RANGES.A
    ),

    WRange: rangeFromSpecWithRandom(
      block?.width_entered,
      !!block?.random_W,
      DEFAULT_RANGES.W
    ),

    IDRange: rangeFromSpecWithRandom(
      block?.id_entered,
      !!block?.random_ID,
      DEFAULT_RANGES.ID
    ),
  };
}
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

const DEFAULT_RANGES = {
  A: [0.05, 0.8],
  W: [0.02, 0.3],
  ID: [1, 7],
};

/**
 * Parse a user input specification into numeric values.
 *
 * Supported examples:
 * - "0.5"               -> [0.5]
 * - "[0.1,0.3,0.5]"     -> [0.1, 0.3, 0.5]
 * - invalid input       -> []
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
 * Rules:
 * - list input: range is min(list) to max(list)
 * - fixed input + random=false: range is [value, value]
 * - fixed input + random=true: range is [0, value]
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
 * Truncation is only applied for:
 * - truncated_uniform
 * - truncated_normal
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
 * Rules:
 * - lists are sampled uniformly from the listed values
 * - fixed values remain fixed when random=false
 * - fixed values become a continuous range [0, value] when random=true
 * - distribution controls the continuous sampling behavior
 *
 * Feasible bounds:
 * minOverride and maxOverride are optional bounds in the same unit as the
 * input. They are only used by truncated distributions.
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

  if (values.length > 1) {
    const index = Math.floor(Math.random() * values.length);
    return values[index];
  }

  const value = values[0];

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
 * These ranges are used to estimate how the planned parameter space behaves
 * under the real application constraints.
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
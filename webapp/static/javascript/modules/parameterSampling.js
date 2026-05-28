import { parseNumberOrList } from "../core/helpers.js";
import { sampleDistribution } from "../core/distributions.js";

/**
 * Convert a user parameter entry into numeric values.
 */
export function valuesFromSpec(input) {
  const spec = parseNumberOrList(input);

  if (spec.kind === "invalid") return [];

  return spec.values;
}

/**
 * Build a numeric range from a parameter specification.
 */
export function rangeFromSpec(input, fallback = [0, 1]) {
  const values = valuesFromSpec(input);

  if (!values.length) return fallback;

  return [
    Math.min(...values),
    Math.max(...values),
  ];
}

/**
 * Sample one parameter value from a user specification.
 *
 * Rules:
 * - lists are sampled uniformly from listed values
 * - fixed values remain fixed when random=false
 * - fixed values become [0, value] when random=true
 * - distribution controls continuous random sampling
 */
export function sampleParameter({
  input,
  random = false,
  distribution = "uniform",
  fallback = NaN,

  // Optional feasible bounds in the same unit as the input.
  minOverride = null,
  maxOverride = null,
} = {}) {
  const values = valuesFromSpec(input);

  if (!values.length) return fallback;

  if (values.length > 1) {
    const i = Math.floor(Math.random() * values.length);
    return values[i];
  }

  const value = values[0];

  if (!random) {
    return value;
  }

  const requestedMin = 0;
  const requestedMax = value;
  
  const useTruncated =
    distribution === "truncated_uniform" ||
    distribution === "truncated_normal";
  
  const truncateMin =
    useTruncated && Number.isFinite(minOverride)
      ? Math.max(requestedMin, minOverride)
      : null;
  
  const truncateMax =
    useTruncated && Number.isFinite(maxOverride)
      ? Math.min(requestedMax, maxOverride)
      : null;
  
  if (
    useTruncated &&
    Number.isFinite(truncateMin) &&
    Number.isFinite(truncateMax) &&
    truncateMax < truncateMin
  ) {
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

function rangeFromSpecWithRandom(input, random, fallback = [0, 1]) {
  const values = valuesFromSpec(input);

  if (!values.length) return fallback;

  if (values.length > 1) {
    return [Math.min(...values), Math.max(...values)];
  }

  const value = values[0];

  if (random) {
    return [0, value];
  }

  return [value, value];
}

/**
 * Build Monte Carlo ranges for one protocol block.
 */
export function buildRangesFromBlock(block) {
  return {
    ARange: rangeFromSpecWithRandom(
      block?.dist_entered,
      !!block?.random_A,
      [0.05, 0.8]
    ),

    WRange: rangeFromSpecWithRandom(
      block?.width_entered,
      !!block?.random_W,
      [0.02, 0.3]
    ),

    IDRange: rangeFromSpecWithRandom(
      block?.id_entered,
      !!block?.random_ID,
      [1, 7]
    ),
  };
}
/**
 * Distribution sampling helpers.
 *
 * Organigram reference:
 * - Experiment Design
 *   → Sampling
 * - Monte Carlo Simulation
 *   → Parameter Generator
 *
 * Responsibility:
 * This module is the single source of truth for stochastic sampling.
 * It is used by:
 * - runtime parameter sampling
 * - Monte Carlo simulation
 *
 * Extension guide:
 * To add a new distribution:
 * 1. Add its name to SUPPORTED_DISTRIBUTIONS.
 * 2. Add a sampling function.
 * 3. Register it in DISTRIBUTION_SAMPLERS.
 * 4. Add the option to the UI if users should be able to select it.
 *
 * No other module should implement its own probability sampling logic.
 */

// Distribution identifiers supported by protocol design, runtime sampling and
// Monte Carlo simulation. Values must stay synchronized with UI select options
export const SUPPORTED_DISTRIBUTIONS = [
  "uniform",
  "truncated_uniform",
  "normal",
  "truncated_normal",
];

/**
 * Sample a uniformly distributed value between min and max.
 *
 * Args:
 *   min: Lower bound of the sampling range.
 *   max: Upper bound of the sampling range.
 *
 * Returns:
 *   Number sampled from [min, max).
 *
 * Side effects:
 *   Uses Math.random().
 */
export function randUniform(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Sample a normally distributed value using the Box-Muller transform.
 *
 * Args:
 *   mean: Mean value of the normal distribution.
 *   sd: Standard deviation of the normal distribution.
 *
 * Returns:
 *   Number sampled from N(mean, sd²).
 *
 * Side effects:
 *   Uses Math.random().
 *
 * Notes:
 *   Number.EPSILON prevents log(0) when generating the Box-Muller input.
 */
export function randNormal(mean, sd) {
  const u1 = Math.max(Math.random(), Number.EPSILON);
  const u2 = Math.random();

  return (
    mean +
    sd *
      Math.sqrt(-2 * Math.log(u1)) *
      Math.cos(2 * Math.PI * u2)
  );
}

/**
 * Check whether a numeric sampling range is valid.
 *
 * Args:
 *   min: Lower range bound.
 *   max: Upper range bound.
 *
 * Returns:
 *   true if both bounds are finite numbers and max >= min.
 *
 * Side effects:
 *   None.
 */
function isValidRange(min, max) {
  return (
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    max >= min
  );
}

/**
 * Resolve mean and standard deviation for normal sampling.
 *
 * Args:
 *   Object with min, max, optional mean and optional sd.
 *
 * Returns:
 *   Object with numeric mean and sd.
 *
 * Defaults:
 *   - mean defaults to the center of [min, max].
 *   - sd defaults to (max - min) / 6, so roughly ±3 SD covers the range.
 *
 * Side effects:
 *   None.
 */
function resolveNormalParams({ min, max, mean, sd }) {
  return {
    mean: Number.isFinite(mean)
      ? mean
      : (min + max) / 2,

    sd: Number.isFinite(sd) && sd > 0
      ? sd
      : (max - min) / 6,
  };
}

/**
 * Resolve explicit truncation bounds or fall back to the original range.
 *
 * Args:
 *   Object with min, max, optional truncateMin and optional truncateMax.
 *
 * Returns:
 *   Object with min and max fields representing the effective truncation range.
 *
 * Behavior:
 *   Explicit truncation bounds are used only when both are finite and
 *   truncateMax >= truncateMin. Otherwise, the original min/max range is used.
 *
 * Side effects:
 *   None.
 */
function resolveTruncationBounds({
  min,
  max,
  truncateMin,
  truncateMax,
}) {
  const hasTruncation =
    Number.isFinite(truncateMin) &&
    Number.isFinite(truncateMax) &&
    truncateMax >= truncateMin;

  return {
    min: hasTruncation ? truncateMin : min,
    max: hasTruncation ? truncateMax : max,
  };
}

function sampleUniform({ min, max }) {
  return randUniform(min, max);
}

/**
 * Sample a uniformly distributed value inside the effective truncation range.
 *
 * Args:
 *   Object with min, max and optional truncateMin/truncateMax.
 *
 * Returns:
 *   Number sampled from the intersection of [min, max] and the truncation
 *   bounds, or NaN if the resulting range is invalid.
 *
 * Side effects:
 *   Uses Math.random().
 */
function sampleTruncatedUniform({
  min,
  max,
  truncateMin,
  truncateMax,
}) {
  const bounds = resolveTruncationBounds({
    min,
    max,
    truncateMin,
    truncateMax,
  });

  const lo = Math.max(min, bounds.min);
  const hi = Math.min(max, bounds.max);

  if (!isValidRange(lo, hi)) {
    return NaN;
  }

  return randUniform(lo, hi);
}

function sampleNormal({
  min,
  max,
  mean,
  sd,
}) {
  const params = resolveNormalParams({
    min,
    max,
    mean,
    sd,
  });

  return randNormal(params.mean, params.sd);
}

/**
 * Sample a normally distributed value with truncation bounds.
 *
 * Args:
 *   Object with min, max, optional mean, optional sd, optional truncation bounds
 *   and optional maxAttempts.
 *
 * Returns:
 *   Number inside the effective truncation bounds.
 *
 * Behavior:
 *   Rejection sampling is attempted first. If no valid value is found after
 *   maxAttempts, one normal sample is generated and clamped to the truncation
 *   bounds as a fallback.
 *
 * Side effects:
 *   Uses Math.random().
 *
 * Notes:
 *   The clamp fallback prevents infinite loops for narrow or unlikely
 *   truncation intervals, but it can create additional mass at the boundaries.
 */
function sampleTruncatedNormal({
  min,
  max,
  mean,
  sd,
  truncateMin,
  truncateMax,
  maxAttempts = 100,
}) {
  const bounds = resolveTruncationBounds({
    min,
    max,
    truncateMin,
    truncateMax,
  });

  const params = resolveNormalParams({
    min,
    max,
    mean,
    sd,
  });

  for (let i = 0; i < maxAttempts; i++) {
    const value = randNormal(params.mean, params.sd);

    if (value >= bounds.min && value <= bounds.max) {
      return value;
    }
  }
  // Fallback: clamp one final normal sample to avoid returning NaN or looping
  // indefinitely. This may create boundary mass and should be interpreted by
  // Monte Carlo diagnostics as possible distribution distortion.
  const fallback = randNormal(params.mean, params.sd);

  return Math.max(
    bounds.min,
    Math.min(bounds.max, fallback)
  );
}

// Registry mapping distribution names to their sampler functions.
// sampleDistribution() uses this registry so new distributions can be added
// without changing the public sampling interface.
// Registry mapping distribution names to their sampler functions.
// sampleDistribution() uses this registry so new distributions can be added
// without changing the public sampling interface.
const DISTRIBUTION_SAMPLERS = {
  uniform: sampleUniform,
  truncated_uniform: sampleTruncatedUniform,
  normal: sampleNormal,
  truncated_normal: sampleTruncatedNormal,
};

/**
 * Normalize distribution identifiers from UI, saved protocols or legacy data.
 *
 * Examples:
 *   "truncated uniform" -> "truncated_uniform"
 *   "truncated-uniform" -> "truncated_uniform"
 *   ""                  -> "uniform"
 */
function normalizeDistributionName(value) {
  return String(value || "uniform")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Sample one value from a named probability distribution.
 *
 * Args:
 *   options: Sampling configuration object. Expected fields include:
 *     - distribution: name from SUPPORTED_DISTRIBUTIONS
 *     - min: lower range bound
 *     - max: upper range bound
 *     - mean, sd: optional normal distribution parameters
 *     - truncateMin, truncateMax: optional truncation bounds
 *
 * Returns:
 *   Number sampled from the selected distribution, or NaN if min/max are
 *   invalid.
 */
export function sampleDistribution(options = {}) {
  const {
    distribution = "uniform",
    min,
    max,
  } = options;

  if (!isValidRange(min, max)) {
    return NaN;
  }

  const key = normalizeDistributionName(distribution);

  const sampler =
    DISTRIBUTION_SAMPLERS[key] ??
    DISTRIBUTION_SAMPLERS.uniform;

  return sampler(options);
}
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

export const SUPPORTED_DISTRIBUTIONS = [
  "uniform",
  "truncated_uniform",
  "normal",
  "truncated_normal",
];

export function randUniform(min, max) {
  return min + Math.random() * (max - min);
}

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

function isValidRange(min, max) {
  return (
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    max >= min
  );
}

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

  const fallback = randNormal(params.mean, params.sd);

  return Math.max(
    bounds.min,
    Math.min(bounds.max, fallback)
  );
}

const DISTRIBUTION_SAMPLERS = {
  uniform: sampleUniform,
  truncated_uniform: sampleTruncatedUniform,
  normal: sampleNormal,
  truncated_normal: sampleTruncatedNormal,
};

/**
 * Sample one value from a named probability distribution.
 *
 * Unknown distributions intentionally fall back to "uniform" to keep the
 * application robust when loading older or malformed protocols.
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

  const sampler =
    DISTRIBUTION_SAMPLERS[distribution] ??
    DISTRIBUTION_SAMPLERS.uniform;

  return sampler(options);
}
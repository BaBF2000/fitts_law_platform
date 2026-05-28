/**
 * Distribution sampling helpers.
 *
 * This module is the single source of truth for stochastic sampling.
 * It is used by Monte Carlo and later by runtime parameter sampling.
 */

export function randUniform(min, max) {
  return min + Math.random() * (max - min);
}

export function randNormal(mean, sd) {
  const u1 = Math.max(Math.random(), Number.EPSILON);
  const u2 = Math.random();

  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function sampleDistribution({
  distribution = "uniform",
  min,
  max,
  mean = null,
  sd = null,
  truncateMin = null,
  truncateMax = null,
  maxAttempts = 100,
} = {}) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
    return NaN;
  }

  const hasTruncation =
    Number.isFinite(truncateMin) &&
    Number.isFinite(truncateMax) &&
    truncateMax >= truncateMin;

  const tMin = hasTruncation ? truncateMin : min;
  const tMax = hasTruncation ? truncateMax : max;

  if (distribution === "uniform") {
    return randUniform(min, max);
  }

  if (distribution === "truncated_uniform") {
    const lo = Math.max(min, tMin);
    const hi = Math.min(max, tMax);
  
    if (hi < lo) return NaN;
  
    return randUniform(lo, hi);
  }

  if (distribution === "normal") {
    const m = Number.isFinite(mean) ? mean : (min + max) / 2;
    const s = Number.isFinite(sd) && sd > 0 ? sd : (max - min) / 6;
    return randNormal(m, s);
  }

  if (distribution === "truncated_normal") {
    const m = Number.isFinite(mean) ? mean : (min + max) / 2;
    const s = Number.isFinite(sd) && sd > 0 ? sd : (max - min) / 6;

    for (let i = 0; i < maxAttempts; i++) {
      const value = randNormal(m, s);

      if (value >= tMin && value <= tMax) {
        return value;
      }
    }

    return Math.max(tMin, Math.min(tMax, randNormal(m, s)));
  }

  return randUniform(min, max);
}
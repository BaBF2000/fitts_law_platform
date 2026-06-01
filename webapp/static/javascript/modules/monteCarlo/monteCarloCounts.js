/**
 * Monte Carlo count helpers.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Constraint Analysis
 *   → Clamp Counting
 *
 * Responsibility:
 * Tracks how many simulated samples are:
 * - valid
 * - invalid
 * - clamped to the minimum target size
 * - clamped to the maximum target size
 *
 * This module does not run the simulation.
 * It only manages count values and percentages.
 */

export function pct(value, total) {
  return total
    ? (100 * value) / total
    : 0;
}

export function createSimulationCounts() {
  return {
    total: 0,
    invalid: 0,
    clamped_min: 0,
    clamped_max: 0,
  };
}

export function updateClampCounts(counts, clampInfo) {
  counts.total += 1;

  if (clampInfo.clampedMin) {
    counts.clamped_min += 1;
  }

  if (clampInfo.clampedMax) {
    counts.clamped_max += 1;
  }

  return counts;
}

export function updateInvalidCount(counts) {
  counts.invalid += 1;
  return counts;
}

export function finalizeCounts(counts) {
  const clampTotal =
    counts.clamped_min + counts.clamped_max;

  return {
    ...counts,

    clamped_min_pct:
      pct(counts.clamped_min, counts.total),

    clamped_max_pct:
      pct(counts.clamped_max, counts.total),

    clamped_total_pct:
      pct(clampTotal, counts.total),
  };
}
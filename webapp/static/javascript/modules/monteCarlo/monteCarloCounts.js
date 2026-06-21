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
 *
 * Related modules:
 * - monteCarloEngine.js updates these counts while simulating samples.
 * - monteCarloDiagnostics.js interprets count percentages as warnings.
 * - experimentConstraints.js provides the clamp information used here.
 */

/**
 * Compute a percentage from a value and a total.
 *
 * Args:
 *   value: Count value to convert into a percentage.
 *   total: Total number of samples or observations.
 *
 * Returns:
 *   Percentage value in the range 0..100 when total is positive.
 *   Returns 0 when total is 0.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Avoids division-by-zero issues when computing simulation percentages.
 */
export function pct(value, total) {
  return total
    ? (100 * value) / total
    : 0;
}

/**
 * Create an empty Monte Carlo count object.
 *
 * Returns:
 *   New count object initialized with zero values.
 *
 * Fields:
 *   - total: number of processed samples
 *   - invalid: number of invalid samples
 *   - clamped_min: number of samples clamped to the minimum W bound
 *   - clamped_max: number of samples clamped to the maximum W bound
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Provides a consistent initial structure for simulation count tracking.
 */
export function createSimulationCounts() {
  return {
    total: 0,
    invalid: 0,
    clamped_min: 0,
    clamped_max: 0,
  };
}

/**
 * Update clamp-related counts for one simulated sample.
 *
 * Args:
 *   counts: Mutable simulation count object.
 *   clampInfo: Clamp diagnostic object, usually returned by
 *     analyzeTargetSizeClamp().
 *
 * Returns:
 *   The same counts object after updating it.
 *
 * Side effects:
 *   Mutates counts.total, counts.clamped_min and/or counts.clamped_max.
 *
 * Behavior:
 *   Every call increments total by one. Then the function increments the
 *   corresponding clamp counters when clampInfo reports a minimum or maximum
 *   clamp.
 *
 * Important:
 *   This function assumes the sample is part of the processed simulation set.
 */
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

/**
 * Update the invalid-sample count.
 *
 * Args:
 *   counts: Mutable simulation count object.
 *
 * Returns:
 *   The same counts object after updating it.
 *
 * Side effects:
 *   Mutates counts.invalid.
 *
 * Purpose:
 *   Tracks samples that could not be evaluated as valid Monte Carlo cases.
 *
 * Important:
 *   This function does not increment counts.total. The caller decides whether
 *   invalid samples should also be included in the total processed count.
 */
export function updateInvalidCount(counts) {
  counts.invalid += 1;
  return counts;
}

/**
 * Finalize raw simulation counts by adding percentage fields.
 *
 * Args:
 *   counts: Simulation count object containing raw count values.
 *
 * Returns:
 *   New object containing the original counts plus:
 *   - clamped_min_pct
 *   - clamped_max_pct
 *   - clamped_total_pct
 *
 * Side effects:
 *   None. The returned object is a new object created with spread syntax.
 *
 * Behavior:
 *   Percentages are computed relative to counts.total. If total is 0, all
 *   percentages return 0 through pct().
 *
 * Related usage:
 *   The finalized percentages are used by Monte Carlo diagnostics to decide
 *   whether clamping is low, moderate or strong.
 */
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
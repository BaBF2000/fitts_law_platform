/**
 * Monte Carlo statistical utilities.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Statistical Analysis
 *
 * Responsibility:
 * Provides descriptive statistics used by Monte Carlo analysis.
 *
 * Important:
 * This module only computes numerical summaries.
 * It does not run simulations, generate random values or render charts.
 *
 * Extension guide:
 * Add new statistical metrics here.
 *
 * Related modules:
 * - monteCarloEngine.js uses summarize() for planned and effective W values.
 * - monteCarloHistogram.js builds distribution visualizations separately.
 * - monteCarloDiagnostics.js interprets constraint distortion separately.
 */

/**
 * Compute the arithmetic mean of an array of values.
 *
 * Args:
 *   values: Array of numeric values.
 *
 * Returns:
 *   Arithmetic mean, or NaN if the array is empty.
 *
 * Side effects:
 *   None.
 *
 * Formula:
 *   mean = sum(values) / number_of_values
 */
export function mean(values) {
  return values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : NaN;
}

/**
 * Compute the sample standard deviation of an array of values.
 *
 * Args:
 *   values: Array of numeric values.
 *
 * Returns:
 *   Sample standard deviation, or NaN if fewer than two values are available.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Uses the sample variance denominator n - 1. This is appropriate when the
 *   simulated values are treated as a sample from an underlying distribution.
 */
export function std(values) {
  if (values.length < 2) return NaN;

  const m = mean(values);

  const variance =
    values.reduce(
      (sum, v) => sum + (v - m) ** 2,
      0
    ) / (values.length - 1);

  return Math.sqrt(variance);
}

/**
 * Compute a quantile using linear interpolation.
 *
 * Args:
 *   values: Array of numeric values.
 *   q: Quantile position between 0 and 1.
 *
 * Returns:
 *   Interpolated quantile value, or NaN if the array is empty.
 *
 * Side effects:
 *   None. The input array is copied before sorting.
 *
 * Examples:
 *   q = 0.05 returns the 5th percentile.
 *   q = 0.50 returns the median.
 *   q = 0.95 returns the 95th percentile.
 *
 * Important:
 *   This function assumes values are finite numeric values. Filtering invalid
 *   values should happen before calling this function if needed.
 */
export function quantile(values, q) {
  if (!values.length) return NaN;

  const sorted = [...values].sort((a, b) => a - b);

  const pos = (sorted.length - 1) * q;

  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);

  if (lo === hi) {
    return sorted[lo];
  }

  return (
    sorted[lo] +
    (sorted[hi] - sorted[lo]) *
      (pos - lo)
  );
}

/**
 * Build a compact descriptive summary for a numeric distribution.
 *
 * Args:
 *   values: Array of numeric values.
 *
 * Returns:
 *   Object containing:
 *   - mean: arithmetic mean
 *   - sd: sample standard deviation
 *   - min: minimum value
 *   - q05: 5th percentile
 *   - median: 50th percentile
 *   - q95: 95th percentile
 *   - max: maximum value
 *
 * Side effects:
 *   None.
 *
 * Related usage:
 *   Monte Carlo results use this summary to compare the planned W distribution
 *   with the effective W distribution after constraint clamping.
 */
export function summarize(values) {
  return {
    mean: mean(values),
    sd: std(values),

    min: Math.min(...values),

    q05: quantile(values, 0.05),

    median: quantile(values, 0.5),

    q95: quantile(values, 0.95),

    max: Math.max(...values),
  };
}
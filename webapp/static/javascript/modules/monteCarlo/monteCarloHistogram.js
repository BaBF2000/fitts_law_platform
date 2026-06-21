/**
 * Monte Carlo distribution visualization helpers.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Histogram Analysis
 *   → CDF Analysis
 *
 * Responsibility:
 * Builds histogram and cumulative distribution data.
 *
 * Important:
 * This module does not run the Monte Carlo simulation.
 * It only transforms already generated numerical values into data structures
 * that can be rendered by the dashboard.
 *
 * Related modules:
 * - monteCarloEngine.js calls makeHistogram() and makeCDF().
 * - monteCarloStats.js computes numerical summaries.
 * - Monte Carlo dashboard/rendering code displays the returned bins and points.
 */

/**
 * Clamp a numeric value to a closed interval.
 *
 * Args:
 *   v: Input value.
 *   min: Lower bound.
 *   max: Upper bound.
 *
 * Returns:
 *   v constrained to the interval [min, max].
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Used to keep computed histogram bin indices inside the valid bin range.
 */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Convert a count into a percentage.
 *
 * Args:
 *   value: Count value.
 *   total: Total number of values.
 *
 * Returns:
 *   Percentage value in the range 0..100, or 0 when total is 0.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Avoids division-by-zero errors when histogram bins are normalized.
 */
function pct(value, total) {
  return total
    ? (100 * value) / total
    : 0;
}

/**
 * Build histogram bins for a numerical value array.
 *
 * Args:
 *   values: Array of numerical values to bin.
 *   min: Lower chart bound.
 *   max: Upper chart bound.
 *   binCount: Number of histogram bins.
 *
 * Returns:
 *   Array of histogram bin objects.
 *
 * Each bin contains:
 *   - index: bin index
 *   - min: lower bin boundary
 *   - max: upper bin boundary
 *   - center: bin center position
 *   - count: number of values inside the bin
 *   - pct: percentage of all input values inside the bin
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Non-finite values are ignored during bin counting. Values outside the chart
 *   range are clamped to the nearest edge bin.
 *
 * Important:
 *   Percentages are currently computed relative to values.length, not relative
 *   to the number of finite values. This means invalid values reduce the
 *   visible percentage mass.
 */
export function makeHistogram(
  values,
  min,
  max,
  binCount = 32
) {
  const bins = [];

  const width =
    (max - min) / binCount;

  for (let i = 0; i < binCount; i++) {
    bins.push({
      index: i,
      min: min + i * width,
      max: min + (i + 1) * width,
      center: min + (i + 0.5) * width,
      count: 0,
      pct: 0,
    });
  }

  for (const value of values) {
    if (!Number.isFinite(value)) continue;

    let idx =
      Math.floor((value - min) / width);

    idx = clamp(
      idx,
      0,
      binCount - 1
    );

    bins[idx].count += 1;
  }

  for (const bin of bins) {
    bin.pct = pct(
      bin.count,
      values.length
    );
  }

  return bins;
}

/**
 * Build cumulative distribution function points for a numerical value array.
 *
 * Args:
 *   values: Array of numerical values.
 *   min: Lower chart bound.
 *   max: Upper chart bound.
 *   pointCount: Number of CDF points to generate.
 *
 * Returns:
 *   Array of CDF point objects.
 *
 * Each point contains:
 *   - x: value on the horizontal axis
 *   - y: cumulative probability from 0 to 1
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   The function sorts all finite values and computes, for each generated x
 *   position, the share of values that are less than or equal to x.
 *
 * Important:
 *   The CDF is normalized by the number of finite values, because non-finite
 *   values are filtered out before sorting.
 */
export function makeCDF(
  values,
  min,
  max,
  pointCount = 80
) {
  const sorted = [...values]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const points = [];

  for (let i = 0; i < pointCount; i++) {
    const x =
      min +
      ((max - min) * i) /
        (pointCount - 1);

    let count = 0;

    while (
      count < sorted.length &&
      sorted[count] <= x
    ) {
      count++;
    }

    points.push({
      x,
      y: sorted.length
        ? count / sorted.length
        : 0,
    });
  }

  return points;
}
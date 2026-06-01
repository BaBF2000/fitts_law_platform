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
 * Extension guide:
 * Add new statistical metrics here.
 */

export function mean(values) {
  return values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : NaN;
}

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
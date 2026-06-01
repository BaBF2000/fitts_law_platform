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
 */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function pct(value, total) {
  return total
    ? (100 * value) / total
    : 0;
}

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
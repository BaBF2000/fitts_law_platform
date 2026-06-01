/**
 * Calibration math helpers.
 *
 * Organigram reference:
 * - Calibration
 *   → Reference Object
 *   → mm/px Estimation
 *
 * Responsibility:
 * Provides pure helper functions for screen calibration.
 */

export const CARD_WIDTH_MM = 85.60;
export const CARD_HEIGHT_MM = 53.98;
export const CARD_RATIO = CARD_WIDTH_MM / CARD_HEIGHT_MM;

export function computeMmPerPx({
  referenceMm = CARD_WIDTH_MM,
  widthPx,
}) {
  if (!Number.isFinite(widthPx) || widthPx <= 0) {
    return NaN;
  }

  return referenceMm / widthPx;
}

export function median(values) {
  const xs =
    values
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

  if (!xs.length) {
    return NaN;
  }

  const mid =
    Math.floor(xs.length / 2);

  return xs.length % 2
    ? xs[mid]
    : (xs[mid - 1] + xs[mid]) / 2;
}

export function sampleSdAroundMedian(values, medianValue) {
  const xs =
    values.filter(Number.isFinite);

  if (xs.length < 2 || !Number.isFinite(medianValue)) {
    return 0;
  }

  const variance =
    xs.reduce(
      (sum, value) =>
        sum + (value - medianValue) ** 2,
      0
    ) / Math.max(1, xs.length - 1);

  return Math.sqrt(variance);
}

export function computeCalibrationResult(samples) {
  const mmPerPx =
    median(samples);

  const sd =
    sampleSdAroundMedian(samples, mmPerPx);

  return {
    mmPerPx,
    calErrorPct:
      Number.isFinite(mmPerPx) && mmPerPx > 0
        ? (sd / mmPerPx) * 100
        : NaN,
  };
}
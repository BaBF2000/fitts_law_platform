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
 *
 * Important:
 * This module contains only mathematical calibration logic.
 * It does not read DOM values, handle gestures or save calibration results.
 *
 * Related modules:
 * - calibration.js orchestrates the calibration workflow.
 * - calibrationGestures.js updates the visual reference rectangle.
 * - core/storage.js persists the final calibration result.
 */

/**
 * Physical width of the reference card.
 *
 * Unit:
 *   Millimeters.
 *
 * Purpose:
 *   Used as the known real-world width for mm/px calibration.
 */
export const CARD_WIDTH_MM = 85.60;

/**
 * Physical height of the reference card.
 *
 * Unit:
 *   Millimeters.
 *
 * Purpose:
 *   Used to preserve the correct visual aspect ratio of the reference object.
 */
export const CARD_HEIGHT_MM = 53.98;

/**
 * Aspect ratio of the reference card.
 *
 * Formula:
 *   width / height
 *
 * Purpose:
 *   Allows the calibration rectangle to keep the same proportions as the
 *   physical reference object while the user resizes it.
 */
export const CARD_RATIO = CARD_WIDTH_MM / CARD_HEIGHT_MM;

/**
 * Compute the millimeter-per-pixel calibration factor.
 *
 * Args:
 *   referenceMm: Known real-world reference width in millimeters.
 *   widthPx: Measured visual width of the reference rectangle in CSS pixels.
 *
 * Returns:
 *   Calibration factor in millimeters per CSS pixel.
 *   Returns NaN if widthPx is invalid.
 *
 * Side effects:
 *   None.
 *
 * Meaning:
 *   A smaller mm/px value means more pixels are used to represent one
 *   millimeter on the current display.
 */
export function computeMmPerPx({
  referenceMm = CARD_WIDTH_MM,
  widthPx,
}) {
  if (!Number.isFinite(widthPx) || widthPx <= 0) {
    return NaN;
  }

  return referenceMm / widthPx;
}

/**
 * Compute the median of finite numeric values.
 *
 * Args:
 *   values: Array of numeric calibration samples.
 *
 * Returns:
 *   Median value, or NaN if no finite values exist.
 *
 * Side effects:
 *   None. The input array is not modified because filter() creates a new array.
 *
 * Purpose:
 *   The median is used as a robust calibration estimate because it is less
 *   sensitive to outlier samples than the arithmetic mean.
 */
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

/**
 * Compute the sample standard deviation around a given median value.
 *
 * Args:
 *   values: Array of numeric calibration samples.
 *   medianValue: Median calibration value used as the center.
 *
 * Returns:
 *   Sample standard deviation around the median.
 *   Returns 0 if fewer than two finite samples exist or if the median is
 *   invalid.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Estimates the uncertainty or spread of repeated calibration samples.
 *
 * Important:
 *   This uses the median as the center instead of the mean, matching the robust
 *   calibration approach used by computeCalibrationResult().
 */
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

/**
 * Compute the final calibration result from repeated samples.
 *
 * Args:
 *   samples: Array of mm/px calibration samples.
 *
 * Returns:
 *   Object containing:
 *   - mmPerPx: final robust millimeter-per-pixel estimate
 *   - calErrorPct: relative calibration uncertainty in percent
 *
 * Side effects:
 *   None.
 *
 * Workflow:
 *   1. Compute the median mm/px value.
 *   2. Estimate sample spread around that median.
 *   3. Express the spread as a percentage of the final mm/px estimate.
 *
 * Important:
 *   The returned mmPerPx value is later used to convert between pixels and
 *   millimeters throughout the experiment.
 */
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
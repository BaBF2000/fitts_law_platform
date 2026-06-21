/**
 * Calibration storage.
 *
 * Organigram reference:
 * - Core Storage
 *   → Calibration Storage
 * - Calibration
 *   → mm/px Persistence
 *
 * Responsibility:
 * Saves and restores screen calibration values from localStorage.
 */

import {
  getDeviceSignature,
} from "./deviceSignature.js";

// localStorage key for the saved screen calibration.
// Version suffix allows future migration if the stored structure changes.
const CALIBRATION_KEY = "fitts_calibration_v1";

/**
 * Load saved screen calibration from localStorage.
 *
 * Returns:
 *   Saved calibration object, or null if no calibration exists or if the stored
 *   value cannot be parsed.
 *
 * Side effects:
 *   Reads from localStorage.
 *
 * Failure behavior:
 *   Invalid JSON, unavailable localStorage or missing data are handled by
 *   returning null.
 *
 * Related usage:
 *   The loaded calibration should be checked with isCalibrationLikelyValid()
 *   before it is reused.
 */
export function loadCalibration() {
  try {
    const raw =
      localStorage.getItem(CALIBRATION_KEY);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save screen calibration data to localStorage.
 *
 * Args:
 *   Object containing:
 *     - mmPerPx: calibrated millimeters per CSS pixel.
 *     - calRectWidthPx: measured calibration rectangle width in pixels.
 *     - calErrorPct: optional validation error percentage.
 *
 * Returns:
 *   The calibration payload that was stored.
 *
 * Side effects:
 *   Writes calibration data to localStorage.
 *
 * Stored data:
 *   The payload includes the calibration values, save timestamp and current
 *   device signature. The signature is later used to decide whether the saved
 *   calibration is still likely valid.
 */
export function saveCalibration({
  mmPerPx,
  calRectWidthPx,
  calErrorPct = null,
}) {
  const payload = {
    mmPerPx,
    calRectWidthPx: calRectWidthPx ?? null,
    calErrorPct,
    savedAt: new Date().toISOString(),
    sig: getDeviceSignature(),
  };

  try {
    localStorage.setItem(
      CALIBRATION_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore persistence failures and still return the created payload.
  }

  return payload;
}

/**
 * Remove saved screen calibration from localStorage.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Removes the calibration entry from localStorage.
 *
 * Related usage:
 *   Used when the user resets calibration or when calibration data should no
 *   longer be trusted.
 */
export function clearCalibration() {
  try {
    localStorage.removeItem(CALIBRATION_KEY);
  } catch {
    // Ignore persistence failures.
  }
}
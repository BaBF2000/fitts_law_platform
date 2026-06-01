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

const CALIBRATION_KEY =
  "fitts_calibration_v1";

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

export function saveCalibration({
  mmPerPx,
  calRectWidthPx,
  calErrorPct = null,
}) {
  const payload = {
    mmPerPx,
    calRectWidthPx:
      calRectWidthPx ?? null,
    calErrorPct,
    savedAt:
      new Date().toISOString(),
    sig:
      getDeviceSignature(),
  };

  localStorage.setItem(
    CALIBRATION_KEY,
    JSON.stringify(payload)
  );

  return payload;
}

export function clearCalibration() {
  localStorage.removeItem(CALIBRATION_KEY);
}
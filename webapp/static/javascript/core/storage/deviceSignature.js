/**
 * Device signature helpers.
 *
 * Organigram reference:
 * - Core Storage
 *   → Device Signature
 * - Calibration
 *   → Calibration Validity Check
 *
 * Responsibility:
 * Builds a small device/browser signature used to decide whether a saved
 * calibration is still likely valid.
 */

export function getDeviceSignature() {
  return {
    ua: navigator.userAgent,
    dpr: window.devicePixelRatio || 1,
    screenW: window.screen?.width || null,
    screenH: window.screen?.height || null,
  };
}

export function isCalibrationLikelyValid(saved) {
  if (!saved?.sig) {
    return false;
  }

  const current =
    getDeviceSignature();

  const sameDpr =
    saved.sig.dpr === current.dpr;

  const sameScreen =
    saved.sig.screenW === current.screenW &&
    saved.sig.screenH === current.screenH;

  return sameDpr && sameScreen;
}
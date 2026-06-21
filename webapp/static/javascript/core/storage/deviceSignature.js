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

/**
 * Build a compact device/display signature.
 *
 * Returns:
 *   Object containing user agent, device pixel ratio and reported screen size.
 *
 * Side effects:
 *   None. This function only reads browser and screen properties.
 *
 * Purpose:
 *   The signature is stored together with calibration data and later used to
 *   decide whether the calibration is still likely valid.
 *
 * Notes:
 *   This is not a unique device identifier. It is only a lightweight
 *   compatibility check for calibration reuse.
 */
export function getDeviceSignature() {
  return {
    // User agent is stored for traceability but is not currently used as a strict
    // calibration validity criterion
    ua: navigator.userAgent,
    dpr: window.devicePixelRatio || 1,
    screenW: window.screen?.width || null,
    screenH: window.screen?.height || null,
  };
}

/**
 * Check whether saved calibration data is likely valid for the current device.
 *
 * Args:
 *   saved: Previously stored calibration object. Expected to contain a sig
 *     property created by getDeviceSignature().
 *
 * Returns:
 *   true if the stored device pixel ratio and screen size match the current
 *   environment, otherwise false.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Missing or malformed signatures are treated as invalid.
 *
 * Important:
 *   This function intentionally performs a conservative compatibility check.
 *   If display scale or screen dimensions changed, the old calibration is not
 *   trusted.
 */
export function isCalibrationLikelyValid(saved) {
  // Reject older calibration entries that do not contain a device signature
  if (!saved?.sig) {
    return false;
  }

  const current =
    getDeviceSignature();

  // Compare display-scale and screen-size values.
  // These are the most relevant fields for deciding whether a px/mm calibration
  // can still be reused safely
  const sameDpr =
    saved.sig.dpr === current.dpr;

  const sameScreen =
    saved.sig.screenW === current.screenW &&
    saved.sig.screenH === current.screenH;

  return sameDpr && sameScreen;
}
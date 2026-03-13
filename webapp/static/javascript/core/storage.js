const KEY = "fitts_calibration_v1";

export function getDeviceSignature() {
  return {
    ua: navigator.userAgent,
    dpr: window.devicePixelRatio || 1,
    screenW: window.screen?.width || null,
    screenH: window.screen?.height || null
  };
}

export function loadCalibration() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCalibration({ mmPerPx, calRectWidthPx }) {
  const payload = {
    mmPerPx,
    calRectWidthPx: calRectWidthPx ?? null,
    savedAt: new Date().toISOString(),
    sig: getDeviceSignature()
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
  return payload;
}

export function clearCalibration() {
  localStorage.removeItem(KEY);
}

export function isCalibrationLikelyValid(saved) {
  if (!saved?.sig) return false;
  const cur = getDeviceSignature();

  const sameDpr = saved.sig.dpr === cur.dpr;
  const sameScreen = saved.sig.screenW === cur.screenW && saved.sig.screenH === cur.screenH;

  return sameDpr && sameScreen;
}
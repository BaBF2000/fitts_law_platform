const KEY = "fitts_calibration_v1";
const PROTOCOL_KEY = "fitts_protocol_v1";
const TOUCHABILITY_KEY_PREFIX = "fitts_touchability_v1_";

// ------------------------------------------------------------
// Device signature
// ------------------------------------------------------------
export function getDeviceSignature() {
  return {
    ua: navigator.userAgent,
    dpr: window.devicePixelRatio || 1,
    screenW: window.screen?.width || null,
    screenH: window.screen?.height || null,
  };
}

// ------------------------------------------------------------
// Calibration
// ------------------------------------------------------------
export function loadCalibration() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCalibration({ mmPerPx, calRectWidthPx, calErrorPct = null }) {
  const payload = {
    mmPerPx,
    calRectWidthPx: calRectWidthPx ?? null,
    calErrorPct,
    savedAt: new Date().toISOString(),
    sig: getDeviceSignature(),
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
  const sameScreen =
    saved.sig.screenW === cur.screenW &&
    saved.sig.screenH === cur.screenH;

  return sameDpr && sameScreen;
}

// ------------------------------------------------------------
// Protocol list
// ------------------------------------------------------------
function makeProtocolId() {
  return `protocol_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function listProtocols() {
  try {
    const raw = localStorage.getItem(PROTOCOL_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    // Compatibility with old single-protocol format
    if (!Array.isArray(parsed)) {
      return parsed?.sessionBlocks ? [parsed] : [];
    }

    return parsed;
  } catch {
    return [];
  }
}

export function saveProtocol(data) {
  const protocols = listProtocols();

  const protocolName =
    data.protocol_name ||
    data.protocolName ||
    data.name ||
    `Protokoll ${new Date().toLocaleString("de-DE")}`;

  const protocolComment =
    data.protocol_comment ||
    data.protocolComment ||
    data.comment ||
    "";

  const payload = {
    ...data,
    id: data.id || makeProtocolId(),

    // Canonical protocol metadata.
    protocol_name: protocolName,
    protocol_comment: protocolComment,

    // Backward-compatible display name.
    name: protocolName,

    savedAt: new Date().toISOString(),
    version: 2,
  };

  const updated = [
    payload,
    ...protocols.filter((p) => p.id !== payload.id),
  ];

  localStorage.setItem(PROTOCOL_KEY, JSON.stringify(updated));
  return payload;
}

export function loadProtocol() {
  const protocols = listProtocols();
  return protocols[0] ?? null;
}

export function loadProtocolById(id) {
  return listProtocols().find((p) => p.id === id) ?? null;
}

export function deleteProtocolById(id) {
  const updated = listProtocols().filter((p) => p.id !== id);
  localStorage.setItem(PROTOCOL_KEY, JSON.stringify(updated));
  return updated;
}

export function clearProtocol() {
  localStorage.removeItem(PROTOCOL_KEY);
}

// ------------------------------------------------------------
// Touchability per participant
// Stored separately because finger contact size is participant-specific
// ------------------------------------------------------------
function participantTouchKey(participantId) {
  const safe = (participantId || "anonymous")
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_");

  return `${TOUCHABILITY_KEY_PREFIX}${safe}`;
}

export function saveTouchabilityForParticipant(participantId, data) {
  const payload = {
    ...data,
    participantId: participantId || null,
    savedAt: new Date().toISOString(),
    version: 1,
  };

  localStorage.setItem(participantTouchKey(participantId), JSON.stringify(payload));
  return payload;
}

export function loadTouchabilityForParticipant(participantId) {
  try {
    const raw = localStorage.getItem(participantTouchKey(participantId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearTouchabilityForParticipant(participantId) {
  localStorage.removeItem(participantTouchKey(participantId));
}
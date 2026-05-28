// Lightweight DOM helper.
export const $ = (id) => document.getElementById(id);

// ---------------- Generic math/time helpers ----------------

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function nowMs() {
  return performance.now();
}

export function isoNow() {
  return new Date().toISOString();
}

export function log2(x) {
  return Math.log(x) / Math.LN2;
}

export function uniform01() {
  return Math.random();
}

/**
 * Return the current playable viewport size in CSS pixels.
 *
 * On mobile/tablet, window.innerWidth/innerHeight can be unstable because of
 * browser UI bars, fullscreen transitions and orientation changes. The document
 * element size is often the safer first choice.
 */
export function getViewportSize() {
  const width =
    document.documentElement?.clientWidth ||
    window.visualViewport?.width ||
    window.innerWidth;

  const height =
    document.documentElement?.clientHeight ||
    window.visualViewport?.height ||
    window.innerHeight;

  return {
    width,
    height,
    minSide: Math.min(width, height),
  };
}

// ---------------- Fitts helpers ----------------

/**
 * Compute Index of Difficulty (ID).
 * Units: Dmm and Wmm are in millimeters.
 *
 * - "classic" : log2(2D/W)
 * - "shannon" : log2(D/W + 1)
 */
export function computeID(Dmm, Wmm, formula) {
  if (!(Dmm > 0) || !(Wmm > 0)) return NaN;
  if (formula === "classic") return log2((2 * Dmm) / Wmm);
  return log2((Dmm / Wmm) + 1);
}

/**
 * Compute target width W from a desired ID.
 * Units: Dmm and result are in millimeters.
 */
export function computeWFromID(Dmm, ID, formula) {
  if (!(Dmm > 0) || !(ID >= 0)) return NaN;

  if (formula === "classic") {
    return (2 * Dmm) / Math.pow(2, ID);
  }

  const denom = Math.pow(2, ID) - 1;
  if (denom <= 0) return NaN;

  return Dmm / denom;
}

/**
 * Compute movement amplitude A from target width W and desired ID.
 * Units: W and result use the same unit.
 */
export function computeAFromWAndID(W, ID, formula) {
  if (!(W > 0) || !(ID >= 0)) return NaN;

  if (formula === "classic") {
    return (W * Math.pow(2, ID)) / 2;
  }

  return W * (Math.pow(2, ID) - 1);
}

/**
 * Convert an input value to pixels and millimeters.
 *
 * unitMode:
 * - "relative": value is a fraction of min(viewportW, viewportH)
 * - "px":       value is in CSS pixels
 * - "mm":       value is in millimeters and requires calibration
 */
export function convertToPxAndMm(value, unitMode, mmPerPx) {
  const { minSide } = getViewportSize();

  if (!Number.isFinite(value) || value < 0) {
    return { px: NaN, mm: NaN, mode: "invalid" };
  }

  if (unitMode === "px") {
    return {
      px: value,
      mm: mmPerPx ? value * mmPerPx : NaN,
      mode: "px",
    };
  }

  if (unitMode === "mm") {
    if (!mmPerPx) {
      return { px: NaN, mm: NaN, mode: "mm_no_calibration" };
    }

    return {
      px: value / mmPerPx,
      mm: value,
      mode: "mm",
    };
  }

  // Default: relative unit.
  const px = value * minSide;

  return {
    px,
    mm: mmPerPx ? px * mmPerPx : NaN,
    mode: "relative",
  };
}

/**
 * Place the next target at distance Dpx from the previous target center.
 *
 * The function:
 * - keeps the target center inside the playable viewport
 * - enforces a minimum center-to-center distance to avoid overlap
 * - first tries exact radial placement
 * - then falls back to the best random in-bounds placement
 */
export function placeTarget(prevX, prevY, Dpx, newRadiusPx, prevRadiusPx = newRadiusPx) {
  const { width: vw, height: vh } = getViewportSize();

  const safeNewRadius = Number.isFinite(newRadiusPx) ? Math.max(0, newRadiusPx) : 0;
  const safePrevRadius = Number.isFinite(prevRadiusPx) ? Math.max(0, prevRadiusPx) : safeNewRadius;

  const margin = Math.max(12, safeNewRadius + 8);

  const minX = margin;
  const maxX = vw - margin;
  const minY = margin;
  const maxY = vh - margin;

  const minDistance = safePrevRadius + safeNewRadius + 10;
  const requestedDpx = Number.isFinite(Dpx) ? Dpx : 0;
  const effectiveDpx = Math.max(requestedDpx, minDistance);

  function isInside(x, y) {
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }

  function noOverlap(x, y) {
    return Math.hypot(x - prevX, y - prevY) >= minDistance;
  }

  // Try exact radial placement first.
  for (let tries = 0; tries < 120; tries++) {
    const theta = uniform01() * Math.PI * 2;
    const x = prevX + Math.cos(theta) * effectiveDpx;
    const y = prevY + Math.sin(theta) * effectiveDpx;

    if (isInside(x, y) && noOverlap(x, y)) {
      return {
        x,
        y,
        placed: effectiveDpx === requestedDpx
          ? "radial_exact_no_overlap"
          : "radial_adjusted_no_overlap",
      };
    }
  }

  // Fall back to a random in-bounds placement closest to the requested distance.
  let best = null;
  let bestErr = Infinity;

  for (let tries = 0; tries < 300; tries++) {
    const x = minX + uniform01() * Math.max(0, maxX - minX);
    const y = minY + uniform01() * Math.max(0, maxY - minY);

    if (!noOverlap(x, y)) continue;

    const err = Math.abs(Math.hypot(x - prevX, y - prevY) - effectiveDpx);

    if (err < bestErr) {
      bestErr = err;
      best = { x, y };
    }
  }

  if (best) {
    return {
      ...best,
      placed: "random_best_no_overlap",
    };
  }

  // Last-resort fallback: keep the target visible, even if overlap is possible.
  return {
    x: clamp(prevX, minX, maxX),
    y: clamp(prevY, minY, maxY),
    placed: "safe_fallback_overlap_possible",
  };
}

// ---------------- CSV ----------------

/**
 * Convert an array of objects into CSV.
 *
 * The first row defines the column order.
 */
export function toCSV(rows) {
  if (!rows.length) return "";

  const cols = Object.keys(rows[0]);

  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[,"\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };

  return [
    cols.join(","),
    ...rows.map((row) => cols.map((col) => esc(row[col])).join(",")),
  ].join("\n");
}

// ---------------- Number/list parsing + sampling ----------------

/**
 * Parse a user entry that can be either:
 * - a single number: "0.5"
 * - a JSON list:     "[0.1, 0.3, 0.5]"
 */
export function parseNumberOrList(input) {
  const raw = (input ?? "").toString().trim();
  if (!raw) return { kind: "invalid", values: [] };

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) {
        return { kind: "invalid", values: [] };
      }

      const vals = arr
        .map(Number)
        .filter((v) => Number.isFinite(v) && v >= 0);

      if (!vals.length) {
        return { kind: "invalid", values: [] };
      }

      return { kind: "list", values: vals };
    } catch {
      return { kind: "invalid", values: [] };
    }
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    return { kind: "invalid", values: [] };
  }

  return { kind: "single", values: [value] };
}

/**
 * Sample a value from a numeric spec:
 * - list: choose uniformly from the list
 * - single number:
 *   - if isSet=true, use exactly v
 *   - otherwise sample uniformly in [0, v]
 */
export function sampleFromSpec(isSet, input) {
  const spec = parseNumberOrList(input);
  if (spec.kind === "invalid") return NaN;

  if (spec.kind === "list") {
    const i = Math.floor(Math.random() * spec.values.length);
    return spec.values[i];
  }

  const value = spec.values[0];
  return isSet ? value : uniform01() * value;
}

// ---------------- Fullscreen "kiosk-like" enforcement ----------------

let _enforceFullscreen = false;
let _overlayEl = null;
let _overlayBtn = null;
let _overlayText = null;

/**
 * Create an overlay that blocks interaction when fullscreen is required.
 *
 * IMPORTANT: All user-facing UI strings in this overlay must remain German.
 */
function ensureOverlay() {
  if (_overlayEl) return;

  const el = document.createElement("div");
  el.id = "fullscreenEnforceOverlay";
  el.style.cssText = [
    "position:fixed",
    "inset:0",
    "display:none",
    "align-items:center",
    "justify-content:center",
    "background:rgba(0,0,0,0.75)",
    "z-index:999999",
    "padding:20px",
    "touch-action:none",
  ].join(";");

  const card = document.createElement("div");
  card.style.cssText = [
    "max-width:520px",
    "width:100%",
    "background:#111",
    "border:1px solid rgba(255,255,255,0.12)",
    "border-radius:14px",
    "padding:16px",
    "color:#fff",
    "font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
  ].join(";");

  const title = document.createElement("div");
  title.style.cssText = "font-weight:700;font-size:16px;margin-bottom:8px;";
  title.textContent = "Vollbildmodus erforderlich";

  const text = document.createElement("div");
  text.style.cssText = "opacity:0.85;margin-bottom:12px;";
  text.textContent = "Bitte tippen/klicken Sie unten, um den Vollbildmodus wiederherzustellen.";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.style.cssText = [
    "width:100%",
    "border:0",
    "border-radius:12px",
    "padding:12px 14px",
    "font-weight:700",
    "cursor:pointer",
  ].join(";");
  btn.textContent = "Zum Vollbildmodus zurückkehren";

  card.appendChild(title);
  card.appendChild(text);
  card.appendChild(btn);
  el.appendChild(card);
  document.body.appendChild(el);

  _overlayEl = el;
  _overlayBtn = btn;
  _overlayText = text;

  // Block pointer events from reaching the app behind the overlay.
  el.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
  el.addEventListener("click", (e) => e.stopPropagation(), true);

  btn.addEventListener("pointerup", async (e) => {
    e.preventDefault();

    await requestFullscreenSafe();
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (document.fullscreenElement) {
      await lockOrientationIfPossible();
      hideOverlay();
    } else {
      showOverlay(
        "Der Vollbildmodus wurde blockiert. Bitte erneut tippen/klicken oder über das Browser-Menü Vollbild aktivieren."
      );
    }
  });
}

/**
 * Show fullscreen enforcement overlay with an optional German reason.
 */
function showOverlay(reasonDe) {
  ensureOverlay();

  if (_overlayText) {
    _overlayText.textContent =
      reasonDe || "Bitte tippen/klicken Sie unten, um den Vollbildmodus wiederherzustellen.";
  }

  if (_overlayEl) {
    _overlayEl.style.display = "flex";
  }
}

/**
 * Hide fullscreen enforcement overlay.
 */
function hideOverlay() {
  if (_overlayEl) {
    _overlayEl.style.display = "none";
  }
}

/**
 * Show the overlay if fullscreen is required but currently inactive.
 */
async function tryReenterFullscreenIfNeeded() {
  if (!_enforceFullscreen) return;

  if (document.fullscreenElement) {
    hideOverlay();
    return;
  }

  showOverlay("Der Vollbildmodus wurde beendet. Bitte tippen/klicken Sie, um fortzufahren.");
}

/**
 * Best-effort fullscreen request that never throws.
 *
 * Must be called from a user gesture handler on most browsers.
 */
export function requestFullscreenSafe() {
  const el = document.documentElement;

  try {
    if (!document.fullscreenElement && el.requestFullscreen) {
      return el.requestFullscreen({ navigationUI: "hide" }).catch((err) => {
        console.warn("requestFullscreen failed:", err?.name || err, err);
      });
    }
  } catch (err) {
    console.warn("requestFullscreen threw:", err?.name || err, err);
  }

  return Promise.resolve();
}

/**
 * Enable or disable fullscreen enforcement overlay.
 */
export function setFullscreenEnforcement(enabled) {
  _enforceFullscreen = !!enabled;

  if (!_enforceFullscreen) {
    hideOverlay();
    return;
  }

  ensureOverlay();
  tryReenterFullscreenIfNeeded();
}

document.addEventListener("fullscreenchange", () => {
  tryReenterFullscreenIfNeeded();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    tryReenterFullscreenIfNeeded();
  }
});

// ---------------- Orientation lock helpers ----------------

/**
 * Try to lock orientation to landscape.
 * Silent failure is expected on unsupported browsers.
 */
export async function lockOrientationIfPossible() {
  try {
    const orientation = window.screen?.orientation;
    if (!orientation?.lock) return;

    await orientation.lock("landscape");
  } catch {
    // Silent by design.
  }
}

/**
 * Try to unlock orientation if supported.
 */
export async function unlockOrientationIfPossible() {
  try {
    const orientation = window.screen?.orientation;
    if (orientation?.unlock) orientation.unlock();
  } catch {
    // Silent by design.
  }
}

// ---------------- Wake Lock ----------------

let _wakeLockSentinel = null;

/**
 * Enable or disable screen wake lock.
 *
 * Best-effort: may fail depending on browser and permissions.
 */
export async function setWakeLock(enabled) {
  const want = !!enabled;
  if (!("wakeLock" in navigator)) return;

  if (!want) {
    try {
      await _wakeLockSentinel?.release?.();
    } catch {
      // Ignore release errors.
    }

    _wakeLockSentinel = null;
    return;
  }

  try {
    _wakeLockSentinel = await navigator.wakeLock.request("screen");
  } catch {
    _wakeLockSentinel = null;
  }
}

// Wake lock can be released when the tab becomes hidden; re-acquire on return.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (_wakeLockSentinel) return;

  if (_enforceFullscreen) {
    setWakeLock(true).catch(() => {});
  }
});
// Lightweight DOM helper
export const $ = (id) => document.getElementById(id);

// ---------------- Generic math/time helpers ----------------

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function nowMs() { return performance.now(); }
export function isoNow() { return new Date().toISOString(); }
export function log2(x) { return Math.log(x) / Math.LN2; }
export function uniform01() { return Math.random(); }

// ---------------- Fitts helpers ----------------

/**
 * Compute Index of Difficulty (ID).
 * Units: Dmm and Wmm are in millimeters.
 *
 * - "classic"  : log2(2D/W)
 * - "shannon"  : log2(D/W + 1)  (default)
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
 * Convert an input value to pixels and (optionally) millimeters.
 *
 * unitMode:
 *  - "relative": value is a fraction of min(viewportW, viewportH)
 *  - "px":       value is in pixels
 *  - "mm":       value is in millimeters (requires calibration mmPerPx)
 */
export function convertToPxAndMm(value, unitMode, mmPerPx) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const minSide = Math.min(vw, vh);

  if (!Number.isFinite(value) || value < 0) {
    return { px: NaN, mm: NaN, mode: "invalid" };
  }

  if (unitMode === "px") {
    return { px: value, mm: mmPerPx ? value * mmPerPx : NaN, mode: "px" };
  }

  if (unitMode === "mm") {
    if (!mmPerPx) return { px: NaN, mm: NaN, mode: "mm_no_calibration" };
    return { px: value / mmPerPx, mm: value, mode: "mm" };
  }

  // Default: relative
  const px = value * minSide;
  return { px, mm: mmPerPx ? px * mmPerPx : NaN, mode: "relative" };
}

/**
 * Place the next target at distance Dpx from previous (prevX, prevY),
 * trying random angles first, then falling back to a random on-screen placement.
 */
export function placeTarget(prevX, prevY, Dpx, radiusPx) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = Math.max(12, radiusPx + 6);

  for (let tries = 0; tries < 12; tries++) {
    const theta = uniform01() * Math.PI * 2;
    const x = prevX + Math.cos(theta) * Dpx;
    const y = prevY + Math.sin(theta) * Dpx;

    const ok = (x > margin && x < vw - margin && y > margin && y < vh - margin);
    if (ok) return { x, y, placed: "radial" };
  }

  return {
    x: margin + uniform01() * (vw - 2 * margin),
    y: margin + uniform01() * (vh - 2 * margin),
    placed: "random_fallback"
  };
}

// ---------------- CSV ----------------

/**
 * Convert an array of objects into CSV.
 * Note: uses the first row keys as columns (stable schema is expected).
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
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))
  ].join("\n");
}

// ---------------- Number/list parsing + sampling ----------------

/**
 * Parse a user entry that can be either:
 *  - a single number: "0.5"
 *  - a JSON list:     "[0.1, 0.3, 0.5]"
 */
export function parseNumberOrList(input) {
  const raw = (input ?? "").toString().trim();
  if (!raw) return { kind: "invalid", values: [] };

  // JSON-like list
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) return { kind: "invalid", values: [] };

      const vals = arr.map(Number).filter((v) => Number.isFinite(v) && v >= 0);
      if (!vals.length) return { kind: "invalid", values: [] };

      return { kind: "list", values: vals };
    } catch {
      return { kind: "invalid", values: [] };
    }
  }

  // Single number
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0) return { kind: "invalid", values: [] };
  return { kind: "single", values: [v] };
}

/**
 * Sample a value from a numeric spec:
 *  - list: choose uniformly from the list
 *  - single number:
 *      - if isSet=true => use exactly v
 *      - else          => sample uniformly in [0, v]
 */
export function sampleFromSpec(isSet, input) {
  const spec = parseNumberOrList(input);
  if (spec.kind === "invalid") return NaN;

  if (spec.kind === "list") {
    const i = Math.floor(Math.random() * spec.values.length);
    return spec.values[i];
  }

  const v = spec.values[0];
  return isSet ? v : uniform01() * v;
}

// ---------------- Fullscreen "kiosk-like" enforcement ----------------

let _enforceFullscreen = false;
let _overlayEl = null;
let _overlayBtn = null;
let _overlayText = null;

/**
 * Create an overlay that blocks interaction when fullscreen is required.
 * The button lets the user re-enter fullscreen via a user gesture.
 *
 * IMPORTANT: All UI strings must remain German.
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
    "touch-action:none"
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
    "font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif"
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
    "cursor:pointer"
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
  // Use capture to intercept early.
  el.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
  el.addEventListener("click", (e) => e.stopPropagation(), true);

  btn.addEventListener("pointerup", async (e) => {
    // Keep it a direct user gesture.
    e.preventDefault();

    await requestFullscreenSafe();

    // Give the browser a short moment to apply fullscreen.
    await new Promise((r) => setTimeout(r, 50));

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

function showOverlay(reasonDe) {
  ensureOverlay();
  if (_overlayText) {
    _overlayText.textContent =
      reasonDe || "Bitte tippen/klicken Sie unten, um den Vollbildmodus wiederherzustellen.";
  }
  if (_overlayEl) _overlayEl.style.display = "flex";
}

function hideOverlay() {
  if (_overlayEl) _overlayEl.style.display = "none";
}

async function tryReenterFullscreenIfNeeded() {
  if (!_enforceFullscreen) return;

  if (document.fullscreenElement) {
    hideOverlay();
    return;
  }

  // No automatic fullscreen (gesture required): show overlay.
  showOverlay("Der Vollbildmodus wurde beendet. Bitte tippen/klicken Sie, um fortzufahren.");
}

/**
 * Best-effort fullscreen request that never throws.
 * Note: Must be called from a user gesture handler to succeed on most browsers.
 */
export function requestFullscreenSafe() {
  const el = document.documentElement;

  try {
    if (!document.fullscreenElement && el.requestFullscreen) {
      // IMPORTANT: do not do other awaited work before calling requestFullscreen.
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
 * Enable/disable fullscreen enforcement overlay.
 * - Enable it when starting a run.
 * - Disable it when returning to the start screen.
 */
export function setFullscreenEnforcement(enabled) {
  _enforceFullscreen = !!enabled;

  if (!_enforceFullscreen) {
    hideOverlay();
    return;
  }

  // Create overlay early to avoid DOM timing issues.
  ensureOverlay();
  tryReenterFullscreenIfNeeded();
}

// Re-check fullscreen state when it changes.
document.addEventListener("fullscreenchange", () => {
  tryReenterFullscreenIfNeeded();
});

// Some mobile browsers are unreliable with fullscreenchange.
// Visibility checks are a practical fallback for kiosk-like behavior.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    tryReenterFullscreenIfNeeded();
  }
});

// ---------------- Orientation lock helpers ----------------

/**
 * Try to lock orientation to landscape (consistent with manifest + experiment design).
 * Silent failure by design (unsupported in many desktop browsers).
 */
export async function lockOrientationIfPossible() {
  try {
    const o = window.screen?.orientation;
    if (!o?.lock) return;
    await o.lock("landscape");
  } catch {
    // Silent by design
  }
}

/**
 * Try to unlock orientation if the browser supports it.
 */
export async function unlockOrientationIfPossible() {
  try {
    const o = window.screen?.orientation;
    if (o?.unlock) o.unlock();
  } catch {
    // Silent by design
  }
}

// ---------------- Wake Lock (optional) ----------------

let _wakeLockSentinel = null;

/**
 * Enable/disable screen wake lock to prevent the device from sleeping.
 * Best-effort: may fail depending on browser and permissions.
 */
export async function setWakeLock(enabled) {
  const want = !!enabled;
  if (!("wakeLock" in navigator)) return;

  if (!want) {
    try {
      await _wakeLockSentinel?.release?.();
    } catch {
      // Ignore
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

  // Only re-acquire in running mode.
  if (_enforceFullscreen) {
    setWakeLock(true).catch(() => {});
  }
});
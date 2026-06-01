/**
 * Fullscreen, orientation and wake-lock management.
 *
 * Organigram reference:
 * - Experiment Runtime
 *   → Fullscreen Control
 *   → Orientation Lock
 *   → Wake Lock
 *
 * Responsibility:
 * Ensures that the experiment can run in a controlled fullscreen-like mode.
 *
 * Important:
 * All user-facing strings in this file must remain German.
 */

let enforceFullscreen = false;

let overlayEl = null;
let overlayText = null;

/* -------------------------------------------------------------------------- */
/* Overlay creation                                                           */
/* -------------------------------------------------------------------------- */

function ensureOverlay() {
  if (overlayEl) return;

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
  title.style.cssText =
    "font-weight:700;font-size:16px;margin-bottom:8px;";
  title.textContent = "Vollbildmodus erforderlich";

  const text = document.createElement("div");
  text.style.cssText =
    "opacity:0.85;margin-bottom:12px;";
  text.textContent =
    "Bitte tippen/klicken Sie unten, um den Vollbildmodus wiederherzustellen.";

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

  overlayEl = el;
  overlayText = text;

  el.addEventListener(
    "pointerdown",
    (e) => e.stopPropagation(),
    true
  );

  el.addEventListener(
    "click",
    (e) => e.stopPropagation(),
    true
  );

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

/* -------------------------------------------------------------------------- */
/* Overlay visibility                                                         */
/* -------------------------------------------------------------------------- */

function showOverlay(reasonDe) {
  ensureOverlay();

  if (overlayText) {
    overlayText.textContent =
      reasonDe ||
      "Bitte tippen/klicken Sie unten, um den Vollbildmodus wiederherzustellen.";
  }

  if (overlayEl) {
    overlayEl.style.display = "flex";
  }
}

function hideOverlay() {
  if (overlayEl) {
    overlayEl.style.display = "none";
  }
}

async function tryReenterFullscreenIfNeeded() {
  if (!enforceFullscreen) return;

  if (document.fullscreenElement) {
    hideOverlay();
    return;
  }

  showOverlay(
    "Der Vollbildmodus wurde beendet. Bitte tippen/klicken Sie, um fortzufahren."
  );
}

/* -------------------------------------------------------------------------- */
/* Fullscreen API                                                             */
/* -------------------------------------------------------------------------- */

export function requestFullscreenSafe() {
  const el = document.documentElement;

  try {
    if (!document.fullscreenElement && el.requestFullscreen) {
      return el
        .requestFullscreen({ navigationUI: "hide" })
        .catch((err) => {
          console.warn(
            "requestFullscreen failed:",
            err?.name || err,
            err
          );
        });
    }
  } catch (err) {
    console.warn(
      "requestFullscreen threw:",
      err?.name || err,
      err
    );
  }

  return Promise.resolve();
}

export function setFullscreenEnforcement(enabled) {
  enforceFullscreen = !!enabled;

  if (!enforceFullscreen) {
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

/* -------------------------------------------------------------------------- */
/* Orientation lock                                                           */
/* -------------------------------------------------------------------------- */

export async function lockOrientationIfPossible() {
  try {
    const orientation = window.screen?.orientation;

    if (!orientation?.lock) return;

    await orientation.lock("landscape");
  } catch {
    // Silent by design.
  }
}

export async function unlockOrientationIfPossible() {
  try {
    const orientation = window.screen?.orientation;

    if (orientation?.unlock) {
      orientation.unlock();
    }
  } catch {
    // Silent by design.
  }
}

/* -------------------------------------------------------------------------- */
/* Wake lock                                                                  */
/* -------------------------------------------------------------------------- */

let wakeLockSentinel = null;

export async function setWakeLock(enabled) {
  const want = !!enabled;

  if (!("wakeLock" in navigator)) {
    return;
  }

  if (!want) {
    try {
      await wakeLockSentinel?.release?.();
    } catch {
      // Ignore release errors.
    }

    wakeLockSentinel = null;
    return;
  }

  try {
    wakeLockSentinel =
      await navigator.wakeLock.request("screen");
  } catch {
    wakeLockSentinel = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (wakeLockSentinel) return;

  if (enforceFullscreen) {
    setWakeLock(true).catch(() => {});
  }
});
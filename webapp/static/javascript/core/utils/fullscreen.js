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

// Whether the application should currently enforce fullscreen mode.
// Enabled during the experiment run and end screen, disabled on setup screens.
let enforceFullscreen = false;

// Lazily created fullscreen recovery overlay.
// Created only when fullscreen enforcement is first needed.
let overlayEl = null;
let overlayText = null;


/* -------------------------------------------------------------------------- */
/* Overlay creation                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Create the fullscreen recovery overlay if it does not exist yet.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Creates DOM elements, appends them to document.body and registers pointer
 *   event handlers.
 *
 * Behavior:
 *   The overlay blocks interaction with the experiment until the user attempts
 *   to re-enter fullscreen mode.
 *
 * Important:
 *   User-facing text must remain German.
 */
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

/**
 * Show the fullscreen recovery overlay.
 *
 * Args:
 *   reasonDe: Optional German explanation shown inside the overlay.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Ensures the overlay exists and updates its display style/text.
 *
 * Important:
 *   The text is user-facing and must remain German.
 */
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

/**
 * Hide the fullscreen recovery overlay.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates the overlay display style if the overlay exists.
 */
function hideOverlay() {
  if (overlayEl) {
    overlayEl.style.display = "none";
  }
}

/**
 * Check fullscreen state and show the recovery overlay when needed.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   May show or hide the fullscreen recovery overlay.
 *
 * Behavior:
 *   If fullscreen enforcement is disabled, nothing happens. If enforcement is
 *   enabled and the document is no longer fullscreen, the overlay is shown so
 *   the user can re-enter fullscreen through a user gesture.
 */
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

/**
 * Request fullscreen mode for the document root element.
 *
 * Returns:
 *   Promise that resolves when the fullscreen request completes or fails.
 *
 * Side effects:
 *   May trigger the browser fullscreen prompt or enter fullscreen mode.
 *
 * Failure behavior:
 *   Fullscreen requests can fail when not triggered by a user gesture or when
 *   blocked by the browser. Errors are logged but not thrown.
 *
 * Notes:
 *   navigationUI: "hide" is requested to reduce browser UI during the
 *   experiment, but support depends on the browser.
 */
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

/**
 * Enable or disable fullscreen enforcement.
 *
 * Args:
 *   enabled: Whether fullscreen should be enforced.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates module-level enforcement state, may create the recovery overlay,
 *   and may show/hide the overlay depending on the current fullscreen state.
 *
 * Related usage:
 *   Called by core/ui.js when switching between top-level views.
 */
export function setFullscreenEnforcement(enabled) {
  enforceFullscreen = !!enabled;

  if (!enforceFullscreen) {
    hideOverlay();
    return;
  }

  ensureOverlay();
  tryReenterFullscreenIfNeeded();
}

// Re-check fullscreen state whenever the browser enters or exits fullscreen.
document.addEventListener("fullscreenchange", () => {
  tryReenterFullscreenIfNeeded();
});

// When the tab becomes visible again, verify whether fullscreen still holds.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    tryReenterFullscreenIfNeeded();
  }
});

/* -------------------------------------------------------------------------- */
/* Orientation lock                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Try to lock screen orientation to landscape.
 *
 * Returns:
 *   Promise<void>.
 *
 * Side effects:
 *   May lock screen orientation if the browser and device support it.
 *
 * Failure behavior:
 *   Unsupported APIs or browser restrictions are ignored silently because
 *   orientation lock is helpful but not mandatory for running the experiment.
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
 * Try to unlock screen orientation.
 *
 * Returns:
 *   Promise<void>.
 *
 * Side effects:
 *   May release the screen orientation lock if supported.
 *
 * Failure behavior:
 *   Unsupported APIs or release errors are ignored silently.
 */
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


/**
 * Enable or disable screen wake lock.
 *
 * Args:
 *   enabled: Whether the screen should be kept awake.
 *
 * Returns:
 *   Promise<void>.
 *
 * Side effects:
 *   May request or release a screen wake lock through navigator.wakeLock.
 *
 * Behavior:
 *   - enabled=false releases an active wake lock if present.
 *   - enabled=true requests a screen wake lock if the API is supported.
 *
 * Failure behavior:
 *   Wake lock is not supported in all browsers and may be rejected by the
 *   system. Failures are handled without interrupting the experiment.
 */

// Active WakeLockSentinel returned by the Screen Wake Lock API.
// Null means no wake lock is currently held.
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

// Wake locks are usually released when the page becomes hidden.
// Re-request the wake lock when the experiment is visible again and fullscreen
// enforcement is active.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (wakeLockSentinel) return;

  if (enforceFullscreen) {
    setWakeLock(true).catch(() => {});
  }
});
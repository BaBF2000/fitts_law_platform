/**
 * Touchability button handlers.
 *
 * Organigram reference:
 * - Touchability
 *   → UI Controls
 *
 * Responsibility:
 * Wires touchability panel buttons to the finger contact workflow.
 *
 * This module connects:
 * - the setup screen touchability button
 * - the fallback/default touchability action
 * - the back navigation from the touchability panel
 *
 * Important:
 * The actual touchability measurement logic lives in fingerTouchability.js.
 * Runtime state and storage updates are handled by touchabilityRuntime.js.
 */

import {
  requestFullscreenSafe,
} from "../core/helpers.js";

import {
  applyDefaultTouchability,
  saveCurrentTouchability,
} from "./touchabilityRuntime.js";

/**
 * Register touchability-related button event handlers.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing touchability and calibration data.
 *   ui: UI helper module, expected to provide show().
 *   touchability: Finger touchability workflow object, expected to provide
 *     open() and optionally close().
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Registers click event listeners on touchability-related buttons.
 *
 * Handled controls:
 *   - buttonTouchability: opens the touchability measurement panel.
 *   - btnTouchabilityFallback: applies and saves the default touch diameter.
 *   - btnTouchabilityBack: returns to the start/setup screen.
 *
 * Important:
 *   UI text is German by design.
 */
export function setupTouchabilityHandlers({
  dom,
  state,
  ui,
  touchability,
}) {
  // Open the touchability measurement workflow.
  // Fullscreen is requested first so the measurement happens in the same
  // display context as the experiment.
  dom.buttonTouchability?.addEventListener("click", async () => {
    await requestFullscreenSafe();

    touchability.open();
    ui.show(dom, "touchability");
  });

  // Use the default touch model when the participant-specific finger
  // measurement is skipped or unavailable.
  dom.btnTouchabilityFallback?.addEventListener("click", () => {
    touchability.close?.();

    applyDefaultTouchability(dom, state);
    saveCurrentTouchability(dom, state, "fallback");

    alert("Standardwert wurde verwendet.");
  });

  // Leave the touchability panel and return to the setup screen.
  dom.btnTouchabilityBack?.addEventListener("click", () => {
    touchability.close?.();

    dom.app?.classList.remove("running");
    ui.show(dom, "start");
  });
}
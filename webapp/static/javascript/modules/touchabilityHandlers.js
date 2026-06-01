/**
 * Touchability button handlers.
 *
 * Organigram reference:
 * - Touchability
 *   → UI Controls
 *
 * Responsibility:
 * Wires touchability panel buttons to the finger contact workflow.
 */

import {
  requestFullscreenSafe,
} from "../core/helpers.js";

import {
  applyDefaultTouchability,
  saveCurrentTouchability,
} from "./touchabilityRuntime.js";

export function setupTouchabilityHandlers({
  dom,
  state,
  ui,
  touchability,
}) {
  dom.buttonTouchability?.addEventListener("click", async () => {
    await requestFullscreenSafe();

    touchability.open();
    ui.show(dom, "touchability");
  });

  dom.btnTouchabilityFallback?.addEventListener("click", () => {
    applyDefaultTouchability(dom, state);
    saveCurrentTouchability(dom, state, "fallback");

    alert("Standardwert für den Zeigefinger wurde verwendet.");
  });

  dom.btnTouchabilityBack?.addEventListener("click", () => {
    ui.show(dom, "start");
  });
}
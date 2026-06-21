/**
 * Application bootstrap.
 *
 * Organigram reference:
 * - Application Entry Point
 *   → Core Initialization
 *   → Module Wiring
 *
 * Responsibility:
 * Starts the Fitts Display Lab web application.
 *
 * This file initializes:
 * - DOM references
 * - global state restoration
 * - feature modules
 * - UI handlers
 * - debug hooks
 *
 * Important:
 * main.js should only coordinate application startup.
 * Feature-specific logic belongs in dedicated modules.
 *
 * Extension guide:
 * - To add a new feature module: initialize it in initModules().
 * - To add a new top-level UI handler: wire it in boot().
 * - To change experiment logic: edit modules/experiment.js.
 */

import { state } from "./core/state.js";
import { getDom } from "./core/dom.js";

import * as ui from "./core/ui.js";
import * as server from "./core/server.js";

import * as dbg from "./debug/debug.js";

import { initAdminSettingsUI } from "./modules/adminSettingsUI.js";

import { initCalibration } from "./modules/calibration.js";

import { initExperiment } from "./modules/experiment.js";

import { initSessionDesign } from "./modules/sessionDesign.js";

import { initFingerTouchability } from "./modules/fingerTouchability.js";

import { setupExperimentDesignHandlers } from "./modules/protocolDesignHandlers.js";

import { setupRunHandlers } from "./modules/runHandlers.js";

import { setupExportHandlers } from "./modules/exportHandlers.js";

import { setupCalibrationHandlers } from "./modules/calibrationHandlers.js";

import { setupTouchabilityHandlers } from "./modules/touchabilityHandlers.js";

import { setupCommentToggle } from "./modules/commentHandlers.js";

import { loadParticipantTouchability } from "./modules/touchabilityRuntime.js";

import { setupIdHints, refreshIdHints } from "./modules/idHints.js";

import { hideExperimentDesignEditor, hideProtocolList } from "./modules/protocolManager.js";

import { loadCalibration, isCalibrationLikelyValid } from "./core/storage.js";

/**
 * Application entry point.
 *
 * Initializes the application after the DOM is available. The function collects
 * DOM references, initializes feature modules, wires UI handlers, restores
 * persisted device-specific state and finally shows the start screen.
 *
 * Returns:
 *   void
 *
 * Side effects:
 *   - Reads DOM references.
 *   - Initializes feature modules.
 *   - Registers event listeners.
 *   - Restores calibration and touchability state.
 *   - Updates UI state and HUD values.
 *
 * Notes:
 *   If essential DOM elements are not available yet, boot() schedules itself
 *   again with requestAnimationFrame(). This prevents initialization errors
 *   when the script runs before the UI is fully ready.
 */
function boot() {
  const dom = getDom();

  // Wait until the essential application elements are available.
  // This makes boot() robust against early script execution.
  if (!dom.app || !dom.buttonStart) {
    requestAnimationFrame(boot);
    return;
  }

  // Initialize feature modules and keep their public APIs for handler wiring.
  const modules = initModules(dom);

  // Initialize optional/admin-related UI first so its values are available
  // before protocol design or Monte Carlo handlers are used.
  initAdminSettingsUI(dom, ui);

  // Development/debug hooks.
  setupDebug(dom);

  // Restore persisted device-specific state.
  restoreCalibration(dom);
  loadParticipantTouchability(dom, state);

  // Keep viewport-dependent values synchronized.
  setupViewportUpdates(dom);

  // Wire participant/session ID checks and reload touchability when needed.
  setupIdHints({
    dom,
    onParticipantChanged: () =>
      loadParticipantTouchability(dom, state),
  });

  // Wire feature-specific UI handlers.
  setupCalibrationHandlers({
    dom,
    state,
    ui,
    cal: modules.cal,
  });

  setupTouchabilityHandlers({
    dom,
    state,
    ui,
    touchability: modules.touchability,
  });

  setupCommentToggle(dom);

  setupExperimentDesignHandlers({
    dom,
    state,
    ui,
    server,
    sessionDesign: modules.sessionDesign,
  });

  setupRunHandlers({
    dom,
    state,
    ui,
    exp: modules.exp,
    sessionDesign: modules.sessionDesign,
    refreshIdHints,
  });

  setupExportHandlers({
    dom,
    state,
    server,
    exp: modules.exp,
  });

  // Reset optional start-screen panels to a clean initial state.
  hideProtocolList(dom);
  hideExperimentDesignEditor(dom);

  // Show the setup screen as the initial UI state.
  ui.show(dom, "start");
}

/**
 * Initialize feature modules and return their public APIs.
 *
 * Args:
 *   dom: DOM reference object returned by getDom().
 *
 * Returns:
 *   Object containing initialized module APIs:
 *   - cal: calibration module API
 *   - exp: bound experiment runtime API
 *   - sessionDesign: protocol/session block design API
 *   - touchability: finger touchability measurement API
 *
 * Side effects:
 *   Creates module instances and binds shared dependencies such as state, ui
 *   and server helpers.
 *
 * Design rule:
 *   This function wires modules together, but feature-specific behavior should
 *   remain inside the corresponding module files.
 */
function initModules(dom) {
  const cal = initCalibration(dom, state, ui);
  const exp = initExperiment(dom, state, ui, server).bind();
  const sessionDesign = initSessionDesign(dom, state);
  const touchability = initFingerTouchability(dom, state);

  return {
    cal,
    exp,
    sessionDesign,
    touchability,
  };
}

/**
 * Enable debug UI and global debug logging when ?debug=1 is present.
 *
 * Args:
 *   dom: DOM reference object.
 *
 * Returns:
 *   void
 *
 * Side effects:
 *   - Shows or hides the debug button.
 *   - Registers a click listener for toggling debug output.
 *   - Registers global error and unhandled promise rejection listeners.
 *
 * Notes:
 *   In normal experiment mode, the debug button is hidden to keep the UI clean
 *   for participants and demonstrations.
 */
function setupDebug(dom) {
  const params = new URLSearchParams(location.search);
  const allowDebugUI = params.get("debug") === "1";

  if (dom.hudDebugBtn && !allowDebugUI) {
    dom.hudDebugBtn.style.display = "none";
  }

  if (dom.hudDebugBtn && allowDebugUI) {
    dom.hudDebugBtn.style.display = "inline-block";

    dom.hudDebugBtn.addEventListener("click", () => {
      const on = dbg.toggleDebug();
      dom.hudDebugBtn.textContent = `🐞 Debug: ${on ? "ON" : "OFF"}`;
    });
  }

  window.addEventListener("error", (e) => {
    dbg.log(" error:", e.message);
  });

  window.addEventListener("unhandledrejection", (e) => {
    dbg.log(" promise:", String(e.reason));
  });
}

/**
 * Keep viewport-dependent HUD values up to date.
 *
 * Args:
 *   dom: DOM reference object.
 *
 * Returns:
 *   void
 *
 * Side effects:
 *   Updates HUD size information immediately and registers a resize listener
 *   that refreshes the displayed viewport/device dimensions.
 *
 * Related modules:
 *   Uses core/ui.updateHudSize() and the shared application state.
 */
function setupViewportUpdates(dom) {
  ui.updateHudSize(dom, state);
  window.addEventListener("resize", () => {
    ui.updateHudSize(dom, state);
  });
}

/**
 * Restore persisted calibration if it still matches the current device context.
 *
 * Args:
 *   dom: DOM reference object.
 *
 * Returns:
 *   void
 *
 * Side effects:
 *   If a valid calibration exists, updates state.mmPerPx, state.calErrorPct,
 *   the HUD size display and the calibration status indicator.
 *
 * Validation:
 *   The saved calibration is only reused when isCalibrationLikelyValid()
 *   accepts it for the current device signature. This avoids applying an old
 *   calibration to a different screen or viewport setup.
 */
function restoreCalibration(dom) {
  const saved = loadCalibration();

  if (saved?.mmPerPx && isCalibrationLikelyValid(saved)) {
    state.mmPerPx = saved.mmPerPx;
    state.calErrorPct = saved.calErrorPct ?? null;
    ui.updateHudSize(dom, state);
    ui.updateCalibrationStatus?.(state);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
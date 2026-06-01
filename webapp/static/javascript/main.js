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

import {
  initAdminSettingsUI,
} from "./modules/adminSettingsUI.js";

import {
  initCalibration,
} from "./modules/calibration.js";

import {
  initExperiment,
} from "./modules/experiment.js";

import {
  initSessionDesign,
} from "./modules/sessionDesign.js";

import {
  initFingerTouchability,
} from "./modules/fingerTouchability.js";

import {
  setupExperimentDesignHandlers,
} from "./modules/protocolDesignHandlers.js";

import {
  setupRunHandlers,
} from "./modules/runHandlers.js";

import {
  setupExportHandlers,
} from "./modules/exportHandlers.js";

import {
  setupCalibrationHandlers,
} from "./modules/calibrationHandlers.js";

import {
  setupTouchabilityHandlers,
} from "./modules/touchabilityHandlers.js";

import {
  setupCommentToggle,
} from "./modules/commentHandlers.js";

import {
  loadParticipantTouchability,
} from "./modules/touchabilityRuntime.js";

import {
  setupIdHints,
  refreshIdHints,
} from "./modules/idHints.js";

import {
  hideExperimentDesignEditor,
  hideProtocolList,
} from "./modules/protocolManager.js";

import {
  loadCalibration,
  isCalibrationLikelyValid,
} from "./core/storage.js";

/**
 * Application entry point.
 */
function boot() {
  const dom = getDom();

  if (!dom.app || !dom.buttonStart) {
    requestAnimationFrame(boot);
    return;
  }

  const modules = initModules(dom);

  initAdminSettingsUI(dom, ui);
  setupDebug(dom);
  restoreCalibration(dom);
  loadParticipantTouchability(dom, state);
  setupViewportUpdates(dom);
  setupIdHints({
    dom,
    onParticipantChanged: () =>
      loadParticipantTouchability(dom, state),
  });
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

  hideProtocolList(dom);
  hideExperimentDesignEditor(dom);

  ui.show(dom, "start");
}

/**
 * Initialize feature modules.
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
 * Enable debug UI only when ?debug=1 is present.
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
 */
function setupViewportUpdates(dom) {
  ui.updateHudSize(dom, state);
  window.addEventListener("resize", () => {
    ui.updateHudSize(dom, state);
  });
}

/**
 * Restore calibration if it still matches the current device signature.
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
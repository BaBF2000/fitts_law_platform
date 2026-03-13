/**
 * Centralized DOM access layer.
 *
 * All document.getElementById calls are grouped here in order to:
 *   - Avoid selector duplication
 *   - Prevent ID typos across modules
 *   - Keep UI dependencies explicit and maintainable
 *
 * This module does not modify the DOM.
 * It only exposes references.
 */

import { $ } from "./helpers.js";

export function getDom() {
  return {
    // ------------------------------------------------------------
    // Root application container & experiment layers
    // ------------------------------------------------------------

    app: $("application"),
    target: $("target"),
    crosshair: $("crosshair"),

    // ------------------------------------------------------------
    // Heads-up display (visible during runs)
    // ------------------------------------------------------------

    hudLeft: $("hudLeft"),
    hudRight: $("hudRight"),

    // ------------------------------------------------------------
    // Panels / overlays
    // ------------------------------------------------------------

    startCard: $("startCard"),
    calPanel: $("calibrationPanel"),
    endPanel: $("endPanel"),

    // ------------------------------------------------------------
    // Participant / session identification
    // ------------------------------------------------------------

    participantId: $("participantId"),
    sessionId: $("sessionId"),

    // ------------------------------------------------------------
    // Global experiment settings
    // ------------------------------------------------------------

    trialCount: $("trialCount"),      // Derived from configured blocks (read-only)
    distanceMode: $("distanceMode"),
    IDFormula: $("IDFormula"),
    timeoutMs: $("timeoutMs"),

    fullscreenDimsCm: $("fullscreenDimsCm"),

    // ------------------------------------------------------------
    // Calibration panel elements
    // ------------------------------------------------------------

    calRect: $("calibrationRectangle"),
    calPx: $("calibrationPx"),
    calMmPerPx: $("calibrationMmPerPx"),
    handle: $("handle"),

    // ------------------------------------------------------------
    // Primary control buttons
    // ------------------------------------------------------------

    buttonCalibration: $("buttonCalibration"),
    btnClearCalibration: $("btnClearCalibration"),
    buttonStart: $("buttonStart"),
    buttonDemo: $("buttonDemonstration"),
    buttonBack: $("buttonBack"),
    buttonValidateCal: $("buttonValidateCalibration"),

    // ------------------------------------------------------------
    // End panel actions
    // ------------------------------------------------------------

    btnDownload: $("btnDownload"),
    btnSaveServer: $("btnSaveServer"),
    btnRestart: $("btnRestart"),

    // ------------------------------------------------------------
    // Strict mode & session configuration
    // ------------------------------------------------------------

    strictMode: $("strictMode"),
    buttonSessionConfig: $("buttonSessionConfig"),
  };
}
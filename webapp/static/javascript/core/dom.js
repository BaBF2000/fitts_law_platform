/**
 * Centralized DOM access layer.
 *
 * All document.getElementById calls are grouped here in order to:
 *   - Avoid selector duplication
 *   - Prevent ID typos across modules
 *   - Keep UI dependencies explicit and maintainable
 *
 * This module does not modify the DOM.
 * It only exposes references to existing DOM elements.
 */

import { $ } from "./helpers.js";

export function getDom() {
  return {
    // ------------------------------------------------------------
    // Root application container and experiment layers
    // ------------------------------------------------------------
    app: $("application"),
    crosshair: $("crosshair"),

    // ------------------------------------------------------------
    // Heads-up display (HUD)
    // ------------------------------------------------------------
    hudLeft: $("hudLeft"),
    hudRight: $("hudRight"),
    hudDebugBtn: $("hudDebugBtn"),

    // ------------------------------------------------------------
    // Panels and overlays
    // ------------------------------------------------------------
    startCard: $("startCard"),
    calPanel: $("calibrationPanel"),
    touchabilityPanel: $("touchabilityPanel"),
    sessionConfigPanel: $("sessionConfigPanel"),
    endPanel: $("endPanel"),

    // ------------------------------------------------------------
    // Participant and session identification
    // ------------------------------------------------------------
    participantId: $("participantId"),
    sessionId: $("sessionId"),
    sessionComment: $("sessionComment"),

    // ------------------------------------------------------------
    // Session comment toggle controls
    // ------------------------------------------------------------
    btnToggleSessionComment: $("btnToggleSessionComment"),
    sessionCommentBox: $("sessionCommentBox"),

    // ------------------------------------------------------------
    // Global experiment design settings
    // ------------------------------------------------------------
    trialCount: $("trialCount"),
    distanceMode: $("distanceMode"),
    timeoutMs: $("timeoutMs"),
    interactionsPerTrial: $("interactionsPerTrial"),

    // Fullscreen display dimensions (informational UI)
    fullscreenDimsCm: $("fullscreenDimsCm"),

    // ------------------------------------------------------------
    // Calibration panel elements
    // ------------------------------------------------------------
    calRect: $("calibrationRectangle"),
    calPx: $("calibrationPx"),
    calMmPerPx: $("calibrationMmPerPx"),
    handle: $("handle"),

    // ------------------------------------------------------------
    // Touchability panel elements
    // ------------------------------------------------------------
    fingerMeasureTarget: $("fingerMeasureTarget"),
    touchDiameterStatus: $("touchDiameterStatus"),
    touchDiameterPx: $("touchDiameterPx"),
    touchDiameterMm: $("touchDiameterMm"),
    wMinCircle: $("wMinCircle"),
    wMinSquare: $("wMinSquare"),
    wMinPolygon: $("wMinPolygon"),
    protocolStatus: $("protocolStatus"),

    // ------------------------------------------------------------
    // Primary control buttons
    // ------------------------------------------------------------
    buttonCalibration: $("buttonCalibration"),
    btnClearCalibration: $("btnClearCalibration"),
    buttonTouchability: $("buttonTouchability"),
    buttonSessionConfig: $("buttonSessionConfig"),
    buttonStart: $("buttonStart"),

    // ------------------------------------------------------------
    // Experiment design workflow
    // ------------------------------------------------------------
    btnCreateExperimentDesign: $("btnCreateExperimentDesign"),
    experimentDesignEditor: $("experimentDesignEditor"),
    protocolListBox: $("protocolListBox"),
    btnLoadLocalProtocol: $("btnLoadLocalProtocol"),

    // ------------------------------------------------------------
    // Protocol management buttons
    // ------------------------------------------------------------
    btnSaveProtocol: $("btnSaveProtocol"),
    btnLoadProtocol: $("btnLoadProtocol"),
    btnClearProtocol: $("btnClearProtocol"),

    // ------------------------------------------------------------
    // Calibration navigation buttons
    // ------------------------------------------------------------
    buttonBack: $("buttonBack"),
    buttonValidateCal: $("buttonValidateCalibration"),

    // ------------------------------------------------------------
    // Touchability navigation buttons
    // ------------------------------------------------------------
    btnTouchabilityFallback: $("btnTouchabilityFallback"),
    btnTouchabilityBack: $("btnTouchabilityBack"),

    // ------------------------------------------------------------
    // Session design panel actions
    // ------------------------------------------------------------
    btnAddBlock: $("btnAddBlock"),
    btnClearBlocks: $("btnClearBlocks"),
    btnSessionBack: $("btnSessionBack"),
    btnSessionApply: $("btnSessionApply"),
    blocksContainer: $("blocksContainer"),
    btnMonteCarlo: $("btnMonteCarlo"),
    monteCarloSummary: $("monteCarloSummary"),
    // ------------------------------------------------------------
    // Protocol metadata
    // ------------------------------------------------------------
    protocolName: $("protocolName"),
    protocolComment: $("protocolComment"),
    aSampling: document.getElementById("aSampling"),
    wSampling: document.getElementById("wSampling"),
    idSampling: document.getElementById("idSampling"),
    
    // ------------------------------------------------------------
    // End panel actions
    // ------------------------------------------------------------
    btnDownload: $("btnDownload"),
    btnSaveServer: $("btnSaveServer"),
    btnRestart: $("btnRestart"),


  };
}
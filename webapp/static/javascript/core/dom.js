/**
 * Centralized DOM access layer.
 *
 * Organigram reference:
 * - Core
 *   → DOM Registry
 * - UI Layer
 *   → Panel Management
 *   → User Interaction
 *
 * Responsibility:
 * Provides a single source of truth for DOM element references.
 *
 * All document.getElementById calls are centralized here to:
 * - avoid selector duplication
 * - prevent ID typos
 * - simplify maintenance
 * - make UI dependencies explicit
 *
 * Important:
 * This module must not contain UI logic.
 * It only returns references to existing DOM elements.
 *
 * Extension guide:
 * - Add new UI elements here before using them elsewhere.
 * - Prefer the helper function $() for consistency.
 * - Keep elements grouped by UI area.
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
    aSampling: $("aSampling"),
    wSampling: $("wSampling"),
    idSampling: $("idSampling"),
    
    // ------------------------------------------------------------
    // End panel actions
    // ------------------------------------------------------------
    btnDownload: $("btnDownload"),
    btnSaveServer: $("btnSaveServer"),
    btnRestart: $("btnRestart"),

    // ------------------------------------------------------------
    // Admin settings
    // ------------------------------------------------------------
    adminSettingsPanel: $("adminSettingsPanel"),


  };
}
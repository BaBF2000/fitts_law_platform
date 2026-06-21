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

// Helper around document.getElementById()
import { $ } from "./helpers.js";

/**
 * Collect all DOM references used by frontend modules.
 *
 * Returns:
 *   Object containing references to application panels, buttons, form fields,
 *   status displays and runtime UI elements.
 *
 * Side effects:
 *   None. This function only reads DOM elements by ID.
 *
 * Important:
 *   Some references may be null if the corresponding element is not present in
 *   templates/index.html. Feature modules should handle optional elements
 *   defensively when an element is not required for every screen.
 *
 * Related files:
 *   Element IDs must stay synchronized with templates/index.html.
 */
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
    handle: $("handle"),
    calScaleRange: $("calScaleRange"),

    // Optional legacy calibration display fields.
    // May be null if the current template does not render them.
    calPx: $("calibrationPx"),
    calMmPerPx: $("calibrationMmPerPx"),

    // Calibration navigation and action buttons
    buttonCalibration: $("buttonCalibration"),
    buttonBack: $("buttonBack"),
    buttonValidateCal: $("buttonValidateCalibration"),
    btnClearCalibration: $("btnClearCalibration"),

    // Calibration status badge
    calStatus: $("calStatus"),
    calDot: $("calDot"),
    calStatusText: $("calStatusText"),
    calStatusMeta: $("calStatusMeta"),

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
    buttonTouchability: $("buttonTouchability"),
    buttonSessionConfig: $("buttonSessionConfig"),
    buttonStart: $("buttonStart"),

    // ------------------------------------------------------------
    // Touchability navigation buttons
    // ------------------------------------------------------------
    btnTouchabilityFallback: $("btnTouchabilityFallback"),
    btnTouchabilityBack: $("btnTouchabilityBack"),

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

    // Optional legacy/local protocol controls.
    // May be null depending on the current protocol UI variant.
    btnLoadProtocol: $("btnLoadProtocol"),
    btnClearProtocol: $("btnClearProtocol"),

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
    btnAdminSettings: $("btnAdminSettings"),
    adminSettingsPanel: $("adminSettingsPanel"),
    btnAdminSave: $("btnAdminSave"),
    btnAdminReset: $("btnAdminReset"),
    btnAdminClose: $("btnAdminClose"),
    adminMinVisibleTargetPx: $("adminMinVisibleTargetPx"),
    adminTouchSafetyFactor: $("adminTouchSafetyFactor"),
    adminMaxTargetSizeRatio: $("adminMaxTargetSizeRatio"),
    adminMinAmplitudeMarginPx: $("adminMinAmplitudeMarginPx"),
    adminDefaultRequiredOverlap: $("adminDefaultRequiredOverlap"),
  };
}
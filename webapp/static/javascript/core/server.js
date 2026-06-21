/**
 * Backend communication layer.
 *
 * Organigram reference:
 * - Persistence Layer
 *   → Experiment Database
 *   → Protocol Database
 *
 * Responsibility:
 * Provides all communication between the web application and the Flask
 * backend API.
 *
 * Supported operations:
 * - save experiment results
 * - save protocols
 * - load protocols
 * - delete protocols
 *
 * Important:
 * This module should only perform HTTP communication.
 *
 * It must not:
 * - build experiment trials
 * - perform Monte Carlo calculations
 * - modify protocol structures
 * - manipulate UI state
 *
 * Extension guide:
 * - To add a new backend endpoint:
 *   1. Add a new exported API function here.
 *   2. Keep all fetch() calls centralized in this module.
 *   3. Return normalized payloads or throw errors.
 */

import { getDeviceContext } from "./device.js";
import { loadAdminSettings } from "./adminSettings.js";

/**
 * Persist a completed experiment session in the backend database.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing results, protocol snapshot,
 *     calibration values and runtime metadata.
 *
 * Returns:
 *   Promise<Object>: Backend JSON payload. On success, it usually contains
 *   ok=true and the created session_row_id.
 *
 * Side effects:
 *   Sends a POST request to /save_results.
 *
 * Stored data:
 *   - participant/session identifiers
 *   - session comment and demo flag
 *   - protocol snapshot and protocol metadata
 *   - admin settings snapshot
 *   - Monte Carlo summary values
 *   - calibration and touchability values
 *   - device context
 *   - trial and interaction result rows
 *
 * Failure behavior:
 *   Returns { ok:false, error:"no results" } when no result rows exist.
 *   Throws an Error when the backend response is not successful.
 *
 * Related backend:
 *   Handled by app.routes.results.save_results().
 */
export async function sendResultsToPC(dom, state) {
  if (!state.results.length) {
    return { ok: false, error: "no results" };
  }

  // Use the first result row as a fallback source for run-level metadata that is
  // constant across the session, such as unit, formula or target shape.
  const firstRow = state.results[0] ?? {};
  
  // Capture technical device/browser context at save time for later analysis
  const deviceContext = getDeviceContext();
  // Store the active constraint settings together with the session so the run can
  // be interpreted later even if defaults change.
  const adminSettings = loadAdminSettings();

  const meta = {
    // Participant/session identity
    participant_id: dom.participantId?.value?.trim() || "P",
    session_id: dom.sessionId?.value?.trim() || "S",
    session_comment: state.sessionComment || "",
    
    // Runtime mode
    is_demo: state.isDemoRun,

    // Protocol snapshot and metadata
    protocol_name: state.protocolName || state.currentProtocol?.protocol_name || "",
    protocol_comment: state.protocolComment || state.currentProtocol?.protocol_comment || "",
    protocol_json: state.currentProtocol
      ? JSON.stringify(state.currentProtocol)
      : null,

    // Parameter sampling metadata
    a_sampling: state.currentProtocol?.a_sampling ?? null,
    w_sampling: state.currentProtocol?.w_sampling ?? null,
    id_sampling: state.currentProtocol?.id_sampling ?? null,

    // Editable technical constraints active at save time
    admin_settings_json: JSON.stringify(adminSettings),

    // Monte Carlo pre-check summary stored with the session
    monte_carlo_summary_json: state.currentProtocol?.monte_carlo_summary
      ? JSON.stringify(state.currentProtocol.monte_carlo_summary)
      : null,

    monte_carlo_warning_count:
      state.currentProtocol?.monte_carlo_summary?.warning_count ?? null,

    monte_carlo_worst_clamp_pct:
      state.currentProtocol?.monte_carlo_summary?.worst_clamp_pct ?? null,

    monte_carlo_worst_diagnostic:
      state.currentProtocol?.monte_carlo_summary?.worst_diagnostic ?? null,

    monte_carlo_mean_clamped_min_pct:
      state.currentProtocol?.monte_carlo_summary?.mean_clamped_min_pct ?? null,

    monte_carlo_mean_clamped_max_pct:
      state.currentProtocol?.monte_carlo_summary?.mean_clamped_max_pct ?? null,

    unit: dom.distanceMode?.value || firstRow.unit || null,
    formula: firstRow.formula || "shannon",
    timeout_ms: Number(dom.timeoutMs?.value) || 0,
    trial_count: Number(dom.trialCount?.value) || null,
    interactions_per_trial: Number(state.interactionsPerTrial) || null,

    target_shape: state.session_target_mode ?? firstRow.target_shape ?? null,
    param_mode: firstRow.param_mode ?? null,

    required_overlap: firstRow.required_overlap ?? null,
    touch_diameter_px: firstRow.touch_diameter_px ?? state.touchDiameterPx ?? null,
    touch_diameter_mm: state.touchDiameterMm ?? null,

    mm_per_px: state.mmPerPx,

    viewport_w: deviceContext.viewport_w,
    viewport_h: deviceContext.viewport_h,
    dpr: deviceContext.dpr,
    user_agent: deviceContext.ua,

    device_context_json: JSON.stringify(deviceContext),
  };

  // Send the full run payload to the backend. The backend stores the session row
  // first and then inserts all result rows under that session.
  const response = await fetch("/save_results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      meta,
      rows: state.results,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "save failed");
  }

  return payload;
}

/**
 * Delete a reusable protocol template from the backend database.
 *
 * Args:
 *   id: Internal protocol database ID.
 *
 * Returns:
 *   Promise<Object>: Backend JSON response with ok=true on success.
 *
 * Side effects:
 *   Sends a DELETE request to /api/protocols/<id>.
 *
 * Failure behavior:
 *   Throws an Error if the backend rejects the request or returns ok=false.
 *
 * Related backend:
 *   Handled by app.routes.protocols.api_delete_protocol().
 */
export async function deleteProtocolFromDB(id) {
  const response = await fetch(`/api/protocols/${id}`, {
    method: "DELETE",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "protocol delete failed");
  }

  return payload;
}

/**
 * Persist a reusable protocol template in the backend database.
 *
 * Args:
 *   protocol: Protocol object created or edited in the frontend.
 *   adminSettings: Optional admin constraint settings to store with the
 *     protocol template.
 *
 * Returns:
 *   Promise<Object>: Backend JSON response, usually including protocol_id.
 *
 * Side effects:
 *   Sends a POST request to /api/protocols.
 *
 * Stored data:
 *   - protocol name and comment
 *   - serialized protocol JSON
 *   - sampling modes
 *   - admin settings snapshot
 *   - optional Monte Carlo summary values
 *
 * Failure behavior:
 *   Throws an Error if the backend response is not successful.
 *
 * Related backend:
 *   Handled by app.routes.protocols.api_save_protocol().
 */
export async function saveProtocolToDB(protocol, adminSettings) {
  const summary = protocol?.monte_carlo_summary ?? null;

  const response = await fetch("/api/protocols", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      protocol_name: protocol.protocol_name || protocol.name || "Unbenanntes Protokoll",
      protocol_comment: protocol.protocol_comment || "",
      protocol_json: JSON.stringify(protocol),

      a_sampling: protocol.a_sampling ?? null,
      w_sampling: protocol.w_sampling ?? null,
      id_sampling: protocol.id_sampling ?? null,

      admin_settings_json: adminSettings
        ? JSON.stringify(adminSettings)
        : null,

      monte_carlo_summary_json: summary
        ? JSON.stringify(summary)
        : null,

      monte_carlo_warning_count: summary?.warning_count ?? null,
      monte_carlo_worst_clamp_pct: summary?.worst_clamp_pct ?? null,
      monte_carlo_worst_diagnostic: summary?.worst_diagnostic ?? null,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "protocol save failed");
  }

  return payload;
}

/**
 * Load all reusable protocol templates from the backend database.
 *
 * Returns:
 *   Promise<Array>: List of protocol rows returned by the backend. Returns an
 *   empty array if the backend response contains no protocols.
 *
 * Side effects:
 *   Sends a GET request to /api/protocols.
 *
 * Failure behavior:
 *   Throws an Error if the backend response is not successful or ok=false.
 *
 * Related backend:
 *   Handled by app.routes.protocols.api_list_protocols().
 */
export async function loadProtocolsFromDB() {
  const response = await fetch("/api/protocols");
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "protocol load failed");
  }

  return payload.protocols || [];
}
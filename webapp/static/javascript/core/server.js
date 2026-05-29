/**
 * Backend communication helpers.
 */

import { getDeviceContext } from "./device.js";
import { loadAdminSettings } from "./adminSettings.js";

/**
 * Send the completed experiment results to the Flask backend.
 */
export async function sendResultsToPC(dom, state) {
  if (!state.results.length) {
    return { ok: false, error: "no results" };
  }

  const firstRow = state.results[0] ?? {};

  const deviceContext = getDeviceContext();
  const adminSettings = loadAdminSettings();

  const meta = {
    participant_id: dom.participantId?.value?.trim() || "P",
    session_id: dom.sessionId?.value?.trim() || "S",
    session_comment: state.sessionComment || "",

    is_demo: state.isDemoRun,

    protocol_name: state.protocolName || state.currentProtocol?.protocol_name || "",
    protocol_comment: state.protocolComment || state.currentProtocol?.protocol_comment || "",
    protocol_json: state.currentProtocol
      ? JSON.stringify(state.currentProtocol)
      : null,

    a_sampling: state.currentProtocol?.a_sampling ?? null,
    w_sampling: state.currentProtocol?.w_sampling ?? null,
    id_sampling: state.currentProtocol?.id_sampling ?? null,

    admin_settings_json: JSON.stringify(adminSettings),

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
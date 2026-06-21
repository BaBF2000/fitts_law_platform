/**
 * Experiment run handlers.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Run Controls
 *   → Session Snapshot
 *
 * Responsibility:
 * Wires experiment start and restart actions.
 *
 * Important:
 * Before starting a run, this module stores the exact protocol snapshot in
 * state.currentProtocol. This snapshot is later saved with the session and
 * must remain independent from editable/saved protocol templates.
 */

import {
  requestFullscreenSafe,
  lockOrientationIfPossible,
  unlockOrientationIfPossible,
} from "../core/helpers.js";

import {
  buildProtocolObject,
  attachMonteCarloSummary,
  validateProtocol,
  markProtocolStatus,
} from "./protocol.js";

/**
 * Register handlers for starting and restarting an experiment run.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   ui: Core UI helper module, expected to provide show().
 *   exp: Experiment runtime controller, expected to provide startRun() and
 *     resetRun().
 *   sessionDesign: Session design editor API returned by initSessionDesign().
 *   refreshIdHints: Function that refreshes participant/session ID hints.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Registers click event listeners on the start and restart buttons.
 *
 * Responsibility:
 *   This function connects UI controls to the runtime experiment lifecycle.
 */
export function setupRunHandlers({
  dom,
  state,
  ui,
  exp,
  sessionDesign,
  refreshIdHints,
}) {
  /**
   * Start button handler.
   *
   * Behavior:
   *   - Builds the protocol object from the current UI/session design.
   *   - Validates the protocol before starting.
   *   - Stores session comment and interaction settings in state.
   *   - Stores an immutable protocol snapshot in state.currentProtocol.
   *   - Attaches Monte Carlo summary information to the protocol snapshot.
   *   - Requests fullscreen and orientation lock.
   *   - Starts the experiment runtime.
   *
   * Important:
   *   The protocol snapshot stored here is later persisted with the session.
   *   This makes the recorded experiment reproducible even if the editable
   *   protocol template changes later.
   */
  dom.buttonStart?.addEventListener("click", async () => {
    // Build a protocol object from the current UI and session block editor.
    const protocol =
      buildProtocolObject(dom, state, sessionDesign);

    // Validate the protocol before any fullscreen/orientation change.
    const check =
      validateProtocol(protocol, state);

    // Store session-level metadata that will later be saved with the results.
    state.sessionComment =
      dom.sessionComment?.value?.trim() || "";

    state.interactionsPerTrial =
      protocol.interactionsPerTrial;

    // Store the exact protocol snapshot used for this run.
    // The snapshot is independent from reusable protocol templates.
    state.currentProtocol =
      attachMonteCarloSummary(protocol, state);

    state.protocolName =
      protocol.protocol_name || "";

    state.protocolComment =
      protocol.protocol_comment || "";

    // Stop immediately if protocol validation failed.
    if (!check.ok) {
      alert(check.message);
      markProtocolStatus(dom, state, false);
      return;
    }

    markProtocolStatus(dom, state, true);

    // Enter controlled experiment display mode before the runtime starts.
    await requestFullscreenSafe();
    await lockOrientationIfPossible();

    // Give the browser a short moment to apply fullscreen/orientation changes
    // before target placement and viewport-dependent calculations start.
    await new Promise((resolve) =>
      setTimeout(resolve, 250)
    );

    // Start a normal, non-demo experiment run.
    exp.startRun(false);
  });

  /**
   * Restart button handler.
   *
   * Behavior:
   *   - Resets the experiment runtime.
   *   - Unlocks screen orientation if possible.
   *   - Removes the running CSS state.
   *   - Returns to the start/setup view.
   *   - Refreshes participant/session ID hints.
   */
  dom.btnRestart?.addEventListener("click", async () => {
    // Clear runtime state and generated targets/results.
    exp.resetRun();

    // Release orientation lock after the experiment run ends.
    await unlockOrientationIfPossible();

    // Return the UI to the setup state.
    dom.app?.classList.remove("running");
    ui.show(dom, "start");

    // Re-check participant/session identifiers for duplicate hints.
    refreshIdHints(dom);
  });
}
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

export function setupRunHandlers({
  dom,
  state,
  ui,
  exp,
  sessionDesign,
  refreshIdHints,
}) {
  dom.buttonStart?.addEventListener("click", async () => {
    const protocol =
      buildProtocolObject(dom, state, sessionDesign);

    const check =
      validateProtocol(protocol, state);

    state.sessionComment =
      dom.sessionComment?.value?.trim() || "";

    state.interactionsPerTrial =
      protocol.interactionsPerTrial;

    state.currentProtocol =
      attachMonteCarloSummary(protocol, state);

    state.protocolName =
      protocol.protocol_name || "";

    state.protocolComment =
      protocol.protocol_comment || "";

    if (!check.ok) {
      alert(check.message);
      markProtocolStatus(dom, state, false);
      return;
    }

    markProtocolStatus(dom, state, true);

    await requestFullscreenSafe();
    await lockOrientationIfPossible();

    await new Promise((resolve) =>
      setTimeout(resolve, 250)
    );

    exp.startRun(false);
  });

  dom.btnRestart?.addEventListener("click", async () => {
    exp.resetRun();

    await unlockOrientationIfPossible();

    dom.app?.classList.remove("running");
    ui.show(dom, "start");

    refreshIdHints(dom);
  });
}
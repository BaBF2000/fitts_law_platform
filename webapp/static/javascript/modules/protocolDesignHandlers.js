/**
 * Protocol design handlers.
 *
 * Organigram reference:
 * - Experiment Design
 *   → Protocol Management
 *   → Design Actions
 *
 * Responsibility:
 * Wires the protocol design buttons:
 * - create/open editor
 * - load protocol list
 * - run Monte Carlo preview
 * - clear current protocol
 * - open session block editor
 * - save protocol
 *
 * Important:
 * This module coordinates UI actions only.
 * Protocol construction/validation stays in protocol.js.
 * Protocol list rendering stays in protocolListController.js.
 */

import {
  requestFullscreenSafe,
} from "../core/helpers.js";

/*
 * Legacy localStorage protocol persistence.
 *
 * This block is currently disabled because reusable protocols are now saved
 * through the backend into SQLite. Keep it only as temporary migration reference.
 */
/*
import {
  saveProtocol,
  clearProtocol,
} from "../core/storage.js";
*/

import {
  loadAdminSettings,
} from "../core/adminSettings.js";

import {
  buildProtocolObject,
  attachMonteCarloSummary,
  validateProtocol,
  markProtocolStatus,
} from "./protocol.js";

import {
  runMonteCarloProtocol,
} from "./monteCarlo.js";

import {
  renderMonteCarloSummary,
} from "./monteCarloSummaryView.js";

import {
  renderProtocolList,
} from "./protocolListController.js";

import {
  showExperimentDesignEditor,
  hideExperimentDesignEditor,
  showProtocolList,
  hideProtocolList,
} from "./protocolManager.js";

/**
 * Register experiment-design and protocol-management UI handlers.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   ui: Core UI helper module. Currently not used directly in this module.
 *   server: Backend communication layer for database-backed protocol storage.
 *   sessionDesign: Session block editor API returned by initSessionDesign().
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Registers click handlers for protocol creation, loading, Monte Carlo
 *   preview, clearing, session block editing and saving.
 *
 * Responsibility:
 *   This function connects protocol-design UI controls to the protocol editor,
 *   protocol list controller, Monte Carlo preview and backend save workflow.
 */
export function setupExperimentDesignHandlers({
  dom,
  state,
  ui,
  server,
  sessionDesign,
}) {
  /**
   * Open the experiment design editor for creating or editing a protocol.
   *
   * Side effects:
   *   Hides the protocol list, shows the editor and marks the current protocol
   *   as not yet validated/saved.
   */
  dom.btnCreateExperimentDesign?.addEventListener("click", () => {
    hideProtocolList(dom);
    showExperimentDesignEditor(dom);
    markProtocolStatus(dom, state, false);
  });

  /**
   * Open the saved protocol list.
   *
   * Side effects:
   *   Hides the editor, shows the protocol list container and loads protocols
   *   from the backend through renderProtocolList().
   */
  dom.btnLoadProtocol?.addEventListener("click", () => {
    hideExperimentDesignEditor(dom);
    showProtocolList(dom);

    renderProtocolList({
      dom,
      state,
      sessionDesign,
      server,
    });
  });

  /**
   * Run a Monte Carlo preview for the current protocol draft.
   *
   * Side effects:
   *   Builds a protocol object from the current UI, runs the Monte Carlo
   *   simulation in the browser and renders the summary in the UI.
   *
   * Important:
   *   This is a preview only. It does not save the protocol and does not start
   *   an experiment run.
   */
  dom.btnMonteCarlo?.addEventListener("click", () => {
    const protocol =
      buildProtocolObject(dom, state, sessionDesign);

    const simulation =
      runMonteCarloProtocol({
        protocol,
        state,
        n: 50000,
        histogramBins: 100,
      });

    renderMonteCarloSummary(dom, simulation);
  });

  /*
   * Legacy localStorage protocol clearing.
   *
   * Disabled because protocols are no longer cleared from localStorage here.
   * The active implementation below only clears the current editor state.
   */
  /*
  dom.btnClearProtocol?.addEventListener("click", () => {
    clearProtocol();

    state.protocolReady = false;
    state.sessionBlocks = [];
    state.currentProtocol = null;
    state.protocolName = "";
    state.protocolComment = "";

    if (dom.protocolName) {
      dom.protocolName.value = "";
    }

    if (dom.protocolComment) {
      dom.protocolComment.value = "";
    }

    markProtocolStatus(dom, state, false);
    hideProtocolList(dom);
    hideExperimentDesignEditor(dom);

    alert("Gespeichertes Protokoll gelöscht.");
  });
  */

  /**
   * Clear the currently edited protocol from the editor.
   *
   * Side effects:
   *   Resets protocol-related state fields, clears protocol name/comment inputs,
   *   marks the protocol as not ready and hides protocol UI panels.
   *
   * Important:
   *   This does not delete protocols from SQLite. It only clears the currently
   *   active editor draft.
   */
  dom.btnClearProtocol?.addEventListener("click", () => {
    state.protocolReady = false;
    state.sessionBlocks = [];
    state.currentProtocol = null;
    state.protocolName = "";
    state.protocolComment = "";

    if (dom.protocolName) {
      dom.protocolName.value = "";
    }

    if (dom.protocolComment) {
      dom.protocolComment.value = "";
    }

    markProtocolStatus(dom, state, false);
    hideProtocolList(dom);
    hideExperimentDesignEditor(dom);

    alert("Aktuelles Protokoll wurde aus dem Editor entfernt.");
  });

  /**
   * Open the session block editor.
   *
   * Side effects:
   *   Requests fullscreen mode and opens the block-based session design editor.
   *
   * Reason:
   *   Fullscreen makes viewport-dependent protocol values and previews more
   *   consistent with the later experiment run.
   */
  dom.buttonSessionConfig?.addEventListener("click", async () => {
    await requestFullscreenSafe();
    sessionDesign.open();
  });

  /**
   * Save the current protocol draft to the backend database.
   *
   * Side effects:
   *   Builds, validates and saves the current protocol draft.
   */
  dom.btnSaveProtocol?.addEventListener("click", async () => {
    await saveCurrentProtocol({
      dom,
      state,
      sessionDesign,
      server,
    });
  });
}

/**
 * Build, validate and save the current protocol draft.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   sessionDesign: Session block editor API.
 *   server: Backend communication layer, expected to provide saveProtocolToDB().
 *
 * Returns:
 *   Promise<void>.
 *
 * Side effects:
 *   May show validation alerts, Monte Carlo distortion confirmation dialogs,
 *   backend error alerts and success alerts. Updates current protocol state and
 *   protocol status indicators.
 *
 * Workflow:
 *   1. Build the protocol object from the current editor.
 *   2. Validate protocol consistency.
 *   3. Attach Monte Carlo summary metadata.
 *   4. Warn if the protocol is strongly distorted by constraints.
 *   5. Save the protocol to SQLite through the backend.
 *   6. Store the saved protocol as state.currentProtocol.
 *
 * Important:
 *   This function saves reusable protocol templates. Experiment session
 *   snapshots are created later when a run starts.
 */
async function saveCurrentProtocol({
  dom,
  state,
  sessionDesign,
  server,
}) {
  const protocol = buildProtocolObject(dom, state, sessionDesign);

  const check = validateProtocol(protocol, state);

  if (!check.ok) {
    alert(check.message);
    markProtocolStatus(dom, state, false);
    return;
  }

  const protocolWithMonteCarlo = attachMonteCarloSummary(protocol, state);

  const monteCarlo = protocolWithMonteCarlo.monte_carlo_summary;

  // Ask for explicit confirmation when the Monte Carlo preview indicates that
  // the planned distribution is strongly distorted by technical constraints.
  if (isStronglyDistorted(monteCarlo)) {
    const ok = confirmStrongDistortion(monteCarlo);

    if (!ok) {
      markProtocolStatus(dom, state, false);
      return;
    }
  }

  /*
   * Legacy mixed localStorage + SQLite save workflow.
   *
   * Disabled because the current workflow uses SQLite only.
   */
  /*
  const saved = saveProtocol(protocolWithMonteCarlo);

  try {
    await server.saveProtocolToDB(
      protocolWithMonteCarlo,
      loadAdminSettings()
    );
  } catch (err) {
    alert(
      "Protokoll wurde lokal gespeichert, aber nicht in der Datenbank.\n\n" +
      (err?.message || err)
    );
  }
  */

  /**
   * SQLite-only protocol save workflow.
   *
   * The backend response may contain a database protocol ID. This ID is attached
   * to the in-memory protocol snapshot for later reference in the UI.
   */
  let saved = protocolWithMonteCarlo;

  try {
    const response = await server.saveProtocolToDB(
      protocolWithMonteCarlo,
      loadAdminSettings()
    );

    saved = {
      ...protocolWithMonteCarlo,
      db_id: response?.protocol_id ?? null,
    };
  } catch (err) {
    alert(
      "Protokoll konnte nicht in der Datenbank gespeichert werden.\n\n" +
      (err?.message || err)
    );

    markProtocolStatus(dom, state, false);
    return;
  }

  state.currentProtocol = saved;
  state.protocolName = saved.protocol_name || "";
  state.protocolComment = saved.protocol_comment || "";

  markProtocolStatus(dom, state, true);

  alert("Protokoll gespeichert.");
}

/**
 * Check whether a Monte Carlo summary indicates strong constraint distortion.
 *
 * Args:
 *   monteCarlo: Monte Carlo summary object attached to a protocol.
 *
 * Returns:
 *   true if the protocol is strongly distorted, otherwise false.
 *
 * Side effects:
 *   None.
 *
 * Criteria:
 *   A protocol is considered strongly distorted if:
 *   - worst_diagnostic is "strong_distortion", or
 *   - worst_clamp_pct is greater than 50%.
 */
function isStronglyDistorted(monteCarlo) {
  return (
    monteCarlo?.worst_diagnostic === "strong_distortion" ||
    Number(monteCarlo?.worst_clamp_pct ?? 0) > 50
  );
}

/**
 * Ask the user to confirm saving a strongly distorted protocol.
 *
 * Args:
 *   monteCarlo: Monte Carlo summary object containing worst distortion metrics.
 *
 * Returns:
 *   true if the user confirms saving, otherwise false.
 *
 * Side effects:
 *   Shows a blocking browser confirmation dialog.
 *
 * Important:
 *   UI text is German by design.
 */
function confirmStrongDistortion(monteCarlo) {
  return confirm(
    "Achtung: Das Protokoll ist stark verzerrt.\n\n" +
    `Worst Clamp: ${(monteCarlo.worst_clamp_pct ?? 0).toFixed(1)}%\n` +
    `Diagnose: ${monteCarlo.worst_diagnostic}\n\n` +
    "Das bedeutet, dass die geplante Verteilung stark durch technische Grenzen verändert wird.\n\n" +
    "Trotzdem speichern?"
  );
}
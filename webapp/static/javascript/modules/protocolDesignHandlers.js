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

import {
  saveProtocol,
  clearProtocol,
} from "../core/storage.js";

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

export function setupExperimentDesignHandlers({
  dom,
  state,
  ui,
  server,
  sessionDesign,
}) {
  dom.btnCreateExperimentDesign?.addEventListener("click", () => {
    hideProtocolList(dom);
    showExperimentDesignEditor(dom);
    markProtocolStatus(dom, state, false);
  });

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

  dom.buttonSessionConfig?.addEventListener("click", async () => {
    await requestFullscreenSafe();
    sessionDesign.open();
  });

  dom.btnSaveProtocol?.addEventListener("click", async () => {
    await saveCurrentProtocol({
      dom,
      state,
      sessionDesign,
      server,
    });
  });
}

async function saveCurrentProtocol({
  dom,
  state,
  sessionDesign,
  server,
}) {
  const protocol =
    buildProtocolObject(dom, state, sessionDesign);

  const check =
    validateProtocol(protocol, state);

  if (!check.ok) {
    alert(check.message);
    markProtocolStatus(dom, state, false);
    return;
  }

  const protocolWithMonteCarlo =
    attachMonteCarloSummary(protocol, state);

  const monteCarlo =
    protocolWithMonteCarlo.monte_carlo_summary;

  if (isStronglyDistorted(monteCarlo)) {
    const ok =
      confirmStrongDistortion(monteCarlo);

    if (!ok) {
      markProtocolStatus(dom, state, false);
      return;
    }
  }

  const saved =
    saveProtocol(protocolWithMonteCarlo);

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

  state.currentProtocol = saved;
  state.protocolName = saved.protocol_name || "";
  state.protocolComment = saved.protocol_comment || "";

  markProtocolStatus(dom, state, true);

  alert("Protokoll gespeichert.");
}

function isStronglyDistorted(monteCarlo) {
  return (
    monteCarlo?.worst_diagnostic === "strong_distortion" ||
    Number(monteCarlo?.worst_clamp_pct ?? 0) > 50
  );
}

function confirmStrongDistortion(monteCarlo) {
  return confirm(
    "Achtung: Das Protokoll ist stark verzerrt.\n\n" +
    `Worst Clamp: ${(monteCarlo.worst_clamp_pct ?? 0).toFixed(1)}%\n` +
    `Diagnose: ${monteCarlo.worst_diagnostic}\n\n` +
    "Das bedeutet, dass die geplante Verteilung stark durch technische Grenzen verändert wird.\n\n" +
    "Trotzdem speichern?"
  );
}
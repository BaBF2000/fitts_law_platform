import { state } from "./core/state.js";
import { getDom } from "./core/dom.js";
import * as ui from "./core/ui.js";
import * as server from "./core/server.js";
import { requestFullscreenSafe, lockOrientationIfPossible, unlockOrientationIfPossible, } from "./core/helpers.js";

import { DEFAULT_TOUCH_DIAMETER_PX } from "./core/constants.js";

import { initCalibration } from "./modules/calibration.js";
import { initExperiment } from "./modules/experiment.js";
import { initSessionDesign } from "./modules/sessionDesign.js";
import { initFingerTouchability } from "./modules/fingerTouchability.js";

import { loadCalibration, isCalibrationLikelyValid, clearCalibration, saveProtocol, 
  loadProtocolById, deleteProtocolById, clearProtocol, listProtocols, saveTouchabilityForParticipant, 
  loadTouchabilityForParticipant, } from "./core/storage.js";

import {
  buildProtocolObject,
  attachMonteCarloSummary,
  applyProtocolObject,
  validateProtocol,
  markProtocolStatus,
} from "./modules/protocol.js";

import { runMonteCarloProtocol } from "./modules/monteCarlo.js";

import * as dbg from "./debug/debug.js";

import {
  loadAdminSettings,
  saveAdminSettings,
  clearAdminSettings,
} from "./core/adminSettings.js";

/**
 * Refresh touchability status labels in the start screen.
 */

function initAdminSettingsUI(dom, ui) {
  const panel = document.getElementById("adminSettingsPanel");

  function fill() {
    const s = loadAdminSettings();

    document.getElementById("adminMinVisibleTargetPx").value = s.minVisibleTargetPx;
    document.getElementById("adminTouchSafetyFactor").value = s.touchSafetyFactor;
    document.getElementById("adminMaxTargetSizeRatio").value = s.maxTargetSizeRatio;
    document.getElementById("adminMinAmplitudeMarginPx").value = s.minAmplitudeMarginPx;
    document.getElementById("adminDefaultRequiredOverlap").value = s.defaultRequiredOverlap;
  }

  document.getElementById("btnAdminSettings")?.addEventListener("click", () => {
    fill();
    ui.show(dom, "adminSettings");
  });

  document.getElementById("btnAdminClose")?.addEventListener("click", () => {
    ui.show(dom, "start");
  });

  document.getElementById("btnAdminSave")?.addEventListener("click", () => {
    saveAdminSettings({
      minVisibleTargetPx: document.getElementById("adminMinVisibleTargetPx").value,
      touchSafetyFactor: document.getElementById("adminTouchSafetyFactor").value,
      maxTargetSizeRatio: document.getElementById("adminMaxTargetSizeRatio").value,
      minAmplitudeMarginPx: document.getElementById("adminMinAmplitudeMarginPx").value,
      defaultRequiredOverlap: document.getElementById("adminDefaultRequiredOverlap").value,
    });

    ui.show(dom, "start");
  });

  document.getElementById("btnAdminReset")?.addEventListener("click", () => {
    clearAdminSettings();
    fill();
  });
}


function updateTouchabilityUi(dom) {
  const px = state.touchDiameterPx ?? DEFAULT_TOUCH_DIAMETER_PX;
  const mm = state.touchDiameterMm;

  const source = state.touchabilitySource === "measured" ? "gemessen" : "Standardwert";

  if (dom.touchDiameterStatus) {
    dom.touchDiameterStatus.textContent =
      Number.isFinite(mm)
        ? `${Math.round(px)} px / ${mm.toFixed(1)} mm (${source}, Zeigefinger)`
        : `${Math.round(px)} px (${source}, Zeigefinger)`;
  }

  if (dom.touchDiameterPx) { dom.touchDiameterPx.textContent = `${Math.round(px)} px`; }

  if (dom.touchDiameterMm) { dom.touchDiameterMm.textContent = Number.isFinite(mm) ? `${mm.toFixed(1)} mm` : "—"; }
}

/**
 * Apply the default touch diameter when no participant-specific value exists.
 */
function applyDefaultTouchability(dom) {
  state.touchDiameterPx = DEFAULT_TOUCH_DIAMETER_PX;
  state.touchDiameterMm = state.mmPerPx ? DEFAULT_TOUCH_DIAMETER_PX * state.mmPerPx : null;
  state.touchabilitySource = "fallback";

  updateTouchabilityUi(dom);
}

/**
 * Load saved touchability data for the current participant.
 */
function loadParticipantTouchability(dom) {
  const pid = dom.participantId?.value?.trim() || "P01";
  const saved = loadTouchabilityForParticipant(pid);

  if (!saved?.touchDiameterPx) {
    applyDefaultTouchability(dom);
    return;
  }

  state.touchDiameterPx = saved.touchDiameterPx;
  state.touchDiameterMm = saved.touchDiameterMm ?? ( state.mmPerPx ? saved.touchDiameterPx * state.mmPerPx : null );
  state.touchabilitySource = saved.source ?? "measured";

  updateTouchabilityUi(dom);
}

/**
 * Save current touchability data for the current participant.
 */
function saveCurrentTouchability(dom, source = "measured") {
  const pid = dom.participantId?.value?.trim() || "P01";

  const px = state.touchDiameterPx ?? DEFAULT_TOUCH_DIAMETER_PX;
  const mm = state.touchDiameterMm ?? (
    state.mmPerPx ? px * state.mmPerPx : null
  );

  state.touchDiameterPx = px;
  state.touchDiameterMm = mm;
  state.touchabilitySource = source;

  saveTouchabilityForParticipant(pid, {
    touchDiameterPx: px,
    touchDiameterMm: mm,
    source,
    finger: "index",
  });

  updateTouchabilityUi(dom);
}

/**
 * Render the list of locally saved protocols.
 */
async function renderProtocolList(dom, sessionDesign) {
  if (!dom.protocolListBox) return;

  const localProtocols = listProtocols();

  let dbProtocols = [];
  try {
    dbProtocols = await server.loadProtocolsFromDB();
  } catch {
    dbProtocols = [];
  }

  if (!localProtocols.length && !dbProtocols.length) {
    dom.protocolListBox.innerHTML = `
      <p class="muted">Noch kein Protokoll gespeichert.</p>
    `;
    return;
  }

  const localHtml = localProtocols.map((p) => `
    <div class="protocolItem" data-source="local" data-id="${p.id}">
      <div>
        <b>${p.protocol_name ?? p.name ?? "Unbenanntes Protokoll"}</b>
        <div class="muted">
          Lokal · ${p.savedAt ? new Date(p.savedAt).toLocaleString("de-DE") : "—"}
          · ${p.sessionBlocks?.length ?? 0} Blöcke
        </div>
        ${p.protocol_comment ? `<div class="muted">${p.protocol_comment}</div>` : ""}
      </div>

      <div class="row">
        <button type="button" data-action="load-local" data-id="${p.id}">Laden</button>
        <button type="button" data-action="delete-local" data-id="${p.id}">Löschen</button>
      </div>
    </div>
  `).join("");

  const dbHtml = dbProtocols.map((p) => {
    let parsed = null;

    try {
      parsed = JSON.parse(p.protocol_json || "{}");
    } catch {
      parsed = null;
    }

    return `
      <div class="protocolItem" data-source="db" data-id="${p.id}">
        <div>
          <b>${p.protocol_name ?? "Unbenanntes Protokoll"}</b>
          <div class="muted">
            SQLite · ${p.updated_at ? new Date(p.updated_at).toLocaleString("de-DE") : "—"}
            · ${parsed?.sessionBlocks?.length ?? "?"} Blöcke
          </div>
          ${p.protocol_comment ? `<div class="muted">${p.protocol_comment}</div>` : ""}
        </div>

        <div class="row">
          <button type="button" data-action="load-db" data-id="${p.id}">Laden</button>
          <button type="button" data-action="delete-db" data-id="${p.id}">Löschen</button>
        </div>
      </div>
    `;
  }).join("");

  dom.protocolListBox.innerHTML = `
    ${localProtocols.length ? `<p class="muted"><b>Lokale Protokolle</b></p>${localHtml}` : ""}
    ${dbProtocols.length ? `<p class="muted"><b>Datenbank-Protokolle</b></p>${dbHtml}` : ""}
  `;

  dom.protocolListBox.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === "load-local") {
        const protocol = loadProtocolById(id);

        if (!protocol) {
          alert("Lokales Protokoll nicht gefunden.");
          renderProtocolList(dom, sessionDesign);
          return;
        }

        applyProtocolObject(protocol, dom, state, sessionDesign);
        hideProtocolList(dom);
        showExperimentDesignEditor(dom);
        markProtocolStatus(dom, state, true);

        alert("Lokales Protokoll geladen.");
      }

      if (action === "delete-local") {
        deleteProtocolById(id);
        renderProtocolList(dom, sessionDesign);
        alert("Lokales Protokoll gelöscht.");
      }

      if (action === "load-db") {
        const item = dbProtocols.find((p) => String(p.id) === String(id));

        if (!item) {
          alert("Datenbank-Protokoll nicht gefunden.");
          return;
        }

        let protocol = null;

        try {
          protocol = JSON.parse(item.protocol_json || "{}");
        } catch {
          alert("Datenbank-Protokoll konnte nicht gelesen werden.");
          return;
        }

        applyProtocolObject(protocol, dom, state, sessionDesign);
        hideProtocolList(dom);
        showExperimentDesignEditor(dom);
        markProtocolStatus(dom, state, true);

        alert("Datenbank-Protokoll geladen.");
      }

      if (action === "delete-db") {
        if (!confirm("Datenbank-Protokoll wirklich löschen?")) return;
      
        try {
          await server.deleteProtocolFromDB(id);
          await renderProtocolList(dom, sessionDesign);
          alert("Datenbank-Protokoll gelöscht.");
        } catch (err) {
          alert("Löschen fehlgeschlagen: " + (err?.message || err));
        }
      }
    });
  });
}

/**
 * Application entry point.
 */
function boot() {
  const dom = getDom();

  if (!dom.app || !dom.buttonStart) {
    requestAnimationFrame(boot);
    return;
  }

  const modules = initModules(dom);

  initAdminSettingsUI(dom, ui);
  setupDebug(dom);
  restoreCalibration(dom);
  loadParticipantTouchability(dom);
  setupViewportUpdates(dom);
  setupIdHints(dom);
  setupCalibrationHandlers(dom, modules.cal);
  setupTouchabilityHandlers(dom, modules.touchability);
  setupCommentToggle(dom);
  setupExperimentDesignHandlers(dom, modules.sessionDesign);
  setupRunHandlers(dom, modules.exp, modules.sessionDesign);
  setupExportHandlers(dom, modules.exp);

  hideProtocolList(dom);
  hideExperimentDesignEditor(dom);

  ui.show(dom, "start");
}

/**
 * Initialize feature modules.
 */
function initModules(dom) {
  const cal = initCalibration(dom, state, ui);
  const exp = initExperiment(dom, state, ui, server).bind();
  const sessionDesign = initSessionDesign(dom, state);
  const touchability = initFingerTouchability(dom, state);

  return {
    cal,
    exp,
    sessionDesign,
    touchability,
  };
}

/**
 * Enable debug UI only when ?debug=1 is present.
 */
function setupDebug(dom) {
  const params = new URLSearchParams(location.search);
  const allowDebugUI = params.get("debug") === "1";

  if (dom.hudDebugBtn && !allowDebugUI) {
    dom.hudDebugBtn.style.display = "none";
  }

  if (dom.hudDebugBtn && allowDebugUI) {
    dom.hudDebugBtn.style.display = "inline-block";

    dom.hudDebugBtn.addEventListener("click", () => {
      const on = dbg.toggleDebug();
      dom.hudDebugBtn.textContent = `🐞 Debug: ${on ? "ON" : "OFF"}`;
    });
  }

  window.addEventListener("error", (e) => {
    dbg.log("❌ error:", e.message);
  });

  window.addEventListener("unhandledrejection", (e) => {
    dbg.log("❌ promise:", String(e.reason));
  });
}

/**
 * Keep viewport-dependent HUD values up to date.
 */
function setupViewportUpdates(dom) {
  ui.updateHudSize(dom, state);
  window.addEventListener("resize", () => {
    ui.updateHudSize(dom, state);
  });
}

/**
 * Restore calibration if it still matches the current device signature.
 */
function restoreCalibration(dom) {
  const saved = loadCalibration();

  if (saved?.mmPerPx && isCalibrationLikelyValid(saved)) {
    state.mmPerPx = saved.mmPerPx;
    state.calErrorPct = saved.calErrorPct ?? null;
    ui.updateHudSize(dom, state);
    ui.updateCalibrationStatus?.(state);
  }
}

function renderMonteCarloSummary(dom, sim) {
  if (!dom.monteCarloSummary) return;

  const meta = sim.meta ?? {};
  const blocks = sim.blocks ?? [];
  const warnings = meta.warnings ?? [];

  const blockRows = blocks.map((b) => {
    const c = b.result?.counts ?? {};
    const m = b.result?.meta ?? {};

    return `
      <tr>
        <td>Block ${b.block_no}</td>
        <td>${b.shape}</td>
        <td>${b.param_mode}</td>
        <td>${(c.clamped_min_pct ?? 0).toFixed(1)}%</td>
        <td>${(c.clamped_max_pct ?? 0).toFixed(1)}%</td>
        <td>${(c.clamped_total_pct ?? 0).toFixed(1)}%</td>
        <td>${m.sampling ?? "—"}</td>
      </tr>
    `;
  }).join("");

  const warningHtml = warnings.length
    ? `
      <div class="monteCarloWarnings">
        <h4>Warnungen</h4>
        ${warnings.map((w) => `
          <p class="muted">
            <b>Block ${w.block_no}</b>: ${w.message}
          </p>
        `).join("")}
      </div>
    `
    : `<p class="muted">Keine kritischen Monte-Carlo-Warnungen.</p>`;

  dom.monteCarloSummary.innerHTML = `
    <h3>Monte-Carlo-Analyse</h3>

    <div class="kpi">
      <div><b>Blöcke</b><span>${meta.block_count ?? blocks.length}</span></div>
      <div><b>Samples / Block</b><span>${meta.n ?? "—"}</span></div>
      <div><b>Wmin Clamp Ø</b><span>${(meta.mean_clamped_min_pct ?? 0).toFixed(1)}%</span></div>
      <div><b>Wmax Clamp Ø</b><span>${(meta.mean_clamped_max_pct ?? 0).toFixed(1)}%</span></div>
      <div><b>Schlechtester Block</b><span>${meta.worst_block_no ?? "—"}</span></div>
      <div><b>Clamp max.</b><span>${(meta.worst_clamp_pct ?? 0).toFixed(1)}%</span></div>
      <div><b>Diagnose</b><span>${meta.worst_diagnostic ?? "—"}</span></div>
      <div><b>Warnungen</b><span>${meta.warning_count ?? warnings.length}</span></div>
    </div>

    ${warningHtml}

    <h4>Analyse pro Block</h4>

    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Block</th>
            <th>Form</th>
            <th>Parametermodus</th>
            <th>W → Wmin</th>
            <th>W → Wmax</th>
            <th>Clamp gesamt</th>
            <th>Verteilung</th>
          </tr>
        </thead>
        <tbody>
          ${blockRows || `<tr><td colspan="7">Keine Blöcke.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="row">
      <button type="button" onclick="window.open('/dashboard/montecarlo', '_blank')">
        Dashboard öffnen
      </button>
    </div>
  `;

  dom.monteCarloSummary.style.display = "block";
}

/**
 * Update participant/session availability hints.
 */
function setupIdHints(dom) {
  let hintTimer = null;

  function scheduleHintRefresh() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => refreshIdHints(dom), 250);
  }

  dom.participantId?.addEventListener("input", scheduleHintRefresh);
  dom.sessionId?.addEventListener("input", scheduleHintRefresh);

  dom.participantId?.addEventListener("change", () => {
    loadParticipantTouchability(dom);
  });

  refreshIdHints(dom);
}

/**
 * Query backend to check whether participant/session IDs already exist.
 */
async function refreshIdHints(dom) {
  const participantHintRow = document.getElementById("participantHintRow");
  const sessionHintRow = document.getElementById("sessionHintRow");
  const participantHintText = participantHintRow?.querySelector(".hintText");
  const sessionHintText = sessionHintRow?.querySelector(".hintText");

  const pid = dom.participantId?.value?.trim() || "";
  const sid = dom.sessionId?.value?.trim() || "";

  if (!pid && !sid) {
    hideHint(participantHintRow, participantHintText);
    hideHint(sessionHintRow, sessionHintText);
    return;
  }

  try {
    const r = await fetch(
      `/check_ids?participant_id=${encodeURIComponent(pid)}&session_id=${encodeURIComponent(sid)}`
    );

    const data = await r.json();
    if (!data?.ok) return;

    setHint(
     participantHintRow,
      participantHintText,
      data.participant_exists,
      " Teilnehmer existiert bereits in der Datenbank."
    );

    setHint(
      sessionHintRow,
      sessionHintText,
      data.session_exists,
      "Diese Versuch-ID existiert bereits für diesen Teilnehmer."
    );

    if (dom.buttonStart) {
      dom.buttonStart.disabled = !!data.session_exists;
    }
  } catch {
    // Network issues should not block local experiment setup.
  }
}

function setHint(row, text, visible, message) {
  if (!row || !text) return;

  row.style.display = visible ? "flex" : "none";
  text.textContent = visible ? message : "";
}

function hideHint(row, text) {
  setHint(row, text, false, "");
}

/**
 * Wire calibration buttons.
 */
function setupCalibrationHandlers(dom, cal) {
  dom.buttonCalibration?.addEventListener("click", async () => {
    await requestFullscreenSafe();

    dom.app?.classList.remove("running");
    ui.show(dom, "cal");
    cal.initRect();
  });

  dom.buttonBack?.addEventListener("click", async () => {
    cal.cancel?.();

    await unlockOrientationIfPossible();

    dom.app?.classList.remove("running");
    ui.show(dom, "start");
  });

  dom.buttonValidateCal?.addEventListener("click", () => {
    const done = cal.validate();

    if (done) {
      ui.show(dom, "start");
    }
  });

  dom.btnClearCalibration?.addEventListener("click", () => {
    clearCalibration();

    state.mmPerPx = null;
    state.calErrorPct = null;
    state.calSamples = [];

    ui.updateHudSize(dom, state);
    ui.updateCalibrationStatus?.(state);
  });
}

/**
 * Wire touchability panel actions.
 */
function setupTouchabilityHandlers(dom, touchability) {
  dom.buttonTouchability?.addEventListener("click", async () => {
    await requestFullscreenSafe();

    touchability.open();
    ui.show(dom, "touchability");
  });

  dom.btnTouchabilityFallback?.addEventListener("click", () => {
    applyDefaultTouchability(dom);
    saveCurrentTouchability(dom, "fallback");
    alert("Standardwert für den Zeigefinger wurde verwendet.");
  });

  dom.btnTouchabilityBack?.addEventListener("click", () => {
    ui.show(dom, "start");
  });
}

/**
 * Toggle the optional session comment field.
 */
function setupCommentToggle(dom) {
  dom.btnToggleSessionComment?.addEventListener("click", () => {
    if (!dom.sessionCommentBox) return;

    const open = dom.sessionCommentBox.style.display !== "none";

    dom.sessionCommentBox.style.display = open ? "none" : "block";
    dom.btnToggleSessionComment.textContent = open ? "+ Kommentar" : "− Kommentar";
  });
}

/**
 * Wire experiment design and local protocol actions.
 */
function setupExperimentDesignHandlers(dom, sessionDesign) {
  dom.btnCreateExperimentDesign?.addEventListener("click", () => {
    hideProtocolList(dom);
    showExperimentDesignEditor(dom);
    markProtocolStatus(dom, state, false);
  });

  dom.btnLoadProtocol?.addEventListener("click", () => {
    hideExperimentDesignEditor(dom);
    showProtocolList(dom);
    renderProtocolList(dom, sessionDesign);
  });

  dom.btnMonteCarlo?.addEventListener("click", () => {
    const protocol = buildProtocolObject(dom, state, sessionDesign);

  
    const sim = runMonteCarloProtocol({
      protocol,
      state,
      n: 50000,
      histogramBins: 100,
    });
  
    renderMonteCarloSummary(dom, sim);
  
  });

  dom.btnClearProtocol?.addEventListener("click", () => {
    clearProtocol();

    state.protocolReady = false;
    state.sessionBlocks = [];
    state.currentProtocol = null;
    state.protocolName = "";
    state.protocolComment = "";

    if (dom.protocolName) dom.protocolName.value = "";
    if (dom.protocolComment) dom.protocolComment.value = "";

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
    const protocol = buildProtocolObject(dom, state, sessionDesign);
    const check = validateProtocol(protocol, state);
  
    if (!check.ok) {
      alert(check.message);
      markProtocolStatus(dom, state, false);
      return;
    }
  
    const protocolWithMonteCarlo =
      attachMonteCarloSummary(protocol, state);
  
    const mc = protocolWithMonteCarlo.monte_carlo_summary;
  
    if (
      mc?.worst_diagnostic === "strong_distortion" ||
      Number(mc?.worst_clamp_pct ?? 0) > 50
    ) {
      const ok = confirm(
        "Achtung: Das Protokoll ist stark verzerrt.\n\n" +
        `Worst Clamp: ${(mc.worst_clamp_pct ?? 0).toFixed(1)}%\n` +
        `Diagnose: ${mc.worst_diagnostic}\n\n` +
        "Das bedeutet, dass die geplante Verteilung stark durch technische Grenzen verändert wird.\n\n" +
        "Trotzdem speichern?"
      );
  
      if (!ok) {
        markProtocolStatus(dom, state, false);
        return;
      }
    }
  
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
  
    state.currentProtocol = saved;
    state.protocolName = saved.protocol_name || "";
    state.protocolComment = saved.protocol_comment || "";
  
    markProtocolStatus(dom, state, true);
  
    alert("Protokoll gespeichert.");
  });
}

/**
 * Wire experiment start/restart actions.
 */
function setupRunHandlers(dom, exp, sessionDesign) {
  dom.buttonStart?.addEventListener("click", async () => {
    const protocol = buildProtocolObject(dom, state, sessionDesign);
    const check = validateProtocol(protocol, state);

    state.sessionComment = dom.sessionComment?.value?.trim() || "";
    state.interactionsPerTrial = protocol.interactionsPerTrial;

    // Keep the exact protocol used for the run.
    // This will later be saved with the session on the backend.
    state.currentProtocol = attachMonteCarloSummary(protocol, state);
    state.protocolName = protocol.protocol_name || "";
    state.protocolComment = protocol.protocol_comment || "";

    if (!check.ok) {
      alert(check.message);
      markProtocolStatus(dom, state, false);
      return;
    }

    markProtocolStatus(dom, state, true);

    await requestFullscreenSafe();
    await lockOrientationIfPossible();

    // Wait for mobile/tablet viewport to stabilize after fullscreen/orientation change.
    await new Promise((resolve) => setTimeout(resolve, 250));

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

/**
 * Wire local CSV export and server save actions.
 */
function setupExportHandlers(dom, exp) {
  dom.btnDownload?.addEventListener("click", () => {
    exp.downloadCSV();
  });

  dom.btnSaveServer?.addEventListener("click", async () => {
    if (state.savedToPC) {
      alert("Diese Sitzung wurde bereits gespeichert.");
      return;
    }

    const btn = dom.btnSaveServer;
    if (btn) btn.disabled = true;

    try {
      const res = await server.sendResultsToPC(dom, state);

      state.savedToPC = true;
      state.savedSessionRowId = res?.session_row_id ?? null;

      if (btn) {
        btn.textContent = "✅ Gespeichert";
        btn.disabled = true;
      }

      if (dom.hudLeft) {
        dom.hudLeft.textContent = "✅ Gespeichert";
      }
    } catch (e) {
      if (btn) btn.disabled = false;
      alert("Speichern fehlgeschlagen: " + (e?.message || e));
    }
  });
}

/**
 * Show experiment design editor.
 */
function showExperimentDesignEditor(dom) {
  if (dom.experimentDesignEditor) {
    dom.experimentDesignEditor.style.display = "block";
  }

  if (dom.btnSaveProtocol) {
    dom.btnSaveProtocol.style.display = "inline-block";
  }
}

/**
 * Hide experiment design editor.
 */
function hideExperimentDesignEditor(dom) {
  if (dom.experimentDesignEditor) {
    dom.experimentDesignEditor.style.display = "none";
  }

  if (dom.btnSaveProtocol) {
    dom.btnSaveProtocol.style.display = "none";
  }
}

/**
 * Show local protocol list.
 */
function showProtocolList(dom) {
  if (dom.protocolListBox) {
    dom.protocolListBox.style.display = "block";
  }
}

/**
 * Hide local protocol list.
 */
function hideProtocolList(dom) {
  if (dom.protocolListBox) {
    dom.protocolListBox.style.display = "none";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
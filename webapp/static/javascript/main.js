// main.js
// Application bootstrap and UI wiring for the Fitts' Law experiment.
//
// Responsibilities:
// - Restore calibration from local storage if it matches the current device.
// - Manage the session-blocks configuration UI (blocks = experimental design).
// - Live-check participant/session identifiers via the backend (/check_ids).
// - Enter fullscreen + lock orientation for run/demo (mobile/tablet stability).
// - Prevent double-saving the same session to the PC (server-side DB).
//
// Note: Fullscreen enforcement + wake lock are handled centrally in ui.show().

import { state } from "./core/state.js";
import { getDom } from "./core/dom.js";
import * as ui from "./core/ui.js";
import * as server from "./core/server.js";
import {
  requestFullscreenSafe,
  lockOrientationIfPossible,
  unlockOrientationIfPossible,
} from "./core/helpers.js";
import { initCalibration } from "./modules/calibration.js";
import { initExperiment } from "./modules/experiment.js";
import {
  loadCalibration,
  isCalibrationLikelyValid,
  clearCalibration,
} from "./core/storage.js";
import * as dbg from "./debug/debug.js";

// ---------------- Session blocks: HTML template ----------------
// Renders one configurable block (Trials + shape + A/W/ID specs).
// IDs are derived from (blockIndex, fieldName) to keep DOM lookups predictable.
function blockTemplate(idx, b) {
  const id = (s) => `blk_${idx}_${s}`;

  const shapeBase = b.shape_base ?? "circle";
  const shapeMode = b.shape_mode ?? "fixed";

  return `
  <div class="sessionBlock" data-idx="${idx}">
    <div class="row">
      <div>
        <label>Trials</label>
        <input id="${id("n")}" type="number" min="1" max="5000" value="${b.n ?? 10}">
      </div>

      <div>
        <label>Zielform (Block)</label>
        <select id="${id("shape_base")}">
          <option value="circle" ${shapeBase === "circle" ? "selected" : ""}>Kreis</option>
          <option value="square" ${shapeBase === "square" ? "selected" : ""}>Quadrat</option>
          <option value="triangle" ${shapeBase === "triangle" ? "selected" : ""}>Dreieck</option>
          <option value="pentagon" ${shapeBase === "pentagon" ? "selected" : ""}>Fünfeck</option>
          <option value="hexagon" ${shapeBase === "hexagon" ? "selected" : ""}>Sechseck</option>
          <option value="octagon" ${shapeBase === "octagon" ? "selected" : ""}>Achteck</option>
          <option value="diamond" ${shapeBase === "diamond" ? "selected" : ""}>Raute</option>
          <option value="band1d_h" ${shapeBase === "band1d_h" ? "selected" : ""}>1D Band (volle Breite)</option>
          <option value="band1d_v" ${shapeBase === "band1d_v" ? "selected" : ""}>1D Band (volle Höhe)</option>
        </select>

        <label class="inline" style="margin-top:6px;">
          <input id="${id("shape_shuffle")}" type="checkbox" ${shapeMode === "shuffle" ? "checked" : ""}/>
          Shuffle in diesem Block
        </label>
        <div class="mini">Shuffle ignores 1D bands if base=band1d_*</div>
      </div>

      <div>
        <label class="inline">
          <input id="${id("dist_set")}" type="checkbox" ${b.dist_set ? "checked" : ""}/>
          A festlegen
        </label>
        <input id="${id("dist")}" type="text" value="${b.dist_entered ?? "0.50"}" placeholder="0.5 oder [0.1,0.3,0.5]">
        <div class="mini">A: number or list</div>
      </div>

      <div>
        <label class="inline">
          <input id="${id("width_set")}" type="checkbox" ${b.width_set ? "checked" : ""}/>
          W festlegen
        </label>
        <input id="${id("width")}" type="text" value="${b.width_entered ?? "0.05"}" placeholder="0.05 oder [0.03,0.05]">
        <div class="mini">W: number or list</div>
      </div>

      <div>
        <label class="inline">
          <input id="${id("id_set")}" type="checkbox" ${b.id_set ? "checked" : ""}/>
          ID festlegen
        </label>
        <input id="${id("id")}" type="text" value="${b.id_entered ?? "5"}" placeholder="5 oder [3,4,5,6]">
        <div class="mini">ID: number or list</div>
      </div>

      <button type="button" id="${id("remove")}">Entfernen</button>
    </div>
  </div>
  `;
}

function boot() {
  const dom = getDom();

  // If the app root is not available yet, retry on the next animation frame.
  // This makes boot resilient to early execution timing on some browsers.
  const startEl = document.getElementById("buttonStart");
  if (!dom.app || !startEl) {
    requestAnimationFrame(boot);
    return;
  }

  // Debug UI is opt-in only (clean defense / presentation mode by default).
  const params = new URLSearchParams(location.search);
  const allowDebugUI = params.get("debug") === "1";

  // Session configuration panel (blocks UI).
  const sessionPanel = document.getElementById("sessionConfigPanel");
  const blocksContainer = document.getElementById("blocksContainer");
  if ((!sessionPanel || !blocksContainer) && allowDebugUI) {
    dbg.log("⚠️ sessionConfigPanel/blocksContainer not found (HTML mismatch).");
  }

  // Debug toggle button exists in HTML, but is hidden unless explicitly enabled.
  const dbgBtn = document.getElementById("hudDebugBtn");
  if (dbgBtn && !allowDebugUI) {
    dbgBtn.style.display = "none";
  }

  if (dbgBtn && allowDebugUI) {
    dbgBtn.addEventListener("click", () => {
      const on = dbg.toggleDebug();
      dbgBtn.textContent = `🐞 Debug: ${on ? "ON" : "OFF"}`;
    });
  }

  // Touch-only fallback: triple-tap anywhere to toggle debug (when allowed).
  if (allowDebugUI) {
    let taps = 0;
    let tapTimer = null;
    document.addEventListener(
      "touchstart",
      () => {
        taps++;
        clearTimeout(tapTimer);
        tapTimer = setTimeout(() => (taps = 0), 350);
        if (taps >= 3) {
          taps = 0;
          const on = dbg.toggleDebug();
          if (dbgBtn) dbgBtn.textContent = `🐞 Debug: ${on ? "ON" : "OFF"}`;
        }
      },
      { passive: true }
    );
  }

  // Capture runtime errors into the debug overlay (only visible if debug is enabled).
  window.addEventListener("error", (e) => dbg.log("❌ error:", e.message));
  window.addEventListener("unhandledrejection", (e) => dbg.log("❌ promise:", String(e.reason)));

  // Initialize HUD (and keep it in sync with viewport changes).
  ui.updateHudSize(dom, state);
  window.addEventListener("resize", () => ui.updateHudSize(dom, state));

  // Restore saved calibration only if it likely matches the current device signature.
  const saved = loadCalibration();
  if (saved?.mmPerPx && isCalibrationLikelyValid(saved)) {
    state.mmPerPx = saved.mmPerPx;
    ui.updateHudSize(dom, state);
    ui.updateCalibrationStatus?.(state);
  }

  // Initialize modules (calibration + experiment runtime).
  const cal = initCalibration(dom, state, ui);
  const exp = initExperiment(dom, state, ui, server).bind();

  // ---------------- Block helpers ----------------
  function isStrict() {
    return !!dom.strictMode?.checked;
  }

  // Strict mode forbids lists (must be a single numeric value).
  function isStrictNumericValue(v) {
    const s = (v ?? "").toString().trim();
    if (!s) return false;
    if (s.startsWith("[") || s.includes(",")) return false;
    const x = Number(s);
    return Number.isFinite(x);
  }

  function sumBlockTrials(blocks) {
    const bs = blocks || state.sessionBlocks || [];
    return bs.reduce((acc, b) => acc + (Number(b.n) || 0), 0);
  }

  // trialCount is derived from the sum of block trials (single source of truth).
  function updateTrialCountFromBlocks() {
    if (!dom.trialCount) return;
    dom.trialCount.readOnly = true;
    dom.trialCount.style.opacity = "0.85";
    const total = sumBlockTrials();
    dom.trialCount.value = String(total > 0 ? total : 0);
  }

  // Read the block editor (DOM) into state.sessionBlocks.
  // This must be called before starting a run or closing the panel.
  function applyBlocksFromUI() {
    if (!blocksContainer) return;

    const nodes = blocksContainer.querySelectorAll(".sessionBlock");
    const newBlocks = [];

    for (let i = 0; i < nodes.length; i++) {
      const n = document.getElementById(`blk_${i}_n`)?.value;

      // Per-block shape configuration.
      const shape_base = document.getElementById(`blk_${i}_shape_base`)?.value ?? "circle";
      const shape_shuffle = !!document.getElementById(`blk_${i}_shape_shuffle`)?.checked;
      const shape_mode = shape_shuffle ? "shuffle" : "fixed";

      // Per-block parameter specs.
      const dist_set = document.getElementById(`blk_${i}_dist_set`)?.checked;
      const width_set = document.getElementById(`blk_${i}_width_set`)?.checked;
      const id_set = document.getElementById(`blk_${i}_id_set`)?.checked;

      const dist_entered = document.getElementById(`blk_${i}_dist`)?.value ?? "";
      const width_entered = document.getElementById(`blk_${i}_width`)?.value ?? "";
      const id_entered = document.getElementById(`blk_${i}_id`)?.value ?? "";

      newBlocks.push({
        n,
        shape_mode,
        shape_base,
        dist_set,
        dist_entered,
        width_set,
        width_entered,
        id_set,
        id_entered,
      });
    }

    state.sessionBlocks = newBlocks;
    updateTrialCountFromBlocks();
  }

  // Strict-mode validation before a run starts (alerts the operator on errors).
  function strictValidateBlocksOrAlert() {
    if (!isStrict()) return true;

    const blocks = state.sessionBlocks || [];
    if (!blocks.length) {
      alert('Strict-Modus: Bitte zuerst "Session konfigurieren" und mindestens einen Block definieren.');
      return false;
    }

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];

      const n = Number(b.n);
      if (!Number.isFinite(n) || n < 5 || n > 25) {
        alert(`Strict-Modus: Block ${i + 1} → Trials müssen zwischen 5 und 25 liegen.`);
        return false;
      }

      // A and W must be single non-negative numbers in strict mode.
      if (!isStrictNumericValue(b.dist_entered) || Number(b.dist_entered) < 0) {
        alert(`Strict-Modus: Block ${i + 1} → Abstand (A) muss eine einzelne Zahl ≥ 0 sein (keine Liste).`);
        return false;
      }
      if (!isStrictNumericValue(b.width_entered) || Number(b.width_entered) < 0) {
        alert(`Strict-Modus: Block ${i + 1} → Zielbreite (W) muss eine einzelne Zahl ≥ 0 sein (keine Liste).`);
        return false;
      }

      // ID is optional; only validate if enabled.
      if (b.id_set) {
        if (!isStrictNumericValue(b.id_entered) || Number(b.id_entered) < 0) {
          alert(`Strict-Modus: Block ${i + 1} → ID ist aktiviert, aber ungültig (einzelne Zahl ≥ 0).`);
          return false;
        }
      }
    }

    return true;
  }

  // Live-check participant/session IDs against the backend.
  // Used to warn the operator and prevent duplicate session IDs.
  async function refreshIdHints() {
    const participantHintRow = document.getElementById("participantHintRow");
    const sessionHintRow = document.getElementById("sessionHintRow");
    const participantHintText = participantHintRow?.querySelector(".hintText");
    const sessionHintText = sessionHintRow?.querySelector(".hintText");

    const pid = dom.participantId?.value?.trim() || "";
    const sid = dom.sessionId?.value?.trim() || "";

    // If both inputs are empty, hide hints and skip the request.
    if (!pid && !sid) {
      if (participantHintRow) participantHintRow.style.display = "none";
      if (sessionHintRow) sessionHintRow.style.display = "none";
      if (participantHintText) participantHintText.textContent = "";
      if (sessionHintText) sessionHintText.textContent = "";
      return;
    }

    let data = null;
    try {
      const r = await fetch(
        `/check_ids?participant_id=${encodeURIComponent(pid)}&session_id=${encodeURIComponent(sid)}`
      );
      data = await r.json();
      if (!data?.ok) return;
    } catch {
      // Network issues should not block the UI; we simply skip hints.
      return;
    }

    // Participant hint (warn if the participant already exists).
    if (participantHintRow && participantHintText) {
      if (data.participant_exists) {
        participantHintRow.style.display = "flex";
        participantHintText.textContent = " Teilnehmer existiert bereits in der Datenbank.";
      } else {
        participantHintRow.style.display = "none";
        participantHintText.textContent = "";
      }
    }

    // Session hint (error if the session already exists for this participant).
    if (sessionHintRow && sessionHintText) {
      if (data.session_exists) {
        sessionHintRow.style.display = "flex";
        sessionHintText.textContent = "Diese Versuch-ID existiert bereits für diesen Teilnehmer.";
      } else {
        sessionHintRow.style.display = "none";
        sessionHintText.textContent = "";
      }
    }

    // Prevent starting a run when the session ID is already used.
    if (dom.buttonStart) dom.buttonStart.disabled = !!data.session_exists;
    if (dom.buttonDemo) dom.buttonDemo.disabled = false;
  }

  // Close the session panel without extra prompts:
  // persist UI state to `state.sessionBlocks` and refresh hints.
  function closeSessionPanelSilently() {
    applyBlocksFromUI();
    if (sessionPanel) sessionPanel.style.display = "none";
    refreshIdHints();
  }

  // Close session panel when clicking the backdrop.
  sessionPanel?.addEventListener("mousedown", (e) => {
    if (e.target === sessionPanel) closeSessionPanelSilently();
  });

  // Close session panel when tapping the backdrop (touch).
  sessionPanel?.addEventListener(
    "touchstart",
    (e) => {
      if (e.target === sessionPanel) closeSessionPanelSilently();
    },
    { passive: true }
  );

  // Close session panel on Escape.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!sessionPanel || sessionPanel.style.display !== "flex") return;
    closeSessionPanelSilently();
  });

  // Render blocks editor into the session panel and bind per-block event handlers.
  function renderBlocks({ allowEmpty = false } = {}) {
    if (!blocksContainer) return;

    const blocks = state.sessionBlocks?.length
      ? state.sessionBlocks
      : allowEmpty
        ? []
        : [
            {
              n: 10,
              shape_mode: "fixed",
              shape_base: "circle",
              dist_set: true,
              dist_entered: "0.50",
              width_set: true,
              width_entered: "0.05",
              id_set: false,
              id_entered: "5",
            },
          ];

    state.sessionBlocks = blocks;

    // If no blocks, show an informational placeholder.
    blocksContainer.innerHTML = blocks.length
      ? blocks.map((b, i) => blockTemplate(i, b)).join("")
      : `<p class="muted" style="padding:12px 4px;">Keine Blöcke. Klicke <b>+ Block hinzufügen</b>.</p>`;

    // Disable shuffle for 1D bands to avoid ambiguous shape behavior.
    function syncShuffleDisabled(i) {
      const baseSel = document.getElementById(`blk_${i}_shape_base`);
      const shuf = document.getElementById(`blk_${i}_shape_shuffle`);
      if (!baseSel || !shuf) return;

      const isBand = baseSel.value === "band1d_h" || baseSel.value === "band1d_v";
      shuf.disabled = isBand;
      if (isBand) shuf.checked = false;
    }

    blocks.forEach((_, i) => {
      // Remove block.
      document.getElementById(`blk_${i}_remove`)?.addEventListener("click", () => {
        state.sessionBlocks.splice(i, 1);
        renderBlocks();
        updateTrialCountFromBlocks();
      });

      // Any input change should be reflected into state immediately.
      document.getElementById(`blk_${i}_n`)?.addEventListener("input", applyBlocksFromUI);

      document.getElementById(`blk_${i}_shape_base`)?.addEventListener("change", () => {
        syncShuffleDisabled(i);
        applyBlocksFromUI();
      });

      document.getElementById(`blk_${i}_shape_shuffle`)?.addEventListener("change", applyBlocksFromUI);

      document.getElementById(`blk_${i}_dist`)?.addEventListener("input", applyBlocksFromUI);
      document.getElementById(`blk_${i}_width`)?.addEventListener("input", applyBlocksFromUI);
      document.getElementById(`blk_${i}_id`)?.addEventListener("input", applyBlocksFromUI);
      document.getElementById(`blk_${i}_dist_set`)?.addEventListener("change", applyBlocksFromUI);
      document.getElementById(`blk_${i}_width_set`)?.addEventListener("change", applyBlocksFromUI);
      document.getElementById(`blk_${i}_id_set`)?.addEventListener("change", applyBlocksFromUI);

      syncShuffleDisabled(i);
    });

    updateTrialCountFromBlocks();
  }

  // Initialize derived trial count on boot.
  updateTrialCountFromBlocks();

  // Strict-mode only changes validation rules; trial count stays derived from blocks.
  dom.strictMode?.addEventListener("change", () => {
    updateTrialCountFromBlocks();
  });

  // ---------------- Live ID checks ----------------
  // Debounce requests to avoid spamming /check_ids on every keystroke.
  let hintTimer = null;
  function scheduleHintRefresh() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(refreshIdHints, 250);
  }

  dom.participantId?.addEventListener("input", scheduleHintRefresh);
  dom.sessionId?.addEventListener("input", scheduleHintRefresh);
  refreshIdHints();

  // ---------------- Buttons / flows ----------------
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
    if (done) ui.show(dom, "start");
  });

  // Remove local calibration and reset runtime state.
  dom.btnClearCalibration?.addEventListener("click", () => {
    clearCalibration();

    state.mmPerPx = null;
    state.calErrorPct = null;
    state.calSamples = [];

    ui.updateHudSize(dom, state);
    ui.updateCalibrationStatus?.(state);
  });

  // Start a normal run (uses configured blocks).
  dom.buttonStart?.addEventListener("click", async () => {
    updateTrialCountFromBlocks();
    applyBlocksFromUI();

    if (isStrict() && !strictValidateBlocksOrAlert()) return;

    await requestFullscreenSafe();
    await lockOrientationIfPossible();

    exp.startRun(false);
  });

  // Start a demo run (fixed internal configuration).
  dom.buttonDemo?.addEventListener("click", async () => {
    await requestFullscreenSafe();
    await lockOrientationIfPossible();

    exp.startDemo();
  });

  // Download client-side CSV export.
  dom.btnDownload?.addEventListener("click", () => {
    exp.downloadCSV();
  });

  // Reset UI state after a run and return to the start screen.
  dom.btnRestart?.addEventListener("click", async () => {
    exp.resetRun();
    await unlockOrientationIfPossible();
    dom.app?.classList.remove("running");
    ui.show(dom, "start");
    refreshIdHints();
  });

  // Save results to the PC/server once per session (DB enforces uniqueness too).
  dom.btnSaveServer?.addEventListener("click", async () => {
    if (state.isDemoRun) return;

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
      if (dom.hudLeft) dom.hudLeft.textContent = "✅ Gespeichert";
    } catch (e) {
      if (btn) btn.disabled = false;
      alert("Speichern fehlgeschlagen: " + (e?.message || e));
    }
  });

  // ---------------- Session panel controls ----------------
  document.getElementById("buttonSessionConfig")?.addEventListener("click", async () => {
    await requestFullscreenSafe();
    renderBlocks();
    applyBlocksFromUI();
    if (sessionPanel) sessionPanel.style.display = "flex";
  });

  document.getElementById("btnSessionBack")?.addEventListener("click", () => {
    closeSessionPanelSilently();
  });

  document.getElementById("btnAddBlock")?.addEventListener("click", () => {
    state.sessionBlocks = state.sessionBlocks || [];
    state.sessionBlocks.push({
      n: 10,
      shape_mode: "fixed",
      shape_base: "circle",
      dist_set: false,
      dist_entered: "0.50",
      width_set: false,
      width_entered: "0.05",
      id_set: false,
      id_entered: "5",
    });
    renderBlocks();
    updateTrialCountFromBlocks();
  });

  document.getElementById("btnClearBlocks")?.addEventListener("click", () => {
    state.sessionBlocks = [];
    renderBlocks({ allowEmpty: true });
    updateTrialCountFromBlocks();
  });

  document.getElementById("btnSessionApply")?.addEventListener("click", () => {
    applyBlocksFromUI();

    if (isStrict() && !strictValidateBlocksOrAlert()) return;

    updateTrialCountFromBlocks();
    if (sessionPanel) sessionPanel.style.display = "none";
  });

  // Default view on startup.
  ui.show(dom, "start");
}

// Start boot once the DOM is ready (module scripts may run before elements exist).
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
/**
 * Experiment design editor module.
 *
 * Handles the block-based protocol editor:
 * - target shape selection
 * - parameter mode selection (A/W/ID)
 * - fixed values, lists and random sampling flags
 * - required overlap configuration
 * - trial count validation
 *
 * This module only edits the protocol definition.
 * Trial generation and scientific validation are handled later.
 */

import { runMonteCarloProtocol } from "./monteCarlo.js";

function blockTemplate(idx, b) {
  const id = (s) => `blk_${idx}_${s}`;
  const shape = b.shape ?? "circle";
  const requiredOverlap = b.required_overlap ?? "1.0";

  return `
  <div class="sessionBlock" data-idx="${idx}">
    <div class="row">
      <div>
        <label>Zielform</label>
        <select id="${id("shape")}">
          <option value="circle" ${shape === "circle" ? "selected" : ""}>Kreis</option>
          <option value="square" ${shape === "square" ? "selected" : ""}>Quadrat</option>
          <option value="triangle" ${shape === "triangle" ? "selected" : ""}>Dreieck</option>
          <option value="pentagon" ${shape === "pentagon" ? "selected" : ""}>Fünfeck</option>
          <option value="hexagon" ${shape === "hexagon" ? "selected" : ""}>Sechseck</option>
          <option value="octagon" ${shape === "octagon" ? "selected" : ""}>Achteck</option>
          <option value="diamond" ${shape === "diamond" ? "selected" : ""}>Raute</option>
          <option value="shuffle" ${shape === "shuffle" ? "selected" : ""}>Zufällig / Shuffle</option>
          <option value="band1d_h" ${shape === "band1d_h" ? "selected" : ""}>1D Band horizontal</option>
          <option value="band1d_v" ${shape === "band1d_v" ? "selected" : ""}>1D Band vertikal</option>
        </select>
      </div>

      <div>
        <label>Parametermodus</label>
        <select id="${id("param_mode")}">
          <option value="A_W" ${b.param_mode === "A_W" ? "selected" : ""}>A + W</option>
          <option value="ID_W" ${b.param_mode === "ID_W" ? "selected" : ""}>ID + W</option>
          <option value="ID_A" ${b.param_mode === "ID_A" ? "selected" : ""}>ID + A</option>
        </select>
      </div>

      <div>
        <label class="fieldLabel">
          <span>A</span>
        
          <button
            type="button"
            id="${id("random_A")}"
            class="randomToggle"
            data-active="${b.random_A ? "1" : "0"}"
            title="Random A">
          </button>
        </label>
        <input id="${id("dist")}" type="text" value="${b.dist_entered ?? "0.50"}" placeholder="0.5 oder [0.1,0.3,0.5]"> 
      </div>
      
      <div>
        <label class="fieldLabel">
          <span>W</span>
        
          <button
            type="button"
            id="${id("random_W")}"
            class="randomToggle"
            data-active="${b.random_W ? "1" : "0"}"
            title="Random W">
          </button>
        </label>
        <input id="${id("width")}" type="text" value="${b.width_entered ?? "0.05"}" placeholder="0.05 oder [0.03,0.05]">  
      </div>
      
      <div>
        <label class="fieldLabel">
          <span>ID</span>
        
          <button
            type="button"
            id="${id("random_ID")}"
            class="randomToggle"
            data-active="${b.random_ID ? "1" : "0"}"
            title="Random ID">
          </button>
        </label>
        <input id="${id("id")}" type="text" value="${b.id_entered ?? "5"}" placeholder="5 oder [3,4,5,6]">
        
      </div>

      <div>
        <label>Required Overlap</label>
        <input id="${id("required_overlap")}" type="number" min="0" max="1" step="0.05" value="${requiredOverlap}">
      </div>

      <button type="button" id="${id("remove")}">Entfernen</button>
    </div>
  </div>
  `;
}

function defaultBlock() {
  return {
    shape: "circle",
    param_mode: "A_W",

    dist_entered: "0.50",
    width_entered: "0.05",
    id_entered: "5",

    random_A: false,
    random_W: false,
    random_ID: false,

    required_overlap: "1.0",
  };
}

export function initSessionDesign(dom, state) {
  const sessionPanel = document.getElementById("sessionConfigPanel");
  const blocksContainer = document.getElementById("blocksContainer");

  function updateTrialCount() {
    if (!dom.trialCount) return;

    let n = Number(dom.trialCount.value) || 10;
    if (n < 5) n = 5;
    if (n > 25) n = 25;

    dom.trialCount.value = String(n);
  }

  function applyBlocksFromUI() {
    if (!blocksContainer) return;

    const nodes = blocksContainer.querySelectorAll(".sessionBlock");
    const newBlocks = [];

    for (let i = 0; i < nodes.length; i++) {
      newBlocks.push({
        shape: document.getElementById(`blk_${i}_shape`)?.value ?? "circle",
        param_mode: document.getElementById(`blk_${i}_param_mode`)?.value ?? "A_W",
      
        dist_entered: document.getElementById(`blk_${i}_dist`)?.value ?? "",
        width_entered: document.getElementById(`blk_${i}_width`)?.value ?? "",
        id_entered: document.getElementById(`blk_${i}_id`)?.value ?? "",
      
        random_A: document.getElementById(`blk_${i}_random_A`)?.dataset.active === "1",
        random_W: document.getElementById(`blk_${i}_random_W`)?.dataset.active === "1",
        random_ID: document.getElementById(`blk_${i}_random_ID`)?.dataset.active === "1",
      
        required_overlap:
          document.getElementById(`blk_${i}_required_overlap`)?.value ?? "1.0",
      });
    }

    state.sessionBlocks = newBlocks;
    updateTrialCount();
  }
  

  function isListInput(value) {
    const raw = (value ?? "").toString().trim();
    return raw.startsWith("[") && raw.endsWith("]");
  }
  
  function setRandomButtonState(btn, enabled, active) {
    if (!btn) return;
  
    btn.disabled = !enabled;
    btn.dataset.active = enabled && active ? "1" : "0";
  }
  
  function updateBlockFieldState(i) {
    const mode = document.getElementById(`blk_${i}_param_mode`)?.value ?? "A_W";
  
    const fields = {
      A: document.getElementById(`blk_${i}_dist`),
      W: document.getElementById(`blk_${i}_width`),
      ID: document.getElementById(`blk_${i}_id`),
    };
  
    const buttons = {
      A: document.getElementById(`blk_${i}_random_A`),
      W: document.getElementById(`blk_${i}_random_W`),
      ID: document.getElementById(`blk_${i}_random_ID`),
    };
  
    const activeByMode = {
      A_W: ["A", "W"],
      ID_W: ["ID", "W"],
      ID_A: ["ID", "A"],
    };
  
    const enabledFields = activeByMode[mode] ?? ["A", "W"];
  
    for (const key of ["A", "W", "ID"]) {
      const input = fields[key];
      const btn = buttons[key];
  
      const fieldEnabled = enabledFields.includes(key);
      const hasList = isListInput(input?.value);
  
      if (input) {
        input.disabled = !fieldEnabled;
        input.style.opacity = fieldEnabled ? "1" : "0.45";
        input.style.backgroundColor = fieldEnabled ? "" : "#e5e7eb";
        input.style.cursor = fieldEnabled ? "" : "not-allowed";
      }
  
      const randomEnabled = fieldEnabled && !hasList;
      const randomActive = btn?.dataset.active === "1";
  
      setRandomButtonState(btn, randomEnabled, randomActive);
    }
  }

  function renderBlocks({ allowEmpty = false } = {}) {
    if (!blocksContainer) return;

    const blocks = state.sessionBlocks?.length
      ? state.sessionBlocks
      : allowEmpty
        ? []
        : [defaultBlock()];

    state.sessionBlocks = blocks;

    blocksContainer.innerHTML = blocks.length
      ? blocks.map((b, i) => blockTemplate(i, b)).join("")
      : `<p class="muted" style="padding:12px 4px;">Keine Blöcke. Klicke <b>+ Block hinzufügen</b>.</p>`;

    blocks.forEach((_, i) => {
      document.getElementById(`blk_${i}_remove`)?.addEventListener("click", () => {
        state.sessionBlocks.splice(i, 1);
        renderBlocks({ allowEmpty: true });
        updateTrialCount();
      });
    
      [
        "shape",
        "param_mode",
        "dist",
        "width",
        "id",
        "required_overlap",
        "random_A",
        "random_W",
        "random_ID",
      ].forEach((field) => {
        const el = document.getElementById(`blk_${i}_${field}`);
    
        el?.addEventListener("input", () => {
          applyBlocksFromUI();
          updateBlockFieldState(i);
        });
    
        el?.addEventListener("change", () => {
          applyBlocksFromUI();
          updateBlockFieldState(i);
        });

        el?.addEventListener("click", () => {
          if (!field.startsWith("random_")) return;
          if (el.disabled) return;
      
          el.dataset.active = el.dataset.active === "1" ? "0" : "1";
      
          applyBlocksFromUI();
          updateBlockFieldState(i);
        });
      });
    
      updateBlockFieldState(i);
    });

    updateTrialCount();
  }

  function open() {
    renderBlocks();
    applyBlocksFromUI();
    if (sessionPanel) sessionPanel.style.display = "flex";
  }

  function checkWClampBeforeApply() {
    applyBlocksFromUI();
  
    const protocol = {
      distanceMode: document.getElementById("distanceMode")?.value ?? "relative",
      a_sampling: document.getElementById("aSampling")?.value ?? "uniform",
      w_sampling: document.getElementById("wSampling")?.value ?? "uniform",
      id_sampling: document.getElementById("idSampling")?.value ?? "uniform",
      sessionBlocks: state.sessionBlocks ?? [],
    };
  
    const sim = runMonteCarloProtocol({
      protocol,
      state,
      n: 1000,
      histogramBins: 50,
    });
  
    const warnings = sim.meta?.warnings ?? [];
  
    if (!warnings.length) {
      return true;
    }
  
    const message =
      "Monte-Carlo-Warnung:\n\n" +
      warnings
        .map((w) => `Block ${w.block_no}: ${w.message}`)
        .join("\n\n") +
      "\n\nTrotzdem übernehmen?";
  
    return confirm(message);
  }

  function close() {
    applyBlocksFromUI();
    if (sessionPanel) sessionPanel.style.display = "none";
  }

  function addBlock() {
    state.sessionBlocks = state.sessionBlocks || [];
    state.sessionBlocks.push(defaultBlock());
    renderBlocks();
    updateTrialCount();
  }

  function clearBlocks() {
    state.sessionBlocks = [];
    renderBlocks({ allowEmpty: true });
    updateTrialCount();
  }

  sessionPanel?.addEventListener("mousedown", (e) => {
    if (e.target === sessionPanel) close();
  });

  sessionPanel?.addEventListener(
    "touchstart",
    (e) => {
      if (e.target === sessionPanel) close();
    },
    { passive: true }
  );

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!sessionPanel || sessionPanel.style.display !== "flex") return;
    close();
  });

  document.getElementById("btnSessionBack")?.addEventListener("click", close);
  document.getElementById("btnSessionApply")?.addEventListener("click", () => {
    const ok = checkWClampBeforeApply();
    if (!ok) return;
    close();
  });
  document.getElementById("btnAddBlock")?.addEventListener("click", addBlock);
  document.getElementById("btnClearBlocks")?.addEventListener("click", clearBlocks);

  dom.trialCount?.addEventListener("input", updateTrialCount);

  updateTrialCount();

  return {
    open,
    close,
    renderBlocks,
    applyBlocksFromUI,
    updateTrialCount,
  };
}
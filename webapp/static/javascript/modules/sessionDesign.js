/**
 * Experiment design editor orchestrator.
 *
 * Organigram reference:
 * - Experiment Design
 *   → Session Block Editor
 *   → Protocol Drafting
 *
 * Responsibility:
 * Coordinates the block-based protocol editor UI.
 *
 * This module connects smaller helpers responsible for:
 * - rendering one block template
 * - reading block values from the DOM
 * - enabling/disabling fields depending on parameter mode
 * - warning about Monte Carlo constraint distortion
 *
 * Important:
 * This module edits the protocol definition only.
 * It does not generate runtime trials or validate final experiment results.
 *
 * Extension guide:
 * - To change block HTML: edit sessionBlockTemplate.js.
 * - To change block DOM reading or field activation: edit sessionBlockState.js.
 * - To change Monte Carlo warnings: edit sessionWarnings.js.
 */

import {
  blockTemplate,
} from "./sessionDesign/sessionBlockTemplate.js";

import {
  defaultBlock,
  readBlockFromDOM,
  updateBlockFieldState,
} from "./sessionDesign/sessionBlockState.js";

import {
  confirmMonteCarloWarnings,
} from "./sessionDesign/sessionWarnings.js";


import { loadAdminSettings } from "../core/adminSettings.js";




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
      newBlocks.push(readBlockFromDOM(i));
    }

    state.sessionBlocks = newBlocks;
    updateTrialCount();
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
  
    return confirmMonteCarloWarnings({
      state,
      distanceMode: dom.distanceMode?.value ?? "relative",
      aSampling: dom.aSampling?.value ?? "uniform",
      wSampling: dom.wSampling?.value ?? "uniform",
      idSampling: dom.idSampling?.value ?? "uniform",
    });
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
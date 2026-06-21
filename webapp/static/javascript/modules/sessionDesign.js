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

// TODO: Remove this import if admin settings are not needed in this module.
// import { loadAdminSettings } from "../core/adminSettings.js";

/**
 * Initialize the block-based experiment/session design editor.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing sessionBlocks and protocol data.
 *
 * Returns:
 *   Object exposing editor control functions:
 *   - open()
 *   - close()
 *   - renderBlocks()
 *   - applyBlocksFromUI()
 *   - updateTrialCount()
 *
 * Side effects:
 *   Registers event listeners for the session design panel, block controls,
 *   apply/back buttons, add/clear buttons and trial count input.
 *
 * Responsibility:
 *   Connects the session block UI with state.sessionBlocks.
 *
 * Important:
 *   This module edits protocol/session design data only. Runtime trial
 *   generation happens later in the experiment engine.
 */
export function initSessionDesign(dom, state) {
  // Main session configuration overlay/panel.
  const sessionPanel = document.getElementById("sessionConfigPanel");

  // Container that receives one HTML block editor per session block.
  const blocksContainer = document.getElementById("blocksContainer");

  /**
   * Clamp and normalize the global trial count field.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Updates dom.trialCount.value.
   *
   * Behavior:
   *   The trial count is constrained to the range [5, 25].
   */
  function updateTrialCount() {
    if (!dom.trialCount) return;

    let n = Number(dom.trialCount.value) || 10;
    if (n < 5) n = 5;
    if (n > 25) n = 25;

    dom.trialCount.value = String(n);
  }

  /**
   * Read all session block editors from the DOM into state.sessionBlocks.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Updates state.sessionBlocks and normalizes the trial count field.
   *
   * Behavior:
   *   Each visible .sessionBlock element is read through readBlockFromDOM().
   */
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

  /**
   * Render the current session blocks into the editor panel.
   *
   * Args:
   *   allowEmpty: Whether the editor may show zero blocks instead of inserting
   *     a default block automatically.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Replaces blocksContainer.innerHTML, registers per-block event listeners,
   *   updates field activation states and normalizes trial count.
   *
   * Behavior:
   *   - If blocks already exist in state, they are rendered.
   *   - If no blocks exist and allowEmpty=false, one default block is inserted.
   *   - If no blocks exist and allowEmpty=true, an empty-state message is shown.
   */
  function renderBlocks({ allowEmpty = false } = {}) {
    if (!blocksContainer) return;

    const blocks = state.sessionBlocks?.length
      ? state.sessionBlocks
      : allowEmpty
        ? []
        : [defaultBlock()];

    state.sessionBlocks = blocks;

    // Render all blocks as HTML, or show an empty-state message.
    blocksContainer.innerHTML = blocks.length
      ? blocks.map((b, i) => blockTemplate(i, b)).join("")
      : `<p class="muted" style="padding:12px 4px;">Keine Blöcke. Klicke <b>+ Block hinzufügen</b>.</p>`;

    // Register event listeners for each rendered block.
    blocks.forEach((_, i) => {
      // Remove one block and re-render the editor.
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

        // Input events update the state immediately while the user edits values.
        el?.addEventListener("input", () => {
          applyBlocksFromUI();
          updateBlockFieldState(i);
        });

        // Change events are needed for selects and checkbox-like controls.
        el?.addEventListener("change", () => {
          applyBlocksFromUI();
          updateBlockFieldState(i);
        });

        // Random toggles use data-active instead of a native checkbox state.
        // This allows custom button-like UI behavior.
        el?.addEventListener("click", () => {
          if (!field.startsWith("random_")) return;
          if (el.disabled) return;

          el.dataset.active = el.dataset.active === "1" ? "0" : "1";

          applyBlocksFromUI();
          updateBlockFieldState(i);
        });
      });

      // Apply initial enabled/disabled state for mode-dependent fields.
      updateBlockFieldState(i);
    });

    updateTrialCount();
  }

  /**
   * Open the session design panel.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Renders blocks, applies current DOM values to state and shows the panel.
   */
  function open() {
    renderBlocks();
    applyBlocksFromUI();

    if (sessionPanel) {
      sessionPanel.style.display = "flex";
    }
  }

  /**
   * Run Monte Carlo warning checks before accepting the current block design.
   *
   * Returns:
   *   true if the design can be applied, false if the user cancels after a
   *   warning.
   *
   * Side effects:
   *   Reads the current block UI into state.sessionBlocks and may show a warning
   *   confirmation dialog.
   *
   * Behavior:
   *   The current unit mode and sampling modes are passed to
   *   confirmMonteCarloWarnings().
   */
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

  /**
   * Close the session design panel.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Applies current block UI values to state and hides the panel.
   */
  function close() {
    applyBlocksFromUI();

    if (sessionPanel) {
      sessionPanel.style.display = "none";
    }
  }

  /**
   * Add a new default block to the session design.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Updates state.sessionBlocks, re-renders the block editor and normalizes
   *   trial count.
   */
  function addBlock() {
    state.sessionBlocks = state.sessionBlocks || [];
    state.sessionBlocks.push(defaultBlock());
    renderBlocks();
    updateTrialCount();
  }

  /**
   * Remove all blocks from the session design.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Clears state.sessionBlocks, re-renders the editor with an empty-state
   *   message and normalizes trial count.
   */
  function clearBlocks() {
    state.sessionBlocks = [];
    renderBlocks({ allowEmpty: true });
    updateTrialCount();
  }

  // Close the panel when the user clicks the overlay background.
  sessionPanel?.addEventListener("mousedown", (e) => {
    if (e.target === sessionPanel) close();
  });

  // Close the panel on touch background interaction as well.
  sessionPanel?.addEventListener(
    "touchstart",
    (e) => {
      if (e.target === sessionPanel) close();
    },
    { passive: true }
  );

  // Close the panel with Escape while it is visible.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!sessionPanel || sessionPanel.style.display !== "flex") return;
    close();
  });

  // Main panel action buttons.
  document.getElementById("btnSessionBack")?.addEventListener("click", close);

  document.getElementById("btnSessionApply")?.addEventListener("click", () => {
    const ok = checkWClampBeforeApply();
    if (!ok) return;
    close();
  });

  document.getElementById("btnAddBlock")?.addEventListener("click", addBlock);
  document.getElementById("btnClearBlocks")?.addEventListener("click", clearBlocks);

  // Keep trial count within the supported range while editing.
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
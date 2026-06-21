/**
 * Experiment runtime orchestrator.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Runtime Orchestrator
 *   → Trial Generator
 *   → Trial Preparation
 *   → Trial Pair Engine
 *   → Result Collection
 *
 * Responsibility:
 * Coordinates the complete experiment run.
 *
 * This module intentionally acts as an orchestrator:
 * it connects smaller LEGO-style modules responsible for:
 * - building trial lists
 * - preparing trial parameters
 * - placing targets
 * - creating runtime trial context
 * - managing the trial pair engine
 * - collecting result rows
 * - rendering the final summary
 * - exporting local CSV data
 *
 * Important:
 * This file should not contain detailed algorithms.
 * Detailed logic belongs in the specialized modules inside:
 *
 *   modules/experiment/
 *
 * Extension guide:
 * - To change trial-list generation: edit experimentTrials.js.
 * - To change target-shape selection: edit experimentTargets.js.
 * - To change trial preparation: edit experimentTrialPreparation.js.
 * - To change target placement: edit experimentTrialPlacement.js.
 * - To change current trial metadata: edit experimentTrialContext.js.
 * - To change final result rows: edit experimentResultRows.js.
 * - To change run reset/timeout behavior: edit experimentRuntime.js.
 * - To change local CSV export: edit experimentExport.js.
 * - To change final summary rendering: edit experimentSummary.js.
 */

import {
  deriveSessionTargetMode,
  getSafeTargetRadiusPx,
} from "./experiment/experimentTargets.js";

import {
  clearTimeoutIfNeeded,
  resetRun as resetRunState,
  setTrialTimeout as setTrialTimeoutState,
} from "./experiment/experimentRuntime.js";

import {
  downloadExperimentCSV,
} from "./experiment/experimentExport.js";

import {
  renderExperimentSummary,
} from "./experiment/experimentSummary.js";

import {
  buildTrialSummaryRow,
} from "./experiment/experimentResultRows.js";

import {
  buildExperimentTrials,
} from "./experiment/experimentTrials.js";

import {
  computeNextTargetPosition,
} from "./experiment/experimentTrialPlacement.js";

import {
  buildCurrentTrialContext,
} from "./experiment/experimentTrialContext.js";

import {
  prepareTrial,
} from "./experiment/experimentTrialPreparation.js";

import {
  computeID,
} from "../core/helpers.js";

import {
  getMinAmplitudePx,
} from "./experimentConstraints.js";

import { getDeviceContext } from "../core/device.js";
import { TargetFactory } from "../targets/TargetFactory.js";
import { TargetDebugOverlay } from "../targets/TargetDebugOverlay.js";
import { createTrialPairEngine } from "./trialPairEngine.js";

/**
 * Initialize the experiment runtime orchestrator.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   ui: Core UI helper module, expected to provide show().
 *   server: Backend communication layer. Currently passed for orchestration
 *     compatibility, but not used directly in this module.
 *
 * Returns:
 *   Object containing bind(), which registers runtime event handlers and
 *   returns the public experiment runtime API.
 *
 * Side effects:
 *   Creates the target debug overlay controller and prepares runtime closures.
 *
 * Responsibility:
 *   Coordinates trial generation, target placement, pair-trial execution,
 *   result collection, summary rendering and CSV export.
 */
export function initExperiment(dom, state, ui, server) {
  // Debug overlay controller used only when targetDebug=1 is present in the URL.
  const targetDebugOverlay = new TargetDebugOverlay();

  // URL flag for visualizing target geometry during development.
  const showTargetDebug =
    new URLSearchParams(location.search).get("targetDebug") === "1";

  // Pair engine is created when a run starts because it depends on the current
  // runtime callbacks and state.
  let pairEngine = null;

  /**
   * Create or reuse a DOM target element.
   *
   * Args:
   *   id: DOM id for the target element.
   *
   * Returns:
   *   Existing or newly created target DOM element.
   *
   * Side effects:
   *   May create a div, assign id/className and append it to dom.app.
   *
   * Purpose:
   *   The pair engine needs two runtime target elements, usually targetA and
   *   targetB.
   */
  function createTargetElement(id) {
    let el = document.getElementById(id);

    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.className = "dynamicTarget";
      dom.app?.appendChild(el);
    }

    return el;
  }

  /**
   * Reset runtime state before starting a new run or after abort/restart.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Delegates runtime cleanup to experimentRuntime.js.
   *
   * Cleared data:
   *   - timers
   *   - active pair targets
   *   - debug overlay
   *   - runtime result state
   */
  function resetRun() {
    resetRunState({
      dom,
      state,
      pairEngine,
      targetDebugOverlay,
    });
  }

  /**
   * Build the full trial list from all session blocks.
   *
   * Returns:
   *   Array of trial definitions, or null if trial generation fails.
   *
   * Side effects:
   *   May show German alert messages for invalid setup states.
   *
   * Behavior:
   *   - Reads the current distance unit from the UI.
   *   - Prevents mm mode without calibration.
   *   - Delegates trial-list construction to buildExperimentTrials().
   */
  function buildTrials() {
    const unit =
      dom.distanceMode?.value || "relative";

    if (unit === "mm" && !state.mmPerPx) {
      alert(
        "Einheit mm gewählt, aber nicht kalibriert. Bitte kalibrieren oder px/rel wählen."
      );
      return null;
    }

    const result =
      buildExperimentTrials({
        blocks: state.sessionBlocks,
        protocol: state.currentProtocol,
        unit,
        formula: "shannon",
      });

    if (!result.ok) {
      alert(result.message);
      return null;
    }

    return result.trials;
  }

  /**
   * Start a trial timeout if configured.
   *
   * Args:
   *   ms: Timeout duration in milliseconds.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Delegates timeout registration to experimentRuntime.js.
   *
   * Behavior:
   *   When the timeout fires, the current trial receives a "timeout" error.
   */
  function setTrialTimeout(ms) {
    setTrialTimeoutState({
      state,
      timeoutMs: ms,
      onTimeout: () => markError("timeout"),
    });
  }

  /**
   * Register one trial error.
   *
   * Args:
   *   reason: Error reason string, for example "miss", "wrong_target" or
   *     "timeout".
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Updates current-trial error counters and global error count.
   */
  function markError(reason) {
    if (!state.current) return;

    state.current.errors += 1;
    state.current.error_reasons.push(reason);
    state.errorCount += 1;
  }

  /**
   * Start the next trial or finish the run.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Clears timeout, may clear target pair, prepares trial geometry, creates
   *   targets, starts the pair engine, updates HUD and starts timeout.
   *
   * Workflow:
   *   1. Stop any previous trial timeout.
   *   2. Finish the run if no trials remain.
   *   3. Prepare trial parameters.
   *   4. Compute safe placement and target geometry.
   *   5. Build runtime trial context.
   *   6. Start the two-target pair trial.
   */
  function nextTrial() {
    clearTimeoutIfNeeded(state);

    if (state.trialIndex + 1 >= state.trials.length) {
      finishRun();
      return;
    }

    pairEngine?.clearPair?.();

    state.trialIndex++;

    const t = state.trials[state.trialIndex];

    const prepared =
      prepareTrial({
        trial: t,
        state,
      });

    const {
      resolved,
      paramMode,

      A_in,
      W_in,
      ID_in,

      Wpx,

      viewportW,
      viewportH,

      trialShape,

      requiredOverlap,
      touchDiameterPx,
    } = prepared;

    let Apx = prepared.Apx;

    // The previous target is either the last trial position or the screen center
    // for the first trial.
    const prev = state.current
      ? { x: state.current.x, y: state.current.y }
      : { x: viewportW / 2, y: viewportH / 2 };

    // Conservative radius used by placement to keep the target safely inside
    // the viewport and avoid overlap.
    const safeRadiusPx =
      getSafeTargetRadiusPx(trialShape, Wpx);

    const prevRadiusPx = safeRadiusPx;

    // Ensure that amplitude is large enough to avoid target overlap.
    const minApx = getMinAmplitudePx({
      shape: trialShape,
      targetSizePx: Wpx,
    });

    Apx = Math.max(Apx, minApx);

    // Compute the next target center under viewport and overlap constraints.
    const next =
      computeNextTargetPosition({
        trialShape,
        prev,
        Apx,
        minApx,
        Wpx,
        safeRadiusPx,
        prevRadiusPx,
        viewportW,
        viewportH,
      });

    // Actual planned amplitude after placement. This may differ from the raw
    // requested Apx when placement constraints modified the geometry.
    const ApxPlannedActual = Math.hypot(
      next.x - prev.x,
      next.y - prev.y
    );

    const Amm = state.mmPerPx
      ? ApxPlannedActual * state.mmPerPx
      : t.unit === "mm"
        ? A_in
        : null;

    const Wmm = state.mmPerPx
      ? Wpx * state.mmPerPx
      : t.unit === "mm"
        ? W_in
        : null;

    const ID_planned =
      Number.isFinite(Amm) &&
      Number.isFinite(Wmm)
        ? computeID(Amm, Wmm, "shannon")
        : null;

    // Create both target instances from the safe, resolved geometry.
    const targetA = TargetFactory.create({
      shape: trialShape,
      x: prev.x,
      y: prev.y,
      sizePx: Wpx,
      touchDiameterPx,
      requiredOverlap,
    });

    const targetB = TargetFactory.create({
      shape: trialShape,
      x: next.x,
      y: next.y,
      sizePx: Wpx,
      touchDiameterPx,
      requiredOverlap,
    });

    // Width of the active target measured along the planned movement axis.
    const plannedAxisWidth =
      targetB.getWidthOnMovementAxis(
        prev.x,
        prev.y,
        next.x,
        next.y
      );

    if (showTargetDebug) {
      targetDebugOverlay.drawABCD({
        a: { x: prev.x, y: prev.y },
        b: { x: next.x, y: next.y },
        c: plannedAxisWidth.c,
        d: plannedAxisWidth.d,
      });
    }

    // Build the base metadata that will be reused for interaction-level result
    // rows and the trial summary row.
    const currentBase =
      buildCurrentTrialContext({
        dom,
        state,

        trial: t,
        trialShape,

        paramMode,

        A_in,
        W_in,
        ID_in,

        ApxPlannedActual,
        Wpx,

        Amm,
        Wmm,

        ID_planned,

        plannedAxisWidth,

        prev,
        next,

        touchDiameterPx,
        requiredOverlap,
      });

    state.current = {
      ...currentBase,
      targetObj: targetB,
      errors: 0,
      error_reasons: [],
      clicks_before_hit: 0,
    };

    // Start the alternating target-pair engine for this trial.
    pairEngine.startPairTrial({
      trial: t,
      targetA,
      targetB,
      plannedAxisWidth,
      resolved,
      prev,
      next,
      currentBase,
    });

    if (dom.crosshair) {
      dom.crosshair.style.display = "block";
    }

    if (dom.hudLeft) {
      const idTxt = Number.isFinite(ID_planned)
        ? ID_planned.toFixed(2)
        : "—";

      dom.hudLeft.textContent =
        `Versuch ${t.trial_no} / ${state.trials.length} • ID ${idTxt}`;
    }

    const timeoutMs =
      Number(dom.timeoutMs?.value) || 0;

    setTrialTimeout(timeoutMs);
  }

  /**
   * Finish the experiment run and show the final summary.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Clears timeout and targets, resets run UI state, renders summary, prepares
   *   backend-save button and switches to the end screen.
   *
   * Important:
   *   state.savedToPC is reset here so the completed session can be saved once
   *   after the run ends.
   */
  function finishRun() {
    clearTimeoutIfNeeded(state);

    pairEngine?.clearPair?.();

    if (dom.crosshair) dom.crosshair.style.display = "none";
    if (dom.hudLeft) dom.hudLeft.textContent = "Fertig";

    dom.app?.classList.remove("running");

    if (dom.btnSaveServer) {
      dom.btnSaveServer.style.display = "inline-block";
    }

    renderExperimentSummary({ state });

    if (!showTargetDebug) {
      targetDebugOverlay.clear();
    }

    state.savedToPC = false;
    state.savedSessionRowId = null;

    if (dom.btnSaveServer) {
      dom.btnSaveServer.disabled = false;
      dom.btnSaveServer.textContent =
        "Auf Server speichern";
    }

    ui.show(dom, "end");
  }

  /**
   * Move the crosshair with the pointer.
   *
   * Args:
   *   e: Mouse or touch event.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Updates crosshair left/top position.
   *
   * Purpose:
   *   Gives visual feedback for the current pointer/touch location during the
   *   experiment run.
   */
  function onPointerMove(e) {
    if (!dom.crosshair) return;

    const p = e.touches ? e.touches[0] : e;

    dom.crosshair.style.left = `${p.clientX}px`;
    dom.crosshair.style.top = `${p.clientY}px`;
  }

  /**
   * Forward pointer events to the pair engine.
   *
   * Args:
   *   e: Mouse or touch start event.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Delegates hit validation and interaction recording to trialPairEngine.js.
   */
  function onPointerDown(e) {
    pairEngine?.handlePointerDown(e);
  }

  /**
   * Download locally collected results as CSV.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Delegates CSV creation and download to experimentExport.js.
   */
  function downloadCSV() {
    downloadExperimentCSV({
      dom,
      state,
    });
  }

  /**
   * Start a full experiment run.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Resets previous runtime state, creates the pair engine, builds trials,
   *   updates UI state and starts the first trial.
   *
   * Workflow:
   *   1. Reset old run state.
   *   2. Derive session target mode from blocks.
   *   3. Switch UI to run mode.
   *   4. Create the pair engine with callbacks.
   *   5. Build trials.
   *   6. Start the first trial.
   */
  function startRun() {
    resetRun();

    state.isDemoRun = false;

    state.session_target_mode =
      deriveSessionTargetMode(
        state.sessionBlocks || []
      );

    dom.app?.classList.add("running");

    ui.show(dom, "run");

    pairEngine = createTrialPairEngine({
      dom,
      state,
      getDeviceContext,
      createTargetElement,
      targetDebugOverlay: showTargetDebug ? targetDebugOverlay : null,
      onError: markError,

      // Called by the pair engine after all interactions for one trial are done.
      onTrialFinished: ({ trialRows, summary }) => {
        const last =
          trialRows[trialRows.length - 1];

        // Store all interaction-level rows.
        state.results.push(...trialRows);

        // Store one additional trial-level summary row.
        state.results.push(
          buildTrialSummaryRow({
            lastInteractionRow: last,
            summary,
            current: state.current,
          })
        );

        nextTrial();
      },
    });

    const built = buildTrials();

    if (!built) {
      dom.app?.classList.remove("running");
      ui.show(dom, "start");
      return;
    }

    state.trials = built;

    if (dom.hudLeft) {
      dom.hudLeft.textContent =
        `Versuch 0 / ${state.trials.length}`;
    }

    nextTrial();
  }

  /**
   * Bind runtime input handlers.
   *
   * Returns:
   *   Public experiment runtime API:
   *   - startRun()
   *   - resetRun()
   *   - downloadCSV()
   *
   * Side effects:
   *   Registers mouse/touch listeners on dom.app and a document-level touchend
   *   listener to reduce accidental double-tap behavior.
   *
   * Important:
   *   The returned API is used by external handler modules such as runHandlers.js
   *   and exportHandlers.js.
   */
  function bind() {
    dom.app?.addEventListener(
      "mousemove",
      onPointerMove,
      { passive: false }
    );

    dom.app?.addEventListener(
      "touchmove",
      onPointerMove,
      { passive: false }
    );

    dom.app?.addEventListener(
      "mousedown",
      onPointerDown,
      { passive: false }
    );

    dom.app?.addEventListener(
      "touchstart",
      onPointerDown,
      { passive: false }
    );

    // Prevent accidental double-tap zoom on touch devices.
    let lastTouchEnd = 0;

    document.addEventListener(
      "touchend",
      (event) => {
        const t = Date.now();

        if (t - lastTouchEnd <= 300) {
          event.preventDefault();
        }

        lastTouchEnd = t;
      },
      { passive: false }
    );

    return {
      startRun,
      resetRun,
      downloadCSV,
    };
  }

  return { bind };
}
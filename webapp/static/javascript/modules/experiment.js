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



export function initExperiment(dom, state, ui, server) {
  const targetDebugOverlay = new TargetDebugOverlay();

  const showTargetDebug =
    new URLSearchParams(location.search).get("targetDebug") === "1";

  let pairEngine = null;

  /**
   * Create or reuse a DOM target element.
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
   * Reset runtime state before starting a new run.
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
   * Start trial timeout if configured.
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
   */
  function markError(reason) {
    if (!state.current) return;

    state.current.errors += 1;
    state.current.error_reasons.push(reason);
    state.errorCount += 1;
  }

  /**
   * Start the next trial or finish the run.
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
  
    const prev = state.current
      ? { x: state.current.x, y: state.current.y }
      : { x: viewportW / 2, y: viewportH / 2 };
  
    const safeRadiusPx =
      getSafeTargetRadiusPx(trialShape, Wpx);
  
    const prevRadiusPx = safeRadiusPx;
  
    const minApx = getMinAmplitudePx({
      shape: trialShape,
      targetSizePx: Wpx,
    });
  
    Apx = Math.max(Apx, minApx);
  
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
   * Finish the experiment run and show summary.
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
   */
  function onPointerMove(e) {
    if (!dom.crosshair) return;

    const p = e.touches ? e.touches[0] : e;

    dom.crosshair.style.left = `${p.clientX}px`;
    dom.crosshair.style.top = `${p.clientY}px`;
  }

  /**
   * Forward pointer events to the pair engine.
   */
  function onPointerDown(e) {
    pairEngine?.handlePointerDown(e);
  }

  /**
   * Download locally collected results as CSV.
   */
  function downloadCSV() {
    downloadExperimentCSV({
      dom,
      state,
    });
  }

  /**
   * Start a full experiment run.
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

      onTrialFinished: ({ trialRows, summary }) => {
        const last =
          trialRows[trialRows.length - 1];

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
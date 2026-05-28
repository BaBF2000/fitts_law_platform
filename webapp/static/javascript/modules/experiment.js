import {
  clamp,
  computeID,
  placeTarget,
  toCSV,
  parseNumberOrList,
  getViewportSize,
} from "../core/helpers.js";

import {
  clampTargetSizePx,
  getMinAmplitudePx,
} from "./experimentConstraints.js";

import { resolveTrialParameters } from "./trialParameters.js";
import { getDeviceContext } from "../core/device.js";
import { TargetFactory } from "../targets/TargetFactory.js";

import {
  DEFAULT_TOUCH_DIAMETER_PX,
  DEFAULT_REQUIRED_OVERLAP,
} from "../core/constants.js";

import { TargetDebugOverlay } from "../targets/TargetDebugOverlay.js";
import { createTrialPairEngine } from "./trialPairEngine.js";

/**
 * Return all numeric values represented by an input specification.
 * Supports single numbers and JSON-like lists via parseNumberOrList().
 */
function valuesFromSpec(input) {
  const spec = parseNumberOrList(input);

  if (spec.kind === "invalid") return [];

  return spec.values;
}

/**
 * Build all ordered combinations of two value arrays.
 */
function cartesianProduct(a, b) {
  const out = [];

  for (const x of a) {
    for (const y of b) {
      out.push([x, y]);
    }
  }

  return out;
}

/**
 * Return a shuffled copy of an array.
 */
function shuffleArray(arr) {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

/**
 * Build the balanced condition list for one experimental block.
 *
 * Supported parameter modes:
 * - A_W  : amplitude + width
 * - ID_W : index of difficulty + width
 * - ID_A : index of difficulty + amplitude
 */
function buildBalancedConditions(block) {
  const mode = block.param_mode ?? "A_W";

  const Avals = valuesFromSpec(block.dist_entered);
  const Wvals = valuesFromSpec(block.width_entered);
  const IDvals = valuesFromSpec(block.id_entered);

  if (mode === "A_W") {
    return cartesianProduct(Avals, Wvals).map(([A, W]) => ({
      dist_entered: String(A),
      width_entered: String(W),
      id_entered: block.id_entered,
    }));
  }

  if (mode === "ID_W") {
    return cartesianProduct(IDvals, Wvals).map(([ID, W]) => ({
      dist_entered: block.dist_entered,
      width_entered: String(W),
      id_entered: String(ID),
    }));
  }

  if (mode === "ID_A") {
    return cartesianProduct(IDvals, Avals).map(([ID, A]) => ({
      dist_entered: String(A),
      width_entered: block.width_entered,
      id_entered: String(ID),
    }));
  }

  return [];
}

/**
 * Return a conservative bounding radius for anti-overlap placement.
 *
 * For circles:
 *   radius = W / 2
 *
 * For polygons:
 *   use half diagonal of the bounding box.
 */
function getSafeTargetRadiusPx(shape, sizePx) {
  if (!Number.isFinite(sizePx) || sizePx <= 0) return 0;

  if (shape === "circle") {
    return sizePx / 2;
  }

  return (sizePx * Math.SQRT2) / 2;
}

/**
 * Sample A uniformly between:
 * - minimum safe amplitude
 * - configured maximum amplitude
 */


export function initExperiment(dom, state, ui, server) {
  const targetDebugOverlay = new TargetDebugOverlay();

  const showTargetDebug =
    new URLSearchParams(location.search).get("targetDebug") === "1";

  let pairEngine = null;

  /**
   * Resolve the actual target shape for one trial.
   *
   * If the block uses "shuffle", one shape is chosen randomly.
   */
  function pickTrialShape(trial) {
    const shape = trial?.shape ?? "circle";

    const pool = [
      "circle",
      "square",
      "triangle",
      "pentagon",
      "hexagon",
      "octagon",
      "diamond",
    ];

    if (shape === "shuffle") {
      return pool[Math.floor(Math.random() * pool.length)];
    }

    return shape;
  }

  /**
   * Describe the overall target mode used in the session.
   */
  function deriveSessionTargetMode(items) {
    if (!items?.length) return "unknown";

    const shapes = new Set(items.map((x) => x.shape ?? "circle"));

    if (shapes.size === 1 && [...shapes][0] === "shuffle") {
      return "shuffle";
    }

    if (shapes.size === 1) {
      return "fixed";
    }

    return "mixed";
  }

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
   * Clear active timeout handler.
   */
  function clearTimeoutIfNeeded() {
    if (state.timeoutHandle) {
      clearTimeout(state.timeoutHandle);
      state.timeoutHandle = null;
    }
  }

  /**
   * Reset runtime state before starting a new run.
   */
  function resetRun() {
    clearTimeoutIfNeeded();

    pairEngine?.clearPair?.();

    state.trials = [];
    state.trialIndex = -1;
    state.current = null;
    state.results = [];

    state.errorCount = 0;
    state.startTime = 0;
    state.isDemoRun = false;

    state.currentPair = null;
    state.activeTargetKey = "a";
    state.interactionIndex = 0;
    state.interactionResults = [];

    if (dom.crosshair) dom.crosshair.style.display = "none";
    if (dom.hudLeft) dom.hudLeft.textContent = "Bereit";

    targetDebugOverlay.clear();
  }

  /**
   * Build the full trial list from all session blocks.
   */
  function buildTrials() {
    const unit = dom.distanceMode?.value || "relative";
    const formula = "shannon";

    const blocks = state.sessionBlocks?.length
      ? state.sessionBlocks
      : null;

    if (!blocks) {
      alert('Bitte zuerst "Experiment Design" erstellen oder ein Protokoll laden.');
      return null;
    }

    if (unit === "mm" && !state.mmPerPx) {
      alert(
        "Einheit mm gewählt, aber nicht kalibriert. Bitte kalibrieren oder px/rel wählen."
      );
      return null;
    }

    const trials = [];
    let k = 1;

    for (const b of blocks) {
      const nTrialsWanted = clamp(
        Number(state.currentProtocol?.trialCount ?? 10),
        5,
        25
      );

      // Ensure enough repetitions exist even when only one condition exists.
      const poolRepetitionsPerCondition = Math.max(
        10,
        nTrialsWanted
      );

      const conditions = buildBalancedConditions(b);

      if (!conditions.length) {
        alert("Ungültiger Block: Bitte A, W oder ID korrekt eingeben.");
        return null;
      }

      const fullPool = [];

      for (let rep = 0; rep < poolRepetitionsPerCondition; rep++) {
        for (const condition of conditions) {
          fullPool.push({
            unit,
            formula,

            shape: b.shape ?? "circle",
            param_mode: b.param_mode ?? "A_W",

            dist_entered: condition.dist_entered,
            width_entered: condition.width_entered,
            id_entered: condition.id_entered,

            random_A: !!b.random_A,
            random_W: !!b.random_W,
            random_ID: !!b.random_ID,

            required_overlap: b.required_overlap ?? "1.0",
            w_sampling: state.currentProtocol?.w_sampling ?? "uniform",
            a_sampling: state.currentProtocol?.a_sampling ?? "uniform",
            id_sampling: state.currentProtocol?.id_sampling ?? "uniform",

            repetition: rep + 1,
            demo: false,
          });
        }
      }

      const selectedTrials = shuffleArray(fullPool)
        .slice(0, nTrialsWanted);

      for (const trial of selectedTrials) {
        trials.push({
          ...trial,
          trial_no: k++,
        });
      }
    }

    return trials;
  }

  /**
   * Start trial timeout if configured.
   */
  function setTrialTimeout(ms) {
    clearTimeoutIfNeeded();

    if (!ms || ms <= 0) return;

    state.timeoutHandle = setTimeout(() => {
      markError("timeout");
    }, ms);
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
    clearTimeoutIfNeeded();

    if (state.trialIndex + 1 >= state.trials.length) {
      finishRun();
      return;
    }

    pairEngine?.clearPair?.();

    state.trialIndex++;

    const t = state.trials[state.trialIndex];

    const resolved = resolveTrialParameters(t, state);

    const paramMode = resolved.paramMode;

    const A_in = resolved.A_in;
    const W_in = resolved.W_in;
    const ID_in = resolved.ID_in;

    let Apx = resolved.Apx;
    let Wpx = resolved.Wpx;

    const {
      width: viewportW,
      height: viewportH,
      minSide,
    } = getViewportSize();

    const trialShape = pickTrialShape(t);

    const requiredOverlap =
      Number(t.required_overlap ?? DEFAULT_REQUIRED_OVERLAP);
    
    const touchDiameterPx =
      state.touchDiameterPx ?? DEFAULT_TOUCH_DIAMETER_PX;
    
    Wpx = clampTargetSizePx(
      Wpx,
      state,
      { width: viewportW, height: viewportH, minSide }
    );

    // Preview target to get final rendered size after all constraints.
    const targetPreview = TargetFactory.create({
      shape: trialShape,
      x: viewportW / 2,
      y: viewportH / 2,
      sizePx: Wpx,
      touchDiameterPx,
      requiredOverlap,
    });

    Wpx = trialShape === "band1d_h" || trialShape === "band1d_v"
      ? Math.min(targetPreview.widthPx, targetPreview.heightPx)
      : targetPreview.widthPx;

    const prev = state.current
      ? { x: state.current.x, y: state.current.y }
      : { x: viewportW / 2, y: viewportH / 2 };

    const safeRadiusPx =
      getSafeTargetRadiusPx(trialShape, Wpx);

    const prevRadiusPx = safeRadiusPx;

    const minApx = getMinAmplitudePx({
      shape: trialShape,
      targetSizePx: Wpx,
      marginPx: 10,
    });

    // Random A is sampled only within the safe range.

      Apx = Math.max(Apx, minApx);

    let next;

    if (trialShape === "band1d_h") {
      const marginY = Math.max(12, Wpx / 2 + 6);
      const minY = marginY;
      const maxY = viewportH - marginY;
    
      const candidates = [
        prev.y - Apx,
        prev.y + Apx,
      ].filter((y) => y >= minY && y <= maxY);
    
      const y = candidates.length
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : Math.abs(prev.y - minY) > Math.abs(prev.y - maxY)
          ? minY
          : maxY;
    
      next = {
        x: viewportW / 2,
        y,
        placed: candidates.length > 0,
      };
    } else if (trialShape === "band1d_v") {
      const marginX = Math.max(12, Wpx / 2 + 6);
      const minX = marginX;
      const maxX = viewportW - marginX;
    
      const candidates = [
        prev.x - Apx,
        prev.x + Apx,
      ].filter((x) => x >= minX && x <= maxX);
    
      const x = candidates.length
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : Math.abs(prev.x - minX) > Math.abs(prev.x - maxX)
          ? minX
          : maxX;
    
      next = {
        x,
        y: viewportH / 2,
        placed: candidates.length > 0,
      };
    } else {
      next = placeTarget(
        prev.x,
        prev.y,
        Number.isFinite(Apx) ? Apx : minApx,
        safeRadiusPx,
        prevRadiusPx
      );
    }

    // Real center-to-center amplitude after all corrections.
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

    const currentBase = {
      participant_id:
        dom.participantId?.value?.trim() || "P?",

      session_id:
        dom.sessionId?.value?.trim() || "S?",

      session_comment:
        state.sessionComment || "",

      trial_no: t.trial_no,
      demo: false,

      unit: t.unit,
      formula: "shannon",
      shape: t.shape,

      target_shape: trialShape,

      A_in,
      W_in,
      ID_in,

      A_px_planned: ApxPlannedActual,
      W_px: Wpx,

      A_mm_planned: Amm,
      W_mm: Wmm,

      ID_planned,

      W_axis_planned_px:
        plannedAxisWidth.widthPx,

      W_axis_planned_mm:
        state.mmPerPx &&
        Number.isFinite(plannedAxisWidth.widthPx)
          ? plannedAxisWidth.widthPx * state.mmPerPx
          : null,

      axis_planned_c_x:
        plannedAxisWidth.c?.x ?? null,

      axis_planned_c_y:
        plannedAxisWidth.c?.y ?? null,

      axis_planned_d_x:
        plannedAxisWidth.d?.x ?? null,

      axis_planned_d_y:
        plannedAxisWidth.d?.y ?? null,

      param_mode: paramMode,

      random_A: !!t.random_A,
      random_W: !!t.random_W,
      random_ID: !!t.random_ID,

      prev_x: prev.x,
      prev_y: prev.y,

      x: next.x,
      y: next.y,

      placed: next.placed,

      touch_diameter_px:
        touchDiameterPx,

      required_overlap:
        requiredOverlap,

      lastTouchArea: null,
      lastValidation: null,
    };

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
    clearTimeoutIfNeeded();

    pairEngine?.clearPair?.();

    if (dom.crosshair) dom.crosshair.style.display = "none";
    if (dom.hudLeft) dom.hudLeft.textContent = "Fertig";

    dom.app?.classList.remove("running");

    if (dom.btnSaveServer) {
      dom.btnSaveServer.style.display = "inline-block";
    }

    const mts = state.results
      .map((r) => r.mt_ms)
      .filter(Number.isFinite);

    const ids = state.results
      .map((r) => r.ID_effective ?? r.ID_planned)
      .filter(Number.isFinite);

    const mean = (arr) =>
      arr.length
        ? arr.reduce((a, b) => a + b, 0) / arr.length
        : NaN;

    const completedTrials = state.results.filter((r) => r.trial_summary).length;

    document.getElementById("sumTrials").textContent =
      String(completedTrials);

    document.getElementById("sumErrors").textContent =
      String(state.errorCount);

    document.getElementById("sumMT").textContent =
      Number.isFinite(mean(mts))
        ? mean(mts).toFixed(1) + " ms"
        : "—";

    document.getElementById("sumID").textContent =
      Number.isFinite(mean(ids))
        ? mean(ids).toFixed(3)
        : "—";

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
    const csv = toCSV(state.results);

    const blob = new Blob(
      [csv],
      { type: "text/csv;charset=utf-8" }
    );

    const a = document.createElement("a");

    const fname =
      `fitts_${dom.participantId?.value || "P"}_${dom.sessionId?.value || "S"}_${new Date()
        .toISOString()
        .replaceAll(":", "-")}.csv`;

    a.href = URL.createObjectURL(blob);
    a.download = fname;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
      URL.revokeObjectURL(a.href);
    }, 1000);
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

        state.results.push({
          ...last,

          mt_ms:
            summary.mt_ms_mean,

          ID_effective:
            summary.ID_effective_mean,

          interactions_per_trial:
            summary.interactions,

          trial_summary: true,

          A_in: state.current.A_in,
          W_in: state.current.W_in,
          ID_in: state.current.ID_in,

          A_px_planned:
            state.current.A_px_planned,

          W_px:
            state.current.W_px,

          A_mm_planned:
            state.current.A_mm_planned,

          W_mm:
            state.current.W_mm,

          ID_planned:
            state.current.ID_planned,

          W_axis_planned_px:
            state.current.W_axis_planned_px,

          W_axis_planned_mm:
            state.current.W_axis_planned_mm,

          axis_planned_c_x:
            state.current.axis_planned_c_x,

          axis_planned_c_y:
            state.current.axis_planned_c_y,

          axis_planned_d_x:
            state.current.axis_planned_d_x,

          axis_planned_d_y:
            state.current.axis_planned_d_y,

          param_mode:
            state.current.param_mode,

          random_A:
            state.current.random_A,

          random_W:
            state.current.random_W,

          random_ID:
            state.current.random_ID,

          errors:
            state.current.errors,

          error_reasons:
            state.current.error_reasons.join("|"),

          clicks_before_hit:
            state.current.clicks_before_hit,
        });

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
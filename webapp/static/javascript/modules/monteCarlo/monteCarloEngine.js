/**
 * Monte Carlo engine.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Simulation Engine
 *   → Constraint Analysis
 *   → Protocol Aggregation
 *
 * Responsibility:
 * Runs Monte Carlo simulations for:
 * - one parameter space
 * - one protocol block
 * - one complete protocol
 *
 * Important:
 * This module orchestrates the simulation.
 * It does not define probability distributions, Fitts equations or target
 * constraints itself.
 *
 * Extension guide:
 * - To add a new distribution: edit core/distributions.js.
 * - To change sampling logic: edit monteCarloSampling.js.
 * - To change diagnostics: edit monteCarloDiagnostics.js.
 * - To change histograms/CDF: edit monteCarloHistogram.js.
 */

import {
  getViewportSize,
} from "../../core/helpers.js";

import {
  DEFAULT_TOUCH_DIAMETER_PX,
} from "../../core/constants.js";

import {
  buildRangesFromBlock,
} from "../parameterSampling.js";

import {
  analyzeTargetSizeClamp,
  getTargetSizeBoundsPx,
} from "../experimentConstraints.js";

import {
  samplePlannedW,
} from "./monteCarloSampling.js";

import {
  summarize,
} from "./monteCarloStats.js";

import {
  makeHistogram,
  makeCDF,
} from "./monteCarloHistogram.js";

import {
  getDistortionLevel,
  buildProtocolDiagnostics,
} from "./monteCarloDiagnostics.js";

import {
  SUGGESTED_PROFILES,
} from "./monteCarloProfiles.js";

import {
  createSimulationCounts,
  updateClampCounts,
  updateInvalidCount,
  finalizeCounts,
} from "./monteCarloCounts.js";

import {
  appendPreviewRow,
} from "./monteCarloPreviewRows.js";

export const buildMonteCarloRangesFromBlock =
  buildRangesFromBlock;

const DEFAULT_MONTE_CARLO = {
  n: 50000,
  histogramBins: 100,
  unit: "relative",
  mode: "A_W",
  ARange: [0.05, 0.8],
  WRange: [0.02, 0.3],
  IDRange: [1, 7],
};

/*
* -------------------------------------------------------------------------- 
* Chart helpers                                                              
* -------------------------------------------------------------------------- 
*/


function computeChartBounds({
  plannedW,
  minTargetPx,
  maxTargetPx,
}) {
  const plannedMin =
    plannedW.length ? Math.min(...plannedW) : NaN;

  const plannedMax =
    plannedW.length ? Math.max(...plannedW) : NaN;

  return {
    chartMin: Math.min(
      minTargetPx,
      Number.isFinite(plannedMin)
        ? plannedMin
        : minTargetPx
    ),

    chartMax: Math.max(
      maxTargetPx,
      Number.isFinite(plannedMax)
        ? plannedMax
        : maxTargetPx
    ),
  };
}


/* -------------------------------------------------------------------------- */
/* Single parameter-space simulation                                          */
/* -------------------------------------------------------------------------- */

/**
 * Run a Monte Carlo analysis for one parameter space.
 *
 * This is the lowest-level public simulation function.
 */
export function runMonteCarloW({
  n = DEFAULT_MONTE_CARLO.n,
  mode = DEFAULT_MONTE_CARLO.mode,
  unit = DEFAULT_MONTE_CARLO.unit,

  ARange = DEFAULT_MONTE_CARLO.ARange,
  WRange = DEFAULT_MONTE_CARLO.WRange,
  IDRange = DEFAULT_MONTE_CARLO.IDRange,

  requiredOverlap = 1.0,
  histogramBins = DEFAULT_MONTE_CARLO.histogramBins,

  aSampling = "uniform",
  wSampling = "uniform",
  idSampling = "uniform",

  overrideViewport = null,
  state,
} = {}) {
  const viewport =
    overrideViewport ?? getViewportSize();

  const { width, height, minSide } = viewport;

  const touchDiameterPx =
    state?.touchDiameterPx ?? DEFAULT_TOUCH_DIAMETER_PX;

  const {
    minPx: minTargetPx,
    maxPx: maxTargetPx,
  } = getTargetSizeBoundsPx(state, viewport);

  const rows = [];
  const plannedW = [];
  const effectiveW = [];
  const counts = createSimulationCounts();

  for (let i = 0; i < n; i++) {
    const sample = samplePlannedW({
      mode,
      unit,

      ARange,
      WRange,
      IDRange,

      minSide,
      state,
      viewport,

      aSampling,
      wSampling,
      idSampling,
    });

    if (!Number.isFinite(sample.WpxRaw)) {
      updateInvalidCount(counts);
      continue;
    }

    const clampInfo =
      analyzeTargetSizeClamp(
        sample.WpxRaw,
        state,
        viewport
      );

    const WpxFinal =
      clampInfo.outputPx;

    plannedW.push(sample.WpxRaw);
    effectiveW.push(WpxFinal);

    updateClampCounts(counts, clampInfo);

    appendPreviewRow({
      rows,
      index: i + 1,

      mode,
      unit,

      aSampling,
      wSampling,
      idSampling,

      sample,
      WpxFinal,

      requiredOverlap,

      clampedMin: clampInfo.clampedMin,
      clampedMax: clampInfo.clampedMax,
    });
  }

  const { chartMin, chartMax } =
    computeChartBounds({
      plannedW,
      minTargetPx,
      maxTargetPx,
    });

  const finalCounts = finalizeCounts(counts);

  const distortionPct =
    finalCounts.clamped_total_pct;

  return {
    meta: {
      n,
      mode,
      unit,

      a_sampling: aSampling,
      w_sampling: wSampling,
      id_sampling: idSampling,

      // Kept for backward compatibility with the existing dashboard.
      sampling: wSampling,

      viewport_w: width,
      viewport_h: height,
      min_side: minSide,

      required_overlap: requiredOverlap,

      touch_diameter_px: touchDiameterPx,

      min_target_px: minTargetPx,
      max_target_px: maxTargetPx,

      histogram_bins: histogramBins,
      chart_min_px: chartMin,
      chart_max_px: chartMax,

      suggested_profiles: SUGGESTED_PROFILES,
    },

    counts: finalCounts,

    summary: {
      planned_w_px:
        summarize(plannedW),

      effective_w_px:
        summarize(effectiveW),

      edge_mass: {
        min_px: minTargetPx,
        max_px: maxTargetPx,

        min_mass_pct: finalCounts.clamped_min_pct,
        
        max_mass_pct: finalCounts.clamped_max_pct,
      },

      diagnostic:
        getDistortionLevel(distortionPct),
    },

    distributions: {
      planned_histogram:
        makeHistogram(
          plannedW,
          chartMin,
          chartMax,
          histogramBins
        ),

      effective_histogram:
        makeHistogram(
          effectiveW,
          chartMin,
          chartMax,
          histogramBins
        ),

      planned_cdf:
        makeCDF(
          plannedW,
          chartMin,
          chartMax
        ),

      effective_cdf:
        makeCDF(
          effectiveW,
          chartMin,
          chartMax
        ),
    },

    rows,
  };
}

/* -------------------------------------------------------------------------- */
/* Block-level simulation                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Run a Monte Carlo analysis for one protocol block.
 */
export function runMonteCarloBlock({
  block,
  protocol = {},
  state,

  n = DEFAULT_MONTE_CARLO.n,
  histogramBins = DEFAULT_MONTE_CARLO.histogramBins,
  overrideViewport = null,
} = {}) {
  const ranges =
    buildRangesFromBlock(block);

  return runMonteCarloW({
    n,

    mode:
      block?.param_mode ??
      DEFAULT_MONTE_CARLO.mode,

    unit:
      protocol.distanceMode ??
      DEFAULT_MONTE_CARLO.unit,

    requiredOverlap:
      Number(block?.required_overlap ?? 1),

    aSampling:
      protocol.a_sampling ?? "uniform",

    wSampling:
      protocol.w_sampling ?? "uniform",

    idSampling:
      protocol.id_sampling ?? "uniform",

    histogramBins,
    overrideViewport,
    state,

    ...ranges,
  });
}

/* -------------------------------------------------------------------------- */
/* Protocol-level simulation                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Run a Monte Carlo analysis for all blocks in one protocol.
 */
export function runMonteCarloProtocol({
  protocol,
  state,

  n = DEFAULT_MONTE_CARLO.n,
  histogramBins = DEFAULT_MONTE_CARLO.histogramBins,
  overrideViewport = null,
} = {}) {
  const blocks =
    protocol?.sessionBlocks ?? [];

  const blockResults =
    blocks.map((block, index) => ({
      index,
      block_no: index + 1,

      shape:
        block.shape ?? "circle",

      param_mode:
        block.param_mode ??
        DEFAULT_MONTE_CARLO.mode,

      result:
        runMonteCarloBlock({
          block,
          protocol,
          state,
          n,
          histogramBins,
          overrideViewport,
        }),
    }));

  const diagnostics =
    buildProtocolDiagnostics(blockResults);

  return {
    meta: {
      n,
      histogramBins,
      block_count: blockResults.length,

      ...diagnostics,
    },

    blocks: blockResults,
  };
}
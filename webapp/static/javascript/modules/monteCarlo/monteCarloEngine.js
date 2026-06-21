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

import {
  DEFAULT_MONTE_CARLO,
} from "./monteCarloConstants.js";

/**
 * Re-export range construction for compatibility with other modules.
 *
 * Purpose:
 *   Allows existing imports to access buildRangesFromBlock through the Monte
 *   Carlo engine module without changing their import path.
 */
export const buildMonteCarloRangesFromBlock =
  buildRangesFromBlock;


/* -------------------------------------------------------------------------- */
/* Chart helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Compute chart bounds that include both planned W values and clamp limits.
 *
 * Args:
 *   plannedW: Array of planned target widths in CSS pixels.
 *   minTargetPx: Minimum allowed target size in CSS pixels.
 *   maxTargetPx: Maximum allowed target size in CSS pixels.
 *
 * Returns:
 *   Object containing:
 *   - chartMin: lower histogram/CDF chart bound
 *   - chartMax: upper histogram/CDF chart bound
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Ensures that the plotted distribution includes the requested W range and
 *   the active application clamp bounds.
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
 * Args:
 *   n: Number of simulated samples.
 *   mode: Parameter mode, for example "A_W", "ID_W" or "ID_A".
 *   unit: Input unit, for example "relative", "px" or "mm".
 *   ARange: Amplitude range in the selected unit.
 *   WRange: Width range in the selected unit.
 *   IDRange: Index-of-difficulty range.
 *   requiredOverlap: Required target overlap ratio used for preview rows.
 *   histogramBins: Number of histogram bins.
 *   aSampling: Sampling distribution for A.
 *   wSampling: Sampling distribution for W.
 *   idSampling: Sampling distribution for ID.
 *   overrideViewport: Optional viewport object for simulation/testing.
 *   state: Shared application state containing calibration and touchability.
 *
 * Returns:
 *   Complete Monte Carlo result object containing:
 *   - meta
 *   - counts
 *   - summary
 *   - distributions
 *   - rows
 *
 * Side effects:
 *   None. This function computes and returns simulation results only.
 *
 * Workflow:
 *   1. Resolve viewport and active target-size constraints.
 *   2. Generate planned W samples.
 *   3. Clamp planned W values to application constraints.
 *   4. Count clamp events.
 *   5. Build preview rows.
 *   6. Compute summary statistics, histograms and CDFs.
 *
 * Important:
 *   This function analyzes W distortion caused by target-size constraints.
 *   It does not place targets on screen and does not execute real trials.
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
    // Generate one planned sample according to the selected parameter mode and
    // sampling distributions.
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

    // Invalid samples are counted separately and excluded from W distribution
    // arrays because they cannot be clamped or plotted meaningfully.
    if (!Number.isFinite(sample.WpxRaw)) {
      updateInvalidCount(counts);
      continue;
    }

    // Analyze how the planned W value is changed by active app constraints.
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
      // Statistical summary of the requested/planned W distribution.
      planned_w_px:
        summarize(plannedW),

      // Statistical summary of the effective W distribution after clamping.
      effective_w_px:
        summarize(effectiveW),

      // Mass accumulated on the lower and upper constraint boundaries.
      edge_mass: {
        min_px: minTargetPx,
        max_px: maxTargetPx,

        min_mass_pct: finalCounts.clamped_min_pct,

        max_mass_pct: finalCounts.clamped_max_pct,
      },

      // Qualitative distortion label derived from total clamp percentage.
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
 *
 * Args:
 *   block: Session block configuration from the protocol editor.
 *   protocol: Parent protocol object containing unit and sampling settings.
 *   state: Shared application state containing calibration and touchability.
 *   n: Number of simulated samples.
 *   histogramBins: Number of histogram bins.
 *   overrideViewport: Optional viewport object for simulation/testing.
 *
 * Returns:
 *   Monte Carlo result object for the block.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Converts the block's entered A/W/ID values into numeric ranges, then
 *   delegates the actual simulation to runMonteCarloW().
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
 *
 * Args:
 *   protocol: Protocol object containing sessionBlocks and sampling settings.
 *   state: Shared application state containing calibration and touchability.
 *   n: Number of simulated samples per block.
 *   histogramBins: Number of histogram bins per block.
 *   overrideViewport: Optional viewport object for simulation/testing.
 *
 * Returns:
 *   Protocol-level Monte Carlo result containing:
 *   - meta: protocol-wide diagnostics and warning counts
 *   - blocks: block-level simulation results
 *
 * Side effects:
 *   None.
 *
 * Workflow:
 *   1. Read all session blocks from the protocol.
 *   2. Run one block-level simulation for each block.
 *   3. Aggregate block results into protocol diagnostics.
 *
 * Important:
 *   n is applied per block. For example, 5 blocks with n=1000 produce 5000
 *   simulated block samples in total.
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
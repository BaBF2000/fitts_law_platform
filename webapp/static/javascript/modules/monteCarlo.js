import {
  computeWFromID,
  computeAFromWAndID,
  convertToPxAndMm,
  getViewportSize,
} from "../core/helpers.js";

import { DEFAULT_TOUCH_DIAMETER_PX } from "../core/constants.js";

import { sampleDistribution } from "../core/distributions.js";

import {
  buildRangesFromBlock,
} from "./parameterSampling.js";

import {
  analyzeTargetSizeClamp,
  getTargetSizeBoundsPx,
  getFeasibleWBoundsInUnit,
} from "./experimentConstraints.js";


function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function pct(value, total) {
  return total ? (100 * value) / total : 0;
}

function mean(values) {
  return values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : NaN;
}

function std(values) {
  if (values.length < 2) return NaN;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function quantile(values, q) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function makeHistogram(values, min, max, binCount = 32) {
  const bins = [];
  const width = (max - min) / binCount;

  for (let i = 0; i < binCount; i++) {
    bins.push({
      index: i,
      min: min + i * width,
      max: min + (i + 1) * width,
      center: min + (i + 0.5) * width,
      count: 0,
      pct: 0,
    });
  }

  for (const value of values) {
    if (!Number.isFinite(value)) continue;

    let idx = Math.floor((value - min) / width);
    idx = clamp(idx, 0, binCount - 1);
    bins[idx].count += 1;
  }

  for (const bin of bins) {
    bin.pct = pct(bin.count, values.length);
  }

  return bins;
}

function makeCDF(values, min, max, pointCount = 80) {
  const sorted = [...values]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const points = [];

  for (let i = 0; i < pointCount; i++) {
    const x = min + ((max - min) * i) / (pointCount - 1);
    let count = 0;

    while (count < sorted.length && sorted[count] <= x) {
      count++;
    }

    points.push({
      x,
      y: sorted.length ? count / sorted.length : 0,
    });
  }

  return points;
}

export const buildMonteCarloRangesFromBlock = buildRangesFromBlock;

function samplePlannedW({
  mode,
  unit,
  ARange,
  WRange,
  IDRange,
  minSide,
  state,
  aSampling = "uniform",
  wSampling = "uniform",
  idSampling = "uniform",
  viewport,
}) {
  let A_in = null;
  let W_in = null;
  let ID_in = null;
  let Apx = NaN;
  let WpxRaw = NaN;

  const feasibleW = getFeasibleWBoundsInUnit(unit, state, viewport);

  if (mode === "A_W") {
  A_in = sampleDistribution({ distribution: aSampling, min: ARange[0], max: ARange[1], });
  W_in = sampleDistribution({
    distribution: wSampling,
    min: WRange[0],
    max: WRange[1],
    truncateMin: feasibleW.min,
    truncateMax: feasibleW.max,
  });
  Apx = convertToPxAndMm(A_in, unit, state?.mmPerPx).px;
  WpxRaw = convertToPxAndMm(W_in, unit, state?.mmPerPx).px;
  }

  if (mode === "ID_W") { 
    ID_in = sampleDistribution({distribution: idSampling, min: IDRange[0], max: IDRange[1], });
  
    W_in = sampleDistribution({ distribution: wSampling, min: WRange[0], max: WRange[1], truncateMin: feasibleW.min, truncateMax: feasibleW.max, });
  
    WpxRaw = convertToPxAndMm(W_in, unit, state?.mmPerPx).px;
  
    Apx = computeAFromWAndID( WpxRaw, ID_in, "shannon" );
  
    A_in = unit === "relative" ? Apx / minSide : Apx;
  }

  if (mode === "ID_A") {
    ID_in = sampleDistribution({ distribution: idSampling, min: IDRange[0], max: IDRange[1], });
    A_in = sampleDistribution({ distribution: aSampling, min: ARange[0], max: ARange[1], });
  
    Apx = convertToPxAndMm(A_in, unit, state?.mmPerPx).px;
  
    WpxRaw = computeWFromID( Apx, ID_in, "shannon" );
  
    W_in = unit === "relative" ? WpxRaw / minSide : WpxRaw;
  }


  return { A_in, W_in, ID_in, Apx, WpxRaw };
}

function summarize(values) {
  return {
    mean: mean(values),
    sd: std(values),
    min: Math.min(...values),
    q05: quantile(values, 0.05),
    median: quantile(values, 0.5),
    q95: quantile(values, 0.95),
    max: Math.max(...values),
  };
}
/**
 * Run a Monte Carlo analysis for one protocol block.
 */
export function runMonteCarloBlock({
  block,
  protocol = {},
  state,
  n = 50000,
  histogramBins = 100,
  overrideViewport = null,
} = {}) {
  const ranges = buildRangesFromBlock(block);

  return runMonteCarloW({
    n,
    mode: block?.param_mode ?? "A_W",
    unit: protocol.distanceMode ?? "relative",
    requiredOverlap: Number(block?.required_overlap ?? 1),
    aSampling: protocol.a_sampling ?? "uniform",
    wSampling: protocol.w_sampling ?? "uniform",
    idSampling: protocol.id_sampling ?? "uniform",
    histogramBins,
    overrideViewport,
    state,
    ...ranges,
  });
}

/**
 * Run a Monte Carlo analysis for all protocol blocks.
 */
export function runMonteCarloProtocol({
  protocol,
  state,
  n = 50000,
  histogramBins = 100,
  overrideViewport = null,
} = {}) {
  const blocks = protocol?.sessionBlocks ?? [];

  const blockResults = blocks.map((block, index) => ({
    index,
    block_no: index + 1,
    shape: block.shape ?? "circle",
    param_mode: block.param_mode ?? "A_W",
    result: runMonteCarloBlock({
      block,
      protocol,
      state,
      n,
      histogramBins,
      overrideViewport,
    }),
  }));

  const meanClampedMinPct =
    blockResults.reduce(
      (sum, item) => sum + (item.result?.counts?.clamped_min_pct ?? 0),
      0
    ) / Math.max(1, blockResults.length);
  
  const meanClampedMaxPct =
    blockResults.reduce(
      (sum, item) => sum + (item.result?.counts?.clamped_max_pct ?? 0),
      0
    ) / Math.max(1, blockResults.length);
  
  const worstBlock = blockResults.reduce((worst, item) => {
    const current = item.result?.counts?.clamped_total_pct ?? 0;
    const previous = worst?.result?.counts?.clamped_total_pct ?? -1;
  
    return current > previous ? item : worst;
  }, null);
  
  const worstClampPct =
    worstBlock?.result?.counts?.clamped_total_pct ?? 0;
  
  const worstDiagnostic =
    worstClampPct > 25
      ? "strong_distortion"
      : worstClampPct > 10
        ? "moderate_distortion"
        : "low_distortion";
  
  
  const protocolWarnings = [];

  for (const item of blockResults) {
    const counts = item.result?.counts;
  
    if (!counts) continue;
  
    const totalClamp = counts.clamped_total_pct ?? 0;
  
    if (totalClamp >= 50) {
      protocolWarnings.push({
        block_no: item.block_no,
        severity: "high",
        type: "heavy_clamp_distortion",
        message:
          "Große Teile der W-Verteilung werden durch die Grenzen recadriert " +
          "Die effektive Verteilung entspricht nicht mehr der gewünschten Verteilung",
      });
  
      continue;
    }
  
    if (totalClamp >= 15) {
      protocolWarnings.push({
        block_no: item.block_no,
        severity: "medium",
        type: "moderate_clamp_distortion",
        message:
          "Die W-Verteilung wird moderat durch Viewport- oder Touch-Grenzen verzerrt",
      });
    }
  
    if (
      (counts.clamped_min_pct ?? 0) > 80
    ) {
      protocolWarnings.push({
        block_no: item.block_no,
        severity: "high",
        type: "collapsed_to_wmin",
        message:
          "Die meisten generierten W-Werte kollabieren auf Wmin",
      });
    }
  
    if (
      (counts.clamped_max_pct ?? 0) > 80
    ) {
      protocolWarnings.push({
        block_no: item.block_no,
        severity: "high",
        type: "collapsed_to_wmax",
        message:
         "Die meisten generierten W-Werte kollabieren auf Wmax",
      });
    }
  }
  
  return {
    meta: {
      n,
      mean_clamped_min_pct: meanClampedMinPct,
      mean_clamped_max_pct: meanClampedMaxPct,
      
      worst_block_no: worstBlock?.block_no ?? null,
      
      worst_block_clamped_min_pct:
        worstBlock?.result?.counts?.clamped_min_pct ?? null,
      
      worst_block_clamped_max_pct:
        worstBlock?.result?.counts?.clamped_max_pct ?? null,
      histogramBins,
      block_count: blockResults.length,
      worst_clamp_pct: worstClampPct,
      worst_diagnostic: worstDiagnostic,
      warnings: protocolWarnings,
      warning_count: protocolWarnings.length,
    },
    blocks: blockResults,
  };
}

export function runMonteCarloW({
  n = 50000,
  mode = "A_W",
  unit = "relative",
  ARange = [0.05, 0.8],
  WRange = [0.02, 0.3],
  IDRange = [1, 7],
  requiredOverlap = 1.0,
  histogramBins = 100,
  aSampling = "uniform",
  wSampling = "uniform",
  idSampling = "uniform",
  overrideViewport = null,
  state,
} = {}) {
  const viewport = overrideViewport ?? getViewportSize();
  const { width, height, minSide } = viewport;

  const touchDiameterPx = state?.touchDiameterPx ?? DEFAULT_TOUCH_DIAMETER_PX;
  
  const { minPx: minTargetPx, maxPx: maxTargetPx } = getTargetSizeBoundsPx(state, viewport);

  const rows = [];
  const plannedW = [];
  const effectiveW = [];

  const counts = {
    total: 0,
    invalid: 0,
    clamped_min: 0,
    clamped_max: 0,
  };

  for (let i = 0; i < n; i++) {
    const sample = samplePlannedW({ mode, unit, ARange, WRange, IDRange, minSide, state, aSampling, wSampling, idSampling, viewport, });

    const { A_in, W_in, ID_in, Apx, WpxRaw } = sample;

    if (!Number.isFinite(WpxRaw)) {
      counts.invalid += 1;
      continue;
    }

    const clampInfo = analyzeTargetSizeClamp(WpxRaw, state, viewport);

    const WpxFinal = clampInfo.outputPx;
    const clampedMin = clampInfo.clampedMin;
    const clampedMax = clampInfo.clampedMax;

    plannedW.push(WpxRaw);
    effectiveW.push(WpxFinal);

    counts.total += 1;
    if (clampedMin) counts.clamped_min += 1;
    if (clampedMax) counts.clamped_max += 1;
    if (rows.length < 500) {
      rows.push({
        index: i + 1,
        mode,
        unit,
        sampling: wSampling,
        A_in,
        W_in,
        ID_in,
        A_px: Apx,
        W_px_planned: WpxRaw,
        W_px_effective: WpxFinal,
        radius_px_effective: WpxFinal / 2,
        required_overlap: requiredOverlap,
        clamped_min: clampedMin,
        clamped_max: clampedMax,
      });
    }
  }

  const chartMin = Math.min(
    minTargetPx,
    Number.isFinite(Math.min(...plannedW)) ? Math.min(...plannedW) : minTargetPx
  );

  const chartMax = Math.max(
    maxTargetPx,
    Number.isFinite(Math.max(...plannedW)) ? Math.max(...plannedW) : maxTargetPx
  );

  const plannedHistogram = makeHistogram(
    plannedW,
    chartMin,
    chartMax,
    histogramBins
  );

  const effectiveHistogram = makeHistogram(
    effectiveW,
    chartMin,
    chartMax,
    histogramBins
  );

  const plannedCDF = makeCDF(plannedW, chartMin, chartMax);
  const effectiveCDF = makeCDF(effectiveW, chartMin, chartMax);

  const clampTotal = counts.clamped_min + counts.clamped_max;
  const distortionPct = pct(clampTotal, counts.total);

  return {
    meta: {
      n,
      mode,
      unit,
      a_sampling: aSampling,
      w_sampling: wSampling,
      id_sampling: idSampling,
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
      suggested_profiles: [
        {
          id: "uniform",
          label: "Uniform",
          description: "Uniforme Verteilung innerhalb der gewünschten Wertebereiche.",
        },
        {
          id: "truncated_uniform",
          label: "Trunkierte Uniformverteilung",
          description: "Uniforme Verteilung innerhalb der technisch gültigen Grenzen",
        },
        {
          id: "normal",
          label: "Normalverteilung",
          description: "Normalverteilung um den Mittelwert der gewünschten Werte",
        },
        {
          id: "truncated_normal",
          label: "Trunkierte Normalverteilung",
          description: "Normalverteilung innerhalb der technisch gültigen Grenzen.",
        },
      ],
    },

    counts: {
      ...counts,
      clamped_min_pct: pct(counts.clamped_min, counts.total),
      clamped_max_pct: pct(counts.clamped_max, counts.total),
      clamped_total_pct: distortionPct,
    },

    summary: {
      planned_w_px: summarize(plannedW),
      effective_w_px: summarize(effectiveW),
      edge_mass: {
        min_px: minTargetPx,
        max_px: maxTargetPx,
        min_mass_pct: pct(counts.clamped_min, counts.total),
        max_mass_pct: pct(counts.clamped_max, counts.total),
      },
      diagnostic:
        distortionPct > 25
          ? "strong_distortion"
          : distortionPct > 10
            ? "moderate_distortion"
            : "low_distortion",
    },

    distributions: {
      planned_histogram: plannedHistogram,
      effective_histogram: effectiveHistogram,
      planned_cdf: plannedCDF,
      effective_cdf: effectiveCDF,
    },

    rows,
  };
}
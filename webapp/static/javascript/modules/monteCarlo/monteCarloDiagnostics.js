/**
 * Monte Carlo diagnostics.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Distribution Quality Analysis
 *   → Protocol Diagnostics
 *
 * Responsibility:
 * Evaluates how strongly application constraints distort the requested
 * parameter distributions.
 *
 * Important:
 * This module does not run simulations.
 * It only interprets already computed Monte Carlo results.
 *
 * Extension guide:
 * - Add new warning types here.
 * - Add new distortion thresholds here.
 * - Add future protocol quality scores here.
 */

export const DIAGNOSTIC_THRESHOLDS = {
  moderatePct: 10,
  strongPct: 25,
  warningMediumPct: 15,
  warningHighPct: 50,
  collapsePct: 80,
};

/* -------------------------------------------------------------------------- */
/* Block-level diagnostics                                                     */
/* -------------------------------------------------------------------------- */

export function getDistortionLevel(clampPct) {
  if (clampPct > DIAGNOSTIC_THRESHOLDS.strongPct) {
    return "strong_distortion";
  }

  if (clampPct > DIAGNOSTIC_THRESHOLDS.moderatePct) {
    return "moderate_distortion";
  }

  return "low_distortion";
}

function buildHeavyClampWarning(item, totalClamp) {
  return {
    block_no: item.block_no,
    severity: "high",
    type: "heavy_clamp_distortion",
    clamp_pct: totalClamp,
    message:
      "Große Teile der W-Verteilung werden durch die Grenzen begrenzt. " +
      "Die effektive Verteilung entspricht nicht mehr der gewünschten Verteilung.",
  };
}

function buildModerateClampWarning(item, totalClamp) {
  return {
    block_no: item.block_no,
    severity: "medium",
    type: "moderate_clamp_distortion",
    clamp_pct: totalClamp,
    message:
      "Die W-Verteilung wird moderat durch Viewport- oder Touch-Grenzen verzerrt.",
  };
}

function buildCollapsedToMinWarning(item, minClamp) {
  return {
    block_no: item.block_no,
    severity: "high",
    type: "collapsed_to_wmin",
    clamp_pct: minClamp,
    message:
      "Die meisten generierten W-Werte kollabieren auf Wmin.",
  };
}

function buildCollapsedToMaxWarning(item, maxClamp) {
  return {
    block_no: item.block_no,
    severity: "high",
    type: "collapsed_to_wmax",
    clamp_pct: maxClamp,
    message:
      "Die meisten generierten W-Werte kollabieren auf Wmax.",
  };
}

export function buildWarningsForBlock(item) {
  const warnings = [];
  const counts = item.result?.counts;

  if (!counts) {
    return warnings;
  }

  const totalClamp = counts.clamped_total_pct ?? 0;
  const minClamp = counts.clamped_min_pct ?? 0;
  const maxClamp = counts.clamped_max_pct ?? 0;

  if (totalClamp >= DIAGNOSTIC_THRESHOLDS.warningHighPct) {
    warnings.push(
      buildHeavyClampWarning(item, totalClamp)
    );
  } else if (totalClamp >= DIAGNOSTIC_THRESHOLDS.warningMediumPct) {
    warnings.push(
      buildModerateClampWarning(item, totalClamp)
    );
  }

  if (minClamp > DIAGNOSTIC_THRESHOLDS.collapsePct) {
    warnings.push(
      buildCollapsedToMinWarning(item, minClamp)
    );
  }

  if (maxClamp > DIAGNOSTIC_THRESHOLDS.collapsePct) {
    warnings.push(
      buildCollapsedToMaxWarning(item, maxClamp)
    );
  }

  return warnings;
}

/* -------------------------------------------------------------------------- */
/* Protocol-level diagnostics                                                  */
/* -------------------------------------------------------------------------- */

function meanBlockMetric(blockResults, selector) {
  const count = Math.max(1, blockResults.length);

  return (
    blockResults.reduce(
      (sum, item) => sum + (selector(item) ?? 0),
      0
    ) / count
  );
}

function findWorstClampBlock(blockResults) {
  return blockResults.reduce((worst, item) => {
    const current =
      item.result?.counts?.clamped_total_pct ?? 0;

    const previous =
      worst?.result?.counts?.clamped_total_pct ?? -1;

    return current > previous ? item : worst;
  }, null);
}

export function buildProtocolDiagnostics(blockResults) {
  const meanClampedMinPct =
    meanBlockMetric(
      blockResults,
      (item) => item.result?.counts?.clamped_min_pct
    );

  const meanClampedMaxPct =
    meanBlockMetric(
      blockResults,
      (item) => item.result?.counts?.clamped_max_pct
    );

  const worstBlock =
    findWorstClampBlock(blockResults);

  const worstClampPct =
    worstBlock?.result?.counts?.clamped_total_pct ?? 0;

  const worstDiagnostic =
    getDistortionLevel(worstClampPct);

  const warnings =
    blockResults.flatMap(buildWarningsForBlock);

  return {
    mean_clamped_min_pct: meanClampedMinPct,
    mean_clamped_max_pct: meanClampedMaxPct,

    worst_block_no:
      worstBlock?.block_no ?? null,

    worst_block_clamped_min_pct:
      worstBlock?.result?.counts?.clamped_min_pct ?? null,

    worst_block_clamped_max_pct:
      worstBlock?.result?.counts?.clamped_max_pct ?? null,

    worst_clamp_pct: worstClampPct,
    worst_diagnostic: worstDiagnostic,

    warnings,
    warning_count: warnings.length,
  };
}
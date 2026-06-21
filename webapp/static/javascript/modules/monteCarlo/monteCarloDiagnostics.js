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
 *
 * Related modules:
 * - monteCarloEngine.js produces block-level simulation results.
 * - monteCarloCounts.js provides clamp percentages.
 * - experimentConstraints.js defines the target-size clamp rules.
 */

/**
 * Diagnostic thresholds used to classify Monte Carlo distortion.
 *
 * Fields:
 *   moderatePct:
 *     Clamp percentage above which distortion is classified as moderate.
 *
 *   strongPct:
 *     Clamp percentage above which distortion is classified as strong.
 *
 *   warningMediumPct:
 *     Clamp percentage above which a medium warning is generated.
 *
 *   warningHighPct:
 *     Clamp percentage above which a high-severity warning is generated.
 *
 *   collapsePct:
 *     Percentage above which values are considered collapsed to one bound.
 *
 * Unit:
 *   Percent.
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

/**
 * Convert a clamp percentage into a distortion level.
 *
 * Args:
 *   clampPct: Total clamp percentage for one block.
 *
 * Returns:
 *   String diagnostic level:
 *   - "strong_distortion"
 *   - "moderate_distortion"
 *   - "low_distortion"
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Provides a compact qualitative label for Monte Carlo reports and dashboards.
 */
export function getDistortionLevel(clampPct) {
  if (clampPct > DIAGNOSTIC_THRESHOLDS.strongPct) {
    return "strong_distortion";
  }

  if (clampPct > DIAGNOSTIC_THRESHOLDS.moderatePct) {
    return "moderate_distortion";
  }

  return "low_distortion";
}

/**
 * Build a high-severity warning for heavy W clamping.
 *
 * Args:
 *   item: Block result wrapper containing block_no and result data.
 *   totalClamp: Total clamp percentage for the block.
 *
 * Returns:
 *   Warning object describing strong distribution distortion.
 *
 * Side effects:
 *   None.
 *
 * Meaning:
 *   A large part of the requested W distribution is forced to application
 *   constraints, so the effective distribution no longer matches the intended
 *   design well.
 */
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

/**
 * Build a medium-severity warning for moderate W clamping.
 *
 * Args:
 *   item: Block result wrapper containing block_no and result data.
 *   totalClamp: Total clamp percentage for the block.
 *
 * Returns:
 *   Warning object describing moderate distribution distortion.
 *
 * Side effects:
 *   None.
 *
 * Meaning:
 *   The requested W distribution is still usable, but viewport or touch
 *   constraints noticeably distort it.
 */
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

/**
 * Build a high-severity warning for collapse to Wmin.
 *
 * Args:
 *   item: Block result wrapper containing block_no and result data.
 *   minClamp: Percentage of samples clamped to the minimum W bound.
 *
 * Returns:
 *   Warning object describing collapse to minimum target width.
 *
 * Side effects:
 *   None.
 *
 * Meaning:
 *   Most generated W values are too small and are forced to Wmin.
 */
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

/**
 * Build a high-severity warning for collapse to Wmax.
 *
 * Args:
 *   item: Block result wrapper containing block_no and result data.
 *   maxClamp: Percentage of samples clamped to the maximum W bound.
 *
 * Returns:
 *   Warning object describing collapse to maximum target width.
 *
 * Side effects:
 *   None.
 *
 * Meaning:
 *   Most generated W values are too large and are forced to Wmax.
 */
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

/**
 * Build all warnings for one simulated protocol block.
 *
 * Args:
 *   item: Block result wrapper containing block_no and result.counts.
 *
 * Returns:
 *   Array of warning objects for the block.
 *
 * Side effects:
 *   None.
 *
 * Warning types:
 *   - heavy_clamp_distortion
 *   - moderate_clamp_distortion
 *   - collapsed_to_wmin
 *   - collapsed_to_wmax
 *
 * Behavior:
 *   Total clamping controls moderate/heavy distortion warnings. Separate
 *   min/max clamp percentages detect collapse to one bound.
 */
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

/**
 * Compute the mean value of a selected block metric.
 *
 * Args:
 *   blockResults: Array of block-level Monte Carlo result wrappers.
 *   selector: Function that extracts one numeric metric from a block result.
 *
 * Returns:
 *   Mean metric value across all blocks.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Uses Math.max(1, blockResults.length) to avoid division by zero. Therefore
 *   an empty block list returns 0.
 */
function meanBlockMetric(blockResults, selector) {
  const count = Math.max(1, blockResults.length);

  return (
    blockResults.reduce(
      (sum, item) => sum + (selector(item) ?? 0),
      0
    ) / count
  );
}

/**
 * Find the block with the highest total clamp percentage.
 *
 * Args:
 *   blockResults: Array of block-level Monte Carlo result wrappers.
 *
 * Returns:
 *   Block result wrapper with the highest clamped_total_pct, or null if the
 *   input array is empty.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Identifies the weakest block in the protocol from a constraint-distortion
 *   perspective.
 */
function findWorstClampBlock(blockResults) {
  return blockResults.reduce((worst, item) => {
    const current =
      item.result?.counts?.clamped_total_pct ?? 0;

    const previous =
      worst?.result?.counts?.clamped_total_pct ?? -1;

    return current > previous ? item : worst;
  }, null);
}

/**
 * Build protocol-level Monte Carlo diagnostics from all block results.
 *
 * Args:
 *   blockResults: Array of block-level Monte Carlo result wrappers.
 *
 * Returns:
 *   Protocol diagnostic object containing:
 *   - mean_clamped_min_pct
 *   - mean_clamped_max_pct
 *   - worst_block_no
 *   - worst_block_clamped_min_pct
 *   - worst_block_clamped_max_pct
 *   - worst_clamp_pct
 *   - worst_diagnostic
 *   - warnings
 *   - warning_count
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Aggregates block-level clamp metrics, identifies the worst block and builds
 *   a combined warning list for the whole protocol.
 *
 * Important:
 *   This function interprets the simulation results. It does not rerun or alter
 *   the Monte Carlo simulation itself.
 */
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
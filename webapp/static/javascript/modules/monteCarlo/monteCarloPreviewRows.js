/**
 * Monte Carlo preview rows.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Dashboard Preview Table
 *
 * Responsibility:
 * Builds the small preview table shown in the Monte Carlo dashboard.
 *
 * Important:
 * This module does not influence the simulation result.
 * It only stores a limited number of example samples for inspection/export.
 *
 * Related modules:
 * - monteCarloEngine.js calls appendPreviewRow() while running simulations.
 * - monteCarloConstants.js may also define preview/table limits.
 * - The dashboard rendering layer displays these rows to the user.
 */
import {MAX_PREVIEW_ROWS,} from "./monteCarloConstants.js"

/**
 * Append one sample row to the Monte Carlo preview table.
 *
 * Args:
 *   rows: Mutable preview row array.
 *   index: One-based simulation sample index.
 *   mode: Parameter mode used for the sample, for example "A_W", "ID_W" or
 *     "ID_A".
 *   unit: Input unit used for A/W/ID values, for example "relative", "px" or
 *     "mm".
 *   aSampling: Sampling distribution used for A.
 *   wSampling: Sampling distribution used for W.
 *   idSampling: Sampling distribution used for ID.
 *   sample: Planned sample object returned by monteCarloSampling.js.
 *   WpxFinal: Effective target width after application constraints.
 *   requiredOverlap: Required overlap ratio used by the experiment design.
 *   clampedMin: Whether the planned W value was clamped to Wmin.
 *   clampedMax: Whether the planned W value was clamped to Wmax.
 *   maxRows: Maximum number of preview rows to keep.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   May append one object to the rows array.
 *
 * Behavior:
 *   If rows already contains maxRows entries, the function returns immediately.
 *   Otherwise, it stores a compact representation of the simulated sample.
 *
 * Stored preview fields:
 *   - input values: A_in, W_in, ID_in
 *   - planned geometry: A_px, W_px_planned
 *   - effective geometry: W_px_effective, radius_px_effective
 *   - constraint flags: clamped_min, clamped_max
 *
 * Important:
 *   Preview rows are intended for inspection and debugging. They are not used
 *   to compute final Monte Carlo statistics.
 */
export function appendPreviewRow({
  rows,
  index,

  mode,
  unit,

  aSampling,
  wSampling,
  idSampling,

  sample,
  WpxFinal,

  requiredOverlap,

  clampedMin,
  clampedMax,

  maxRows = MAX_PREVIEW_ROWS,
}) {
  // Keep only a limited number of example rows for dashboard responsiveness.
  if (rows.length >= maxRows) return;

  rows.push({
    index,
    mode,
    unit,

    a_sampling: aSampling,
    w_sampling: wSampling,
    id_sampling: idSampling,

    A_in: sample.A_in,
    W_in: sample.W_in,
    ID_in: sample.ID_in,

    A_px: sample.Apx,

    W_px_planned: sample.WpxRaw,
    W_px_effective: WpxFinal,

    // Radius is stored for quick inspection of the effective target geometry.
    radius_px_effective: WpxFinal / 2,

    required_overlap: requiredOverlap,

    clamped_min: clampedMin,
    clamped_max: clampedMax,
  });
}
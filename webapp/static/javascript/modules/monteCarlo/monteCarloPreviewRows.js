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
 */

export const MAX_PREVIEW_ROWS = 500;

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

    radius_px_effective: WpxFinal / 2,

    required_overlap: requiredOverlap,

    clamped_min: clampedMin,
    clamped_max: clampedMax,
  });
}
/**
 * Monte Carlo constants.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Configuration
 */

export const DEFAULT_MONTE_CARLO = {
  n: 50000,
  histogramBins: 100,

  unit: "relative",
  mode: "A_W",

  ARange: [0.05, 0.8],
  WRange: [0.02, 0.3],
  IDRange: [1, 7],
};

export const MAX_PREVIEW_ROWS = 500;
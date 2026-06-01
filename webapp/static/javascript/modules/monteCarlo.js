/**
 * Monte Carlo public facade.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *
 * Responsibility:
 * Keeps the old import path stable:
 *
 *   import { runMonteCarloW } from "./monteCarlo.js";
 *
 * while the implementation is split into smaller LEGO modules.
 */

export {
  buildMonteCarloRangesFromBlock,
  runMonteCarloW,
  runMonteCarloBlock,
  runMonteCarloProtocol,
} from "./monteCarlo/monteCarloEngine.js";
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
 *
 * Important:
 * This file does not implement Monte Carlo logic directly.
 * It only re-exports the public Monte Carlo API from the engine module.
 *
 * Purpose:
 * Keeping this facade avoids having to update all existing imports when the
 * Monte Carlo implementation is refactored into smaller files.
 *
 * Extension guide:
 * - To change Monte Carlo behavior: edit monteCarlo/monteCarloEngine.js.
 * - To add a new public Monte Carlo function: export it here as well.
 * - To keep imports stable, other modules should continue importing from this
 *   facade instead of importing directly from internal Monte Carlo modules.
 */

export {
  buildMonteCarloRangesFromBlock,
  runMonteCarloW,
  runMonteCarloBlock,
  runMonteCarloProtocol,
} from "./monteCarlo/monteCarloEngine.js";
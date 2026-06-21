/**
 * Experiment condition builder.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Generator
 *   → Balanced Conditions
 *
 * Responsibility:
 * Builds balanced condition combinations from one protocol block.
 *
 * This module does not resolve A/W/ID into pixels.
 * It only expands user-entered parameter lists into trial conditions.
 *
 * Related modules:
 * - experimentTrials.js uses these conditions to build the final trial list.
 * - core/helpers.js provides parseNumberOrList().
 * - experimentTrialPreparation.js later resolves the selected values into
 *   runtime trial parameters.
 */

import {
  parseNumberOrList,
} from "../../core/helpers.js";

/**
 * Convert a user-entered parameter specification into an array of values.
 *
 * Args:
 *   input: Raw user input, for example "0.5" or "[0.1, 0.3, 0.5]".
 *
 * Returns:
 *   Array of numeric values.
 *   Returns an empty array if the input cannot be parsed.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   The actual parsing is delegated to parseNumberOrList(). This helper only
 *   normalizes invalid inputs to an empty array so condition generation can
 *   fail safely.
 */
export function valuesFromSpec(input) {
  const spec = parseNumberOrList(input);

  if (spec.kind === "invalid") {
    return [];
  }

  return spec.values;
}

/**
 * Build the Cartesian product of two value arrays.
 *
 * Args:
 *   a: First value array.
 *   b: Second value array.
 *
 * Returns:
 *   Array of pairs [x, y] containing every combination of values from a and b.
 *
 * Side effects:
 *   None.
 *
 * Example:
 *   [1, 2] × [10, 20] becomes:
 *   [[1, 10], [1, 20], [2, 10], [2, 20]]
 *
 * Purpose:
 *   Used to generate balanced parameter combinations for a protocol block.
 */
export function cartesianProduct(a, b) {
  const out = [];

  for (const x of a) {
    for (const y of b) {
      out.push([x, y]);
    }
  }

  return out;
}

/**
 * Return a shuffled copy of an array.
 *
 * Args:
 *   arr: Input array.
 *
 * Returns:
 *   New array containing the same elements in random order.
 *
 * Side effects:
 *   None. The original array is not modified.
 *
 * Algorithm:
 *   Uses the Fisher-Yates shuffle.
 *
 * Important:
 *   This function is exported so trial generation can randomize condition order
 *   without mutating the original balanced condition list.
 */
export function shuffleArray(arr) {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

/**
 * Build balanced trial conditions from one protocol block.
 *
 * Args:
 *   block: Protocol block containing param_mode and entered A/W/ID values.
 *
 * Returns:
 *   Array of condition objects. Each condition contains the entered values that
 *   should be used for one generated trial.
 *
 * Side effects:
 *   None.
 *
 * Supported parameter modes:
 *   - A_W:
 *       Combines all A values with all W values.
 *       ID stays unchanged because it is not the controlling input.
 *
 *   - ID_W:
 *       Combines all ID values with all W values.
 *       A stays unchanged because it will be derived later.
 *
 *   - ID_A:
 *       Combines all ID values with all A values.
 *       W stays unchanged because it will be derived later.
 *
 * Important:
 *   This function only expands condition combinations. It does not compute
 *   Fitts' Law values, does not convert units and does not apply constraints.
 */
export function buildBalancedConditions(block) {
  const mode = block.param_mode ?? "A_W";

  const Avals = valuesFromSpec(block.dist_entered);
  const Wvals = valuesFromSpec(block.width_entered);
  const IDvals = valuesFromSpec(block.id_entered);

  if (mode === "A_W") {
    return cartesianProduct(Avals, Wvals).map(([A, W]) => ({
      dist_entered: String(A),
      width_entered: String(W),
      id_entered: block.id_entered,
    }));
  }

  if (mode === "ID_W") {
    return cartesianProduct(IDvals, Wvals).map(([ID, W]) => ({
      dist_entered: block.dist_entered,
      width_entered: String(W),
      id_entered: String(ID),
    }));
  }

  if (mode === "ID_A") {
    return cartesianProduct(IDvals, Avals).map(([ID, A]) => ({
      dist_entered: String(A),
      width_entered: block.width_entered,
      id_entered: String(ID),
    }));
  }

  return [];
}
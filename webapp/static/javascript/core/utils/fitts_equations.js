/**
 * Fitts Law Utilities.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Parameter Resolution
 *   → ID / A / W Computation
 * - Monte-Carlo-Simulation
 *   → Parameter Generator
 *
 * Responsibility:
 * Central implementation of all Fitts-Law equations used by the app.
 *
 * Extension guide:
 * To add a new Fitts formulation:
 * 1. Add a new entry to FITTS_FORMULAS.
 * 2. Provide:
 *    - id(A, W)
 *    - wFromId(A, ID)
 *    - aFromId(W, ID)
 * 3. Use the new key in the protocol/formula field.
 */

// Registry of supported Fitts' Law formulations.
// Each entry must provide:
// - id(A, W): compute index of difficulty
// - wFromId(A, ID): compute target width from amplitude and ID
// - aFromId(W, ID): compute amplitude from width and ID
//
// A and W must use the same unit, usually pixels or millimeters.
const FITTS_FORMULAS = {
  // Shannon formulation:
  // ID = log2(A / W + 1)
  // This is the default formulation used by the application.
  shannon: {
    id: (A, W) =>
      Math.log2(A / W + 1),

    wFromId: (A, ID) => {
      const denom = Math.pow(2, ID) - 1;
      return denom > 0 ? A / denom : NaN;
    },

    aFromId: (W, ID) =>
      W * (Math.pow(2, ID) - 1),
  },

  // Classic formulation:
  // ID = log2(2A / W)
  // Kept as an alternative formulation for compatibility or comparison.
  classic: {
    id: (A, W) =>
      Math.log2((2 * A) / W),

    wFromId: (A, ID) =>
      (2 * A) / Math.pow(2, ID),

    aFromId: (W, ID) =>
      (W * Math.pow(2, ID)) / 2,
  },
};

/**
 * Resolve a Fitts' Law formula implementation.
 *
 * Args:
 *   formula: Formula identifier, such as "shannon" or "classic".
 *
 * Returns:
 *   Formula implementation object. Unknown formula names fall back to the
 *   Shannon formulation.
 *
 * Side effects:
 *   None.
 *
 * Important:
 *   The fallback keeps older or malformed protocols usable.
 */
function getFormula(formula = "shannon") {
  return FITTS_FORMULAS[formula] ?? FITTS_FORMULAS.shannon;
}

/**
 * Compute the index of difficulty for a movement.
 *
 * Args:
 *   A: Movement amplitude. Must be greater than 0.
 *   W: Target width. Must be greater than 0.
 *   formula: Optional Fitts' Law formula identifier.
 *
 * Returns:
 *   Computed index of difficulty, or NaN if A or W is invalid.
 *
 * Side effects:
 *   None.
 *
 * Notes:
 *   A and W must use the same unit.
 */
export function computeID(A, W, formula = "shannon") {
  if (!(A > 0) || !(W > 0)) return NaN;

  return getFormula(formula).id(A, W);
}

/**
 * Compute target width from amplitude and index of difficulty.
 *
 * Args:
 *   A: Movement amplitude. Must be greater than 0.
 *   ID: Index of difficulty. Must be greater than or equal to 0.
 *   formula: Optional Fitts' Law formula identifier.
 *
 * Returns:
 *   Target width, or NaN if inputs are invalid or the formula cannot be
 *   inverted for the given values.
 *
 * Side effects:
 *   None.
 *
 * Related usage:
 *   Used when protocols define A and ID and the application must derive W.
 */
export function computeWFromID(A, ID, formula = "shannon") {
  if (!(A > 0) || !(ID >= 0)) return NaN;

  return getFormula(formula).wFromId(A, ID);
}

/**
 * Compute movement amplitude from target width and index of difficulty.
 *
 * Args:
 *   W: Target width. Must be greater than 0.
 *   ID: Index of difficulty. Must be greater than or equal to 0.
 *   formula: Optional Fitts' Law formula identifier.
 *
 * Returns:
 *   Movement amplitude, or NaN if W or ID is invalid.
 *
 * Side effects:
 *   None.
 *
 * Related usage:
 *   Used when protocols define W and ID and the application must derive A.
 */
export function computeAFromWAndID(W, ID, formula = "shannon") {
  if (!(W > 0) || !(ID >= 0)) return NaN;

  return getFormula(formula).aFromId(W, ID);
}
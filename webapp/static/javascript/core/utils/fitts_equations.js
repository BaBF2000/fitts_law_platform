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

const FITTS_FORMULAS = {
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

  classic: {
    id: (A, W) =>
      Math.log2((2 * A) / W),

    wFromId: (A, ID) =>
      (2 * A) / Math.pow(2, ID),

    aFromId: (W, ID) =>
      (W * Math.pow(2, ID)) / 2,
  },
};

function getFormula(formula = "shannon") {
  return FITTS_FORMULAS[formula] ?? FITTS_FORMULAS.shannon;
}

export function computeID(A, W, formula = "shannon") {
  if (!(A > 0) || !(W > 0)) return NaN;

  return getFormula(formula).id(A, W);
}

export function computeWFromID(A, ID, formula = "shannon") {
  if (!(A > 0) || !(ID >= 0)) return NaN;

  return getFormula(formula).wFromId(A, ID);
}

export function computeAFromWAndID(W, ID, formula = "shannon") {
  if (!(W > 0) || !(ID >= 0)) return NaN;

  return getFormula(formula).aFromId(W, ID);
}
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
 */

import {
  parseNumberOrList,
} from "../../core/helpers.js";

export function valuesFromSpec(input) {
  const spec = parseNumberOrList(input);

  if (spec.kind === "invalid") {
    return [];
  }

  return spec.values;
}

export function cartesianProduct(a, b) {
  const out = [];

  for (const x of a) {
    for (const y of b) {
      out.push([x, y]);
    }
  }

  return out;
}

export function shuffleArray(arr) {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

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
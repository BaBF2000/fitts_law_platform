/**
 * Experiment trial placement helpers.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Generator
 *   → Target Placement
 *
 * Responsibility:
 * Computes the next target center position for one trial.
 */

import {
  placeTarget,
} from "../../core/helpers.js";

import {
  isHorizontalBand,
  isVerticalBand,
} from "./experimentTargets.js";

export function computeNextTargetPosition({
  trialShape,
  prev,
  Apx,
  minApx,
  Wpx,
  safeRadiusPx,
  prevRadiusPx,
  viewportW,
  viewportH,
}) {
  const effectiveApx =
    Number.isFinite(Apx)
      ? Apx
      : minApx;

  if (isHorizontalBand(trialShape)) {
    const marginY =
      Math.max(12, Wpx / 2 + 6);

    const minY = marginY;
    const maxY = viewportH - marginY;

    const candidates = [
      prev.y - effectiveApx,
      prev.y + effectiveApx,
    ].filter((y) => y >= minY && y <= maxY);

    const y =
      candidates.length
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : Math.abs(prev.y - minY) > Math.abs(prev.y - maxY)
          ? minY
          : maxY;

    return {
      x: viewportW / 2,
      y,
      placed: candidates.length > 0,
    };
  }

  if (isVerticalBand(trialShape)) {
    const marginX =
      Math.max(12, Wpx / 2 + 6);

    const minX = marginX;
    const maxX = viewportW - marginX;

    const candidates = [
      prev.x - effectiveApx,
      prev.x + effectiveApx,
    ].filter((x) => x >= minX && x <= maxX);

    const x =
      candidates.length
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : Math.abs(prev.x - minX) > Math.abs(prev.x - maxX)
          ? minX
          : maxX;

    return {
      x,
      y: viewportH / 2,
      placed: candidates.length > 0,
    };
  }

  return placeTarget(
    prev.x,
    prev.y,
    effectiveApx,
    safeRadiusPx,
    prevRadiusPx
  );
}
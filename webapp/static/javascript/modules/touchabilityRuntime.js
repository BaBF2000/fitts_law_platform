/**
 * Touchability runtime helpers.
 *
 * Organigram reference:
 * - Touchability
 *   → Participant Touchability
 *   → Local Persistence
 *
 * Responsibility:
 * Loads, applies and saves participant-specific touchability values.
 *
 * Important:
 * The actual finger measurement logic lives in fingerTouchability.js.
 * This module only connects the global state, UI labels and storage.
 */

import {
  DEFAULT_TOUCH_DIAMETER_PX,
} from "../core/constants.js";

import {
  saveTouchabilityForParticipant,
  loadTouchabilityForParticipant,
} from "../core/storage.js";

export function updateTouchabilityUi(dom, state) {
  const px =
    state.touchDiameterPx ?? DEFAULT_TOUCH_DIAMETER_PX;

  const mm =
    state.touchDiameterMm;

  const source =
    state.touchabilitySource === "measured"
      ? "gemessen"
      : "Standardwert";

  if (dom.touchDiameterStatus) {
    dom.touchDiameterStatus.textContent =
      Number.isFinite(mm)
        ? `${Math.round(px)} px / ${mm.toFixed(1)} mm (${source}, Zeigefinger)`
        : `${Math.round(px)} px (${source}, Zeigefinger)`;
  }

  if (dom.touchDiameterPx) {
    dom.touchDiameterPx.textContent =
      `${Math.round(px)} px`;
  }

  if (dom.touchDiameterMm) {
    dom.touchDiameterMm.textContent =
      Number.isFinite(mm)
        ? `${mm.toFixed(1)} mm`
        : "—";
  }
}

export function applyDefaultTouchability(dom, state) {
  state.touchDiameterPx =
    DEFAULT_TOUCH_DIAMETER_PX;

  state.touchDiameterMm =
    state.mmPerPx
      ? DEFAULT_TOUCH_DIAMETER_PX * state.mmPerPx
      : null;

  state.touchabilitySource =
    "fallback";

  updateTouchabilityUi(dom, state);
}

export function loadParticipantTouchability(dom, state) {
  const participantId =
    dom.participantId?.value?.trim() || "P01";

  const saved =
    loadTouchabilityForParticipant(participantId);

  if (!saved?.touchDiameterPx) {
    applyDefaultTouchability(dom, state);
    return;
  }

  state.touchDiameterPx =
    saved.touchDiameterPx;

  state.touchDiameterMm =
    saved.touchDiameterMm ??
    (
      state.mmPerPx
        ? saved.touchDiameterPx * state.mmPerPx
        : null
    );

  state.touchabilitySource =
    saved.source ?? "measured";

  updateTouchabilityUi(dom, state);
}

export function saveCurrentTouchability(
  dom,
  state,
  source = "measured"
) {
  const participantId =
    dom.participantId?.value?.trim() || "P01";

  const px =
    state.touchDiameterPx ?? DEFAULT_TOUCH_DIAMETER_PX;

  const mm =
    state.touchDiameterMm ??
    (
      state.mmPerPx
        ? px * state.mmPerPx
        : null
    );

  state.touchDiameterPx = px;
  state.touchDiameterMm = mm;
  state.touchabilitySource = source;

  saveTouchabilityForParticipant(
    participantId,
    {
      touchDiameterPx: px,
      touchDiameterMm: mm,
      source,
      finger: "index",
    }
  );

  updateTouchabilityUi(dom, state);
}
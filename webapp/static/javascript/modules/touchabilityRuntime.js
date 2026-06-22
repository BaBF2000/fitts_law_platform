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

/**
 * Update all touchability-related UI labels.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing touchDiameterPx,
 *     touchDiameterMm and touchabilitySource.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates text content in the touchability status UI.
 *
 * Behavior:
 *   - Shows both pixel and millimeter values when calibration is available.
 *   - Shows only pixel values when no millimeter conversion is available.
 *   - Labels the value as measured or default/fallback.
 *
 * Important:
 *   UI text is German by design.
 */
export function updateTouchabilityUi(dom, state) {
  // Use the configured participant touch diameter, or fall back to the default
  // touch model if no participant-specific value is available.
  const px =
    state.touchDiameterPx ?? DEFAULT_TOUCH_DIAMETER_PX;

  // Millimeter value is optional because it requires screen calibration.
  const mm =
    state.touchDiameterMm;

  // German source label shown in the UI.
  const source =
    state.touchabilitySource === "measured"
      ? "gemessen"
      : "Standardwert";

  // Main status label: shows the current touch diameter and its source.
  if (dom.touchDiameterStatus) {
    dom.touchDiameterStatus.textContent =
      Number.isFinite(mm)
        ? `${Math.round(px)} px / ${mm.toFixed(1)} mm (${source})`
        : `${Math.round(px)} px (${source})`;
  }

  // Dedicated pixel value display.
  if (dom.touchDiameterPx) {
    dom.touchDiameterPx.textContent =
      `${Math.round(px)} px`;
  }

  // Dedicated millimeter value display.
  // If no calibration exists, the physical size cannot be shown.
  if (dom.touchDiameterMm) {
    dom.touchDiameterMm.textContent =
      Number.isFinite(mm)
        ? `${mm.toFixed(1)} mm`
        : "—";
  }
}

/**
 * Apply the default touchability model.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates state.touchDiameterPx, state.touchDiameterMm,
 *   state.touchabilitySource and the touchability UI.
 *
 * Behavior:
 *   The default touch diameter is always available in pixels. A millimeter
 *   value is computed only when mmPerPx calibration exists.
 *
 * Related usage:
 *   Used when no participant-specific touchability measurement is stored.
 */
export function applyDefaultTouchability(dom, state) {
  // Default touch diameter in CSS pixels.
  state.touchDiameterPx =
    DEFAULT_TOUCH_DIAMETER_PX;

  // Convert the default touch diameter to millimeters if calibration exists.
  state.touchDiameterMm =
    state.mmPerPx
      ? DEFAULT_TOUCH_DIAMETER_PX * state.mmPerPx
      : null;

  // Mark the value as fallback/default rather than participant-measured.
  state.touchabilitySource =
    "fallback";

  updateTouchabilityUi(dom, state);
}

/**
 * Load participant-specific touchability data from local storage and apply it.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Reads participant-specific touchability data from localStorage through
 *   core/storage.js and updates state/UI.
 *
 * Behavior:
 *   - Uses the participant ID from the setup screen.
 *   - Falls back to "P01" when no participant ID is entered.
 *   - Applies default touchability when no saved value exists.
 *   - Recomputes millimeter value from px if saved mm is missing and calibration
 *     is available.
 *
 * Related storage:
 *   loadTouchabilityForParticipant() from touchabilityStorage.js.
 */
export function loadParticipantTouchability(dom, state) {
  // Participant-specific touchability is keyed by participant ID.
  const participantId =
    dom.participantId?.value?.trim() || "P01";

  const saved =
    loadTouchabilityForParticipant(participantId);

  // No saved participant measurement exists: use the default touch model.
  if (!saved?.touchDiameterPx) {
    applyDefaultTouchability(dom, state);
    return;
  }

  // Restore saved touch diameter in pixels.
  state.touchDiameterPx =
    saved.touchDiameterPx;

  // Prefer the stored millimeter value. If it is missing, recompute it from the
  // current calibration when possible.
  state.touchDiameterMm =
    saved.touchDiameterMm ??
    (
      state.mmPerPx
        ? saved.touchDiameterPx * state.mmPerPx
        : null
    );

  // Restore the saved source label, defaulting to "measured" for old entries.
  state.touchabilitySource =
    saved.source ?? "measured";

  updateTouchabilityUi(dom, state);
}

/**
 * Save the current touchability values for the active participant.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state containing current touchability values.
 *   source: Source label for the saved value. Defaults to "measured".
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates state, writes participant-specific touchability data to
 *   localStorage through core/storage.js and refreshes the UI labels.
 *
 * Behavior:
 *   - Uses the current state touch diameter if available.
 *   - Falls back to DEFAULT_TOUCH_DIAMETER_PX otherwise.
 *   - Computes the millimeter value from mmPerPx if it is missing.
 *   - Stores the measurement together with participant ID, source and finger.
 *
 * Related storage:
 *   saveTouchabilityForParticipant() from touchabilityStorage.js.
 */
export function saveCurrentTouchability(
  dom,
  state,
  source = "measured"
) {
  // Participant-specific storage key.
  const participantId =
    dom.participantId?.value?.trim() || "P01";

  // Ensure a valid pixel value is always saved.
  const px =
    state.touchDiameterPx ?? DEFAULT_TOUCH_DIAMETER_PX;

  // Keep or compute the physical touch diameter when calibration exists.
  const mm =
    state.touchDiameterMm ??
    (
      state.mmPerPx
        ? px * state.mmPerPx
        : null
    );

  // Update runtime state before saving and refreshing the UI.
  state.touchDiameterPx = px;
  state.touchDiameterMm = mm;
  state.touchabilitySource = source;

  // Persist the participant-specific touchability model.
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
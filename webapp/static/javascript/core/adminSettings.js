/**
 * Admin settings persistence.
 *
 * Organigram reference:
 * - Admin Settings
 *   → Application Constraints
 *   → Local Persistence
 *
 * Responsibility:
 * Stores and restores editable application constraint values.
 *
 * These settings affect:
 * - minimum visible target size
 * - touch safety factor
 * - maximum target size ratio
 * - minimum amplitude margin
 * - default required overlap
 *
 * Important:
 * Defaults come from core/constants.js.
 * Runtime constraint interpretation happens in modules/experimentConstraints.js.
 *
 * Extension guide:
 * - To add a new admin setting:
 *   1. Add its default value to DEFAULT_ADMIN_SETTINGS.
 *   2. Validate it in sanitizeAdminSettings().
 *   3. Add the UI control where admin settings are edited.
 *   4. Use it from the relevant constraint or runtime module.
 */

import {
  DEFAULT_REQUIRED_OVERLAP,
  MIN_VISIBLE_TARGET_PX,
  TOUCH_SAFETY_FACTOR,
  MAX_TARGET_SIZE_RATIO,
  MIN_AMPLITUDE_MARGIN_PX,
} from "./constants.js";

// localStorage key for editable admin constraint settings.
// Version suffix allows future migration if the stored structure changes.
const ADMIN_SETTINGS_KEY = "fitts_admin_settings_v1";

// Default editable constraint values.
// These values are initialized from global constants and are used whenever no
// valid admin settings are stored in localStorage.
export const DEFAULT_ADMIN_SETTINGS = {
  minVisibleTargetPx: MIN_VISIBLE_TARGET_PX,
  touchSafetyFactor: TOUCH_SAFETY_FACTOR,
  maxTargetSizeRatio: MAX_TARGET_SIZE_RATIO,
  minAmplitudeMarginPx: MIN_AMPLITUDE_MARGIN_PX,
  defaultRequiredOverlap: DEFAULT_REQUIRED_OVERLAP,
};

/**
 * Validate and normalize editable admin settings.
 *
 * Args:
 *   settings: Raw settings object loaded from localStorage or received from
 *     the admin settings UI.
 *
 * Returns:
 *   Object containing numeric, validated settings. Invalid, missing or
 *   out-of-range values are replaced with DEFAULT_ADMIN_SETTINGS values.
 *
 * Side effects:
 *   None. This function only returns a cleaned copy.
 *
 * Validation rules:
 *   - minVisibleTargetPx must be > 0.
 *   - touchSafetyFactor must be > 0.
 *   - maxTargetSizeRatio must be in the range (0, 1].
 *   - minAmplitudeMarginPx must be >= 0.
 *   - defaultRequiredOverlap must be in the range [0, 1].
 *
 * Related modules:
 *   The cleaned settings are later interpreted by experimentConstraints.js.
 */
function sanitizeAdminSettings(settings = {}) {
  return {
    minVisibleTargetPx:
      Number.isFinite(Number(settings.minVisibleTargetPx)) &&
      Number(settings.minVisibleTargetPx) > 0
        ? Number(settings.minVisibleTargetPx)
        : DEFAULT_ADMIN_SETTINGS.minVisibleTargetPx,

    touchSafetyFactor:
      Number.isFinite(Number(settings.touchSafetyFactor)) &&
      Number(settings.touchSafetyFactor) > 0
        ? Number(settings.touchSafetyFactor)
        : DEFAULT_ADMIN_SETTINGS.touchSafetyFactor,

    maxTargetSizeRatio:
      Number.isFinite(Number(settings.maxTargetSizeRatio)) &&
      Number(settings.maxTargetSizeRatio) > 0 &&
      Number(settings.maxTargetSizeRatio) <= 1
        ? Number(settings.maxTargetSizeRatio)
        : DEFAULT_ADMIN_SETTINGS.maxTargetSizeRatio,

    minAmplitudeMarginPx:
      Number.isFinite(Number(settings.minAmplitudeMarginPx)) &&
      Number(settings.minAmplitudeMarginPx) >= 0
        ? Number(settings.minAmplitudeMarginPx)
        : DEFAULT_ADMIN_SETTINGS.minAmplitudeMarginPx,

    defaultRequiredOverlap:
      Number.isFinite(Number(settings.defaultRequiredOverlap)) &&
      Number(settings.defaultRequiredOverlap) >= 0 &&
      Number(settings.defaultRequiredOverlap) <= 1
        ? Number(settings.defaultRequiredOverlap)
        : DEFAULT_ADMIN_SETTINGS.defaultRequiredOverlap,
  };
}

/**
 * Load editable admin settings from localStorage.
 *
 * Returns:
 *   Object containing sanitized admin settings. If no settings are stored, or
 *   if parsing fails, a copy of DEFAULT_ADMIN_SETTINGS is returned.
 *
 * Side effects:
 *   Reads from localStorage.
 *
 * Failure behavior:
 *   Invalid JSON, unavailable localStorage or malformed settings are handled
 *   silently by returning default settings.
 */
export function loadAdminSettings() {
  try {
    const raw = localStorage.getItem(ADMIN_SETTINGS_KEY);

    if (!raw) {
      return { ...DEFAULT_ADMIN_SETTINGS };
    }

    return sanitizeAdminSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_ADMIN_SETTINGS };
  }
}

/**
 * Save editable admin settings to localStorage.
 *
 * Args:
 *   settings: Raw settings object from the admin settings UI.
 *
 * Returns:
 *   Object containing the sanitized settings that were actually stored.
 *
 * Side effects:
 *   Writes the sanitized settings to localStorage.
 *
 * Important:
 *   The function always sanitizes before saving, so invalid UI values cannot be
 *   persisted directly.
 */
export function saveAdminSettings(settings) {
  const cleaned = sanitizeAdminSettings(settings);

  try {
    localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore persistence failures and still return the sanitized settings.
  }

  return cleaned;
}

/**
 * Remove saved admin settings and return defaults.
 *
 * Returns:
 *   Object containing a fresh copy of DEFAULT_ADMIN_SETTINGS.
 *
 * Side effects:
 *   Removes ADMIN_SETTINGS_KEY from localStorage.
 *
 * Related usage:
 *   Used by the admin settings UI reset action.
 */
export function clearAdminSettings() {
  try {
    localStorage.removeItem(ADMIN_SETTINGS_KEY);
  } catch {
    // Ignore persistence failures and still return defaults.
  }

  return { ...DEFAULT_ADMIN_SETTINGS };
}
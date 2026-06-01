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

const ADMIN_SETTINGS_KEY = "fitts_admin_settings_v1";

export const DEFAULT_ADMIN_SETTINGS = {
  minVisibleTargetPx: MIN_VISIBLE_TARGET_PX,
  touchSafetyFactor: TOUCH_SAFETY_FACTOR,
  maxTargetSizeRatio: MAX_TARGET_SIZE_RATIO,
  minAmplitudeMarginPx: MIN_AMPLITUDE_MARGIN_PX,
  defaultRequiredOverlap: DEFAULT_REQUIRED_OVERLAP,
};

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

export function saveAdminSettings(settings) {
  const cleaned = sanitizeAdminSettings(settings);
  localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(cleaned));
  return cleaned;
}

export function clearAdminSettings() {
  localStorage.removeItem(ADMIN_SETTINGS_KEY);
  return { ...DEFAULT_ADMIN_SETTINGS };
}
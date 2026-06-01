/**
 * Core application constants.
 *
 * Organigram reference:
 * - Core Utilities
 *   → Global Constants
 * - Experiment Engine
 *   → Constraint System
 * - Target System
 *   → Touch Validation
 *
 * Responsibility:
 * Defines stable default values shared across the application.
 *
 * Runtime-editable constraint values are handled in adminSettings.js.
 */

/* -------------------------------------------------------------------------- */
/* Touch model                                                                */
/* -------------------------------------------------------------------------- */

export const DEFAULT_TOUCH_DIAMETER_PX = 40;
export const TOUCH_SAFETY_FACTOR = 3;
export const OVERLAP_SAMPLE_STEP_PX = 2;

/* -------------------------------------------------------------------------- */
/* Target constraints                                                         */
/* -------------------------------------------------------------------------- */

export const MIN_VISIBLE_TARGET_PX = 24;
export const MAX_TARGET_SIZE_RATIO = 0.25;
export const VIEWPORT_TARGET_MARGIN_PX = 10;

/* -------------------------------------------------------------------------- */
/* Amplitude constraints                                                      */
/* -------------------------------------------------------------------------- */

export const MIN_AMPLITUDE_MARGIN_PX = 10;

/* -------------------------------------------------------------------------- */
/* Validation defaults                                                        */
/* -------------------------------------------------------------------------- */

export const DEFAULT_REQUIRED_OVERLAP = 1.0;
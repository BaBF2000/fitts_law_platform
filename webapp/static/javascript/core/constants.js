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
 * Defines stable default and fallback values shared across the application.
 *
 * Important:
 * These constants represent baseline constraints used by the frontend.
 * Runtime-editable constraint values are handled in adminSettings.js and may
 * override selected defaults during experiment design or validation.
 *
 * Design rule:
 * Keep only application-wide constants here. Feature-specific constants should
 * stay close to the module that uses them.
 */

/* -------------------------------------------------------------------------- */
/* Touch model                                                                */
/* -------------------------------------------------------------------------- */

// Default visible touch diameter used when no participant-specific
// touchability measurement is available.
export const DEFAULT_TOUCH_DIAMETER_PX = 40;

// Safety multiplier used to derive conservative target-size constraints from
// the estimated finger contact diameter.
export const TOUCH_SAFETY_FACTOR = 3;

// Step size used when sampling overlap/geometry points for touch validation.
export const OVERLAP_SAMPLE_STEP_PX = 2;

/* -------------------------------------------------------------------------- */
/* Target constraints                                                         */
/* -------------------------------------------------------------------------- */

// Minimum target size that should remain visually selectable.
export const MIN_VISIBLE_TARGET_PX = 24;

// Maximum target size relative to the limiting viewport dimension.
export const MAX_TARGET_SIZE_RATIO = 0.25;

// Margin used to keep generated targets away from viewport edges.
export const VIEWPORT_TARGET_MARGIN_PX = 10;

/* -------------------------------------------------------------------------- */
/* Amplitude constraints                                                      */
/* -------------------------------------------------------------------------- */

// Minimum distance margin used when validating planned target amplitudes.
export const MIN_AMPLITUDE_MARGIN_PX = 10;

/* -------------------------------------------------------------------------- */
/* Validation defaults                                                        */
/* -------------------------------------------------------------------------- */

// Default required overlap ratio between touch area and target area.
// 1.0 means that the configured validation expects full required overlap.
export const DEFAULT_REQUIRED_OVERLAP = 1.0;
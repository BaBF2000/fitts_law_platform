// Default touch diameter used when the device/browser cannot provide
// a reliable touch contact size.
export const DEFAULT_TOUCH_DIAMETER_PX = 40;

// Minimum visual target size to keep targets visible and usable,
// even when computed target widths are very small.
export const MIN_VISIBLE_TARGET_PX = 24;

// Safety multiplier used to derive minimum target sizes from the
// measured or fallback touch diameter.
export const TOUCH_SAFETY_FACTOR = 3;

// Sampling step used when estimating geometric overlap between
// the touch area and the target shape.
export const OVERLAP_SAMPLE_STEP_PX = 2;

// Default required overlap ratio between the touch area and target.
// 1.0 means 100% overlap, 0.9 means 90%, and so on.
export const DEFAULT_REQUIRED_OVERLAP = 1.0;

export const MAX_TARGET_SIZE_RATIO = 0.25;
export const MIN_AMPLITUDE_MARGIN_PX = 10;
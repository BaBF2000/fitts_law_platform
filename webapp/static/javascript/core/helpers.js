/**
 * Core helper facade.
 *
 * Organigram reference:
 * - Core Utilities
 *   → DOM Access
 *   → Math Helpers
 *   → Fitts Formula
 *   → Unit Conversion
 *   → Target Placement
 *   → CSV Export
 *   → Runtime Device Helpers
 *
 * Responsibility:
 * This file is a central export facade for low-level helper modules.
 *
 * Important:
 * Most implementation logic should live in specialized files such as:
 * - fitts_equations.js
 * - viewport.js
 * - units.js
 * - csv_export.js
 * - inputParsing.js
 * - math.js
 * - placement.js
 * - time.js
 * - fullscreen.js
 *
 * This allows older imports such as:
 *
 *   import { computeID, toCSV } from "../core/helpers.js";
 *
 * to keep working while the real implementation remains modular.
 *
 * Extension guide:
 * - To add a new Fitts formula: edit fitts_equations.js.
 * - To add a new unit mode: edit units.js.
 * - To change CSV escaping: edit csv_export.js.
 * - To change placement rules: edit placement.js.
 * - To change fullscreen/wake-lock behavior: edit fullscreen.js.
 */

// Re-export low-level helper functions from specialized utility modules.
// This keeps older imports stable while implementation details stay modular.

export {
  computeID,
  computeWFromID,
  computeAFromWAndID,
} from "./utils/fitts_equations.js";

export {
  getViewportSize,
} from "./utils/viewport.js";

export {
  convertToPxAndMm,
} from "./utils/units.js";

export {
  toCSV,
} from "./utils/csv_export.js";

export {
  parseNumberOrList,
} from "./utils/inputParsing.js";

export {
  clamp,
  uniform01,
} from "./utils/math.js";

export {
  placeTarget,
} from "./utils/placement.js";

export {
  nowMs,
  isoNow,
} from "./utils/time.js";

export {
  requestFullscreenSafe,
  setFullscreenEnforcement,
  lockOrientationIfPossible,
  unlockOrientationIfPossible,
  setWakeLock,
} from "./utils/fullscreen.js";

/**
 * Return a DOM element by ID.
 *
 * Args:
 *   id: Element ID without the leading "#".
 *
 * Returns:
 *   HTMLElement | null: Matching DOM element, or null if the element does not
 *   exist in the current document.
 *
 * Side effects:
 *   None. This helper only reads from the DOM.
 *
 * Related usage:
 *   Used mainly by core/dom.js to build the centralized DOM registry.
 */
export const $ = (id) => document.getElementById(id);
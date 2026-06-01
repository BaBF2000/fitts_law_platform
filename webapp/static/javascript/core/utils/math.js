/**
 * Generic math utilities.
 *
 * Organigram reference:
 * - Core Utilities
 *   → Math Helpers
 */

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function uniform01() {
  return Math.random();
}
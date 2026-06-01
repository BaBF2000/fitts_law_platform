/**
 * Time utilities.
 *
 * Organigram reference:
 * - Experiment Runtime
 *   → Timing
 *   → Movement Time Measurement
 *
 * Responsibility:
 * Provides consistent timing functions used throughout the application.
 */

export function nowMs() {
  return performance.now();
}

export function isoNow() {
  return new Date().toISOString();
}
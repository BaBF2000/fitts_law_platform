/**
 * Time utilities.
 *
 * Organigram reference:
 * - Experiment Runtime
 *   → Timing
 *   → Movement Time Measurement
 * - Persistence Layer
 *   → Timestamp Metadata
 *
 * Responsibility:
 * Provides consistent timing functions used throughout the application.
 *
 * Important:
 * Use nowMs() for measuring durations such as movement time.
 * Use isoNow() for absolute timestamps stored with sessions, trials or logs.
 */

/**
 * Return a high-resolution monotonic timestamp.
 *
 * Returns:
 *   Current time in milliseconds from performance.now().
 *
 * Side effects:
 *   None.
 *
 * Usage:
 *   Use this for movement time and runtime duration measurements.
 *
 * Notes:
 *   performance.now() is relative to the current browsing context and is better
 *   suited for duration measurements than Date.now().
 */
export function nowMs() {
  return performance.now();
}

/**
 * Return the current absolute time as an ISO timestamp.
 *
 * Returns:
 *   UTC timestamp string in ISO 8601 format.
 *
 * Side effects:
 *   None.
 *
 * Usage:
 *   Use this for metadata such as savedAt, startedAt or exported timestamps.
 *
 * Notes:
 *   This should not be used to measure movement time because system clock
 *   adjustments could affect Date-based timestamps.
 */
export function isoNow() {
  return new Date().toISOString();
}
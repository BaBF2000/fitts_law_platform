/**
 * Touchability storage.
 *
 * Organigram reference:
 * - Core Storage
 *   → Participant Touchability Storage
 * - Touchability
 *   → Finger Contact Model
 *
 * Responsibility:
 * Stores participant-specific touch/finger contact measurements.
 *
 * Important:
 * Touchability is participant-specific, therefore it is stored separately
 * from global calibration data.
 */

// localStorage key prefix for participant-specific touchability measurements.
// The participant ID is appended after sanitization.
const TOUCHABILITY_KEY_PREFIX = "fitts_touchability_v1_";

/**
 * Build the localStorage key for a participant-specific touchability entry.
 *
 * Args:
 *   participantId: Participant identifier entered in the setup screen.
 *
 * Returns:
 *   Sanitized localStorage key for the participant. Empty IDs fall back to
 *   "anonymous".
 *
 * Side effects:
 *   None.
 *
 * Notes:
 *   The participant ID is sanitized to avoid spaces or special characters in
 *   localStorage keys.
 */
function participantTouchKey(participantId) {
  const safe =
    (participantId || "anonymous")
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "_");

  return `${TOUCHABILITY_KEY_PREFIX}${safe}`;
}

/**
 * Save participant-specific touchability data to localStorage.
 *
 * Args:
 *   participantId: Participant identifier used to namespace the stored entry.
 *   data: Touchability measurement data, such as finger/touch diameter in px
 *     and/or mm.
 *
 * Returns:
 *   Payload object that was stored, including participantId, savedAt and
 *   version metadata.
 *
 * Side effects:
 *   Writes the participant-specific touchability payload to localStorage.
 *
 * Important:
 *   Touchability is stored per participant because finger contact size can
 *   differ between users.
 */
export function saveTouchabilityForParticipant(
  participantId,
  data
) {
  const payload = {
    ...data,
    participantId: participantId || null,
    savedAt: new Date().toISOString(),
    version: 1,
  };

  try {
    localStorage.setItem(
      participantTouchKey(participantId),
      JSON.stringify(payload)
    );
  } catch {
    // Ignore persistence failures and still return the created payload.
  }

  return payload;
}

/**
 * Load participant-specific touchability data from localStorage.
 *
 * Args:
 *   participantId: Participant identifier used to find the stored entry.
 *
 * Returns:
 *   Stored touchability payload, or null if no entry exists or parsing fails.
 *
 * Side effects:
 *   Reads from localStorage.
 *
 * Failure behavior:
 *   Invalid JSON, unavailable localStorage or missing entries are handled by
 *   returning null.
 */
export function loadTouchabilityForParticipant(participantId) {
  try {
    const raw =
      localStorage.getItem(
        participantTouchKey(participantId)
      );

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Remove participant-specific touchability data from localStorage.
 *
 * Args:
 *   participantId: Participant identifier whose touchability entry should be
 *     removed.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Removes one participant-specific entry from localStorage.
 */
export function clearTouchabilityForParticipant(participantId) {
  try {
    localStorage.removeItem(
      participantTouchKey(participantId)
    );
  } catch {
    // Ignore persistence failures.
  }
}
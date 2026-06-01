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

const TOUCHABILITY_KEY_PREFIX =
  "fitts_touchability_v1_";

function participantTouchKey(participantId) {
  const safe =
    (participantId || "anonymous")
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "_");

  return `${TOUCHABILITY_KEY_PREFIX}${safe}`;
}

export function saveTouchabilityForParticipant(
  participantId,
  data
) {
  const payload = {
    ...data,
    participantId:
      participantId || null,
    savedAt:
      new Date().toISOString(),
    version:
      1,
  };

  localStorage.setItem(
    participantTouchKey(participantId),
    JSON.stringify(payload)
  );

  return payload;
}

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

export function clearTouchabilityForParticipant(participantId) {
  localStorage.removeItem(
    participantTouchKey(participantId)
  );
}
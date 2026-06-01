/**
 * Participant/session ID hint helpers.
 *
 * Organigram reference:
 * - Experiment Setup
 *   → Participant / Session IDs
 *   → Backend Availability Check
 *
 * Responsibility:
 * Checks whether participant and session IDs already exist in the database
 * and updates the start-screen hint labels.
 *
 * Important:
 * Network failures must not block local experiment setup.
 */

export function setupIdHints({
  dom,
  onParticipantChanged,
}) {
  let hintTimer = null;

  function scheduleHintRefresh() {
    clearTimeout(hintTimer);

    hintTimer =
      setTimeout(
        () => refreshIdHints(dom),
        250
      );
  }

  dom.participantId?.addEventListener(
    "input",
    scheduleHintRefresh
  );

  dom.sessionId?.addEventListener(
    "input",
    scheduleHintRefresh
  );

  dom.participantId?.addEventListener(
    "change",
    () => {
      onParticipantChanged?.();
    }
  );

  refreshIdHints(dom);
}

export async function refreshIdHints(dom) {
  const participantHintRow =
    document.getElementById("participantHintRow");

  const sessionHintRow =
    document.getElementById("sessionHintRow");

  const participantHintText =
    participantHintRow?.querySelector(".hintText");

  const sessionHintText =
    sessionHintRow?.querySelector(".hintText");

  const participantId =
    dom.participantId?.value?.trim() || "";

  const sessionId =
    dom.sessionId?.value?.trim() || "";

  if (!participantId && !sessionId) {
    hideHint(participantHintRow, participantHintText);
    hideHint(sessionHintRow, sessionHintText);
    return;
  }

  try {
    const response =
      await fetch(
        `/check_ids?participant_id=${encodeURIComponent(participantId)}&session_id=${encodeURIComponent(sessionId)}`
      );

    const data =
      await response.json();

    if (!data?.ok) {
      return;
    }

    setHint(
      participantHintRow,
      participantHintText,
      data.participant_exists,
      " Teilnehmer existiert bereits in der Datenbank."
    );

    setHint(
      sessionHintRow,
      sessionHintText,
      data.session_exists,
      "Diese Versuch-ID existiert bereits für diesen Teilnehmer."
    );

    if (dom.buttonStart) {
      dom.buttonStart.disabled =
        !!data.session_exists;
    }
  } catch {
    // Network issues should not block local experiment setup.
  }
}

function setHint(
  row,
  text,
  visible,
  message
) {
  if (!row || !text) return;

  row.style.display =
    visible ? "flex" : "none";

  text.textContent =
    visible ? message : "";
}

function hideHint(row, text) {
  setHint(row, text, false, "");
}
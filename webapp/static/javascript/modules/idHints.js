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

/**
 * Register input/change handlers for participant and session ID hints.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   onParticipantChanged: Optional callback called when the participant ID
 *     changes.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Registers event listeners on participantId and sessionId inputs.
 *   Triggers an initial backend availability check.
 *
 * Behavior:
 *   - Participant/session ID hints are refreshed with a short debounce.
 *   - Participant change can trigger external logic, such as reloading
 *     participant-specific touchability data.
 *
 * Important:
 *   The debounce prevents a backend request on every single keystroke.
 */
export function setupIdHints({
  dom,
  onParticipantChanged,
}) {
  // Timer used to debounce backend checks while the user types.
  let hintTimer = null;

  /**
   * Schedule a delayed refresh of participant/session availability hints.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Clears any pending hint refresh and starts a new timeout.
   */
  function scheduleHintRefresh() {
    clearTimeout(hintTimer);

    hintTimer =
      setTimeout(
        () => refreshIdHints(dom),
        250
      );
  }

  // Refresh hints while the participant ID is edited.
  dom.participantId?.addEventListener(
    "input",
    scheduleHintRefresh
  );

  // Refresh hints while the session ID is edited.
  dom.sessionId?.addEventListener(
    "input",
    scheduleHintRefresh
  );

  // Notify other modules when the participant changes.
  // Example: participant-specific touchability values may need to be reloaded.
  dom.participantId?.addEventListener(
    "change",
    () => {
      onParticipantChanged?.();
    }
  );

  // Initial check when the setup screen is initialized.
  refreshIdHints(dom);
}

/**
 * Refresh participant/session availability hints from the backend.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *
 * Returns:
 *   Promise<void>.
 *
 * Side effects:
 *   Sends a GET request to /check_ids, updates hint labels and may disable the
 *   start button when the session ID already exists.
 *
 * Backend response expectation:
 *   {
 *     ok: boolean,
 *     participant_exists: boolean,
 *     session_exists: boolean
 *   }
 *
 * Failure behavior:
 *   Network or backend failures are ignored so local experiment setup remains
 *   possible.
 *
 * Important:
 *   A duplicate session ID disables the start button to prevent overwriting or
 *   confusing already stored experiment data.
 */
export async function refreshIdHints(dom) {
  // Hint rows are queried directly because they are small setup-screen labels.
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

  // If both fields are empty, no backend check is needed and all hints are
  // hidden.
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

    // Show whether the participant already exists in the database.
    setHint(
      participantHintRow,
      participantHintText,
      data.participant_exists,
      " Teilnehmer existiert bereits in der Datenbank."
    );

    // Show whether the session ID already exists for this participant.
    setHint(
      sessionHintRow,
      sessionHintText,
      data.session_exists,
      "Diese Versuch-ID existiert bereits für diesen Teilnehmer."
    );

    // Prevent starting a run if the same participant/session combination already
    // exists in the database.
    if (dom.buttonStart) {
      dom.buttonStart.disabled =
        !!data.session_exists;
    }
  } catch {
    // Network issues should not block local experiment setup.
  }
}

/**
 * Show or hide one hint row and update its text.
 *
 * Args:
 *   row: Hint row DOM element.
 *   text: Text element inside the hint row.
 *   visible: Whether the hint should be visible.
 *   message: Message shown when visible is true.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates display style and text content.
 *
 * Important:
 *   UI text is German by design.
 */
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

/**
 * Hide one hint row.
 *
 * Args:
 *   row: Hint row DOM element.
 *   text: Text element inside the hint row.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Delegates to setHint() to hide the row and clear the text.
 */
function hideHint(row, text) {
  setHint(row, text, false, "");
}
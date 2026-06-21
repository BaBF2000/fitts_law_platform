/**
 * Export and backend save handlers.
 *
 * Organigram reference:
 * - Persistence Layer
 *   → CSV Export
 *   → Backend Session Save
 *
 * Responsibility:
 * Wires local CSV download and backend result saving actions.
 *
 * This module connects:
 * - local result export as CSV
 * - backend persistence of the completed session
 *
 * Important:
 * The actual CSV generation is handled by the experiment runtime.
 * The actual backend request is handled by core/server.js.
 */

 /**
  * Register export and backend-save button handlers.
  *
  * Args:
  *   dom: Centralized DOM reference object from getDom().
  *   state: Shared application state containing save status and session data.
  *   server: Backend communication layer, expected to provide sendResultsToPC().
  *   exp: Experiment runtime controller, expected to provide downloadCSV().
  *
  * Returns:
  *   undefined.
  *
  * Side effects:
  *   Registers click handlers for local CSV download and backend result saving.
  *
  * Responsibility:
  *   This function links persistence-related UI buttons to the runtime and
  *   backend save workflows.
  */
export function setupExportHandlers({
  dom,
  state,
  server,
  exp,
}) {
  /**
   * Download the current experiment results as a local CSV file.
   *
   * Side effects:
   *   Delegates CSV generation and browser download to exp.downloadCSV().
   *
   * Important:
   *   This is a local export only. It does not save data to the backend.
   */
  dom.btnDownload?.addEventListener("click", () => {
    exp.downloadCSV();
  });

  /**
   * Save the completed experiment session to the backend database.
   *
   * Side effects:
   *   Disables the save button while saving, sends result data to the backend,
   *   updates saved state fields and changes UI labels after success.
   *
   * Failure behavior:
   *   If saving fails, the save button is re-enabled and a German error alert is
   *   shown to the user.
   *
   * Important:
   *   A session can only be saved once from the UI. The state.savedToPC guard
   *   prevents duplicate backend submissions.
   */
  dom.btnSaveServer?.addEventListener("click", async () => {
    if (state.savedToPC) {
      alert("Diese Sitzung wurde bereits gespeichert.");
      return;
    }

    const button =
      dom.btnSaveServer;

    // Disable the button immediately to prevent double-click submissions.
    if (button) {
      button.disabled = true;
    }

    try {
      const response =
        await server.sendResultsToPC(dom, state);

      // Mark the session as saved in runtime state.
      state.savedToPC = true;

      // Store the backend session row ID when the server returns one.
      state.savedSessionRowId =
        response?.session_row_id ?? null;

      // Update save button state after successful persistence.
      if (button) {
        button.textContent = "Gespeichert";
        button.disabled = true;
      }

      // Show a compact saved status in the HUD.
      if (dom.hudLeft) {
        dom.hudLeft.textContent = "Gespeichert";
      }
    } catch (error) {
      // Re-enable saving if the backend request failed.
      if (button) {
        button.disabled = false;
      }

      alert(
        "Speichern fehlgeschlagen: " +
        (error?.message || error)
      );
    }
  });
}
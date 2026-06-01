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
 */

export function setupExportHandlers({
  dom,
  state,
  server,
  exp,
}) {
  dom.btnDownload?.addEventListener("click", () => {
    exp.downloadCSV();
  });

  dom.btnSaveServer?.addEventListener("click", async () => {
    if (state.savedToPC) {
      alert("Diese Sitzung wurde bereits gespeichert.");
      return;
    }

    const button =
      dom.btnSaveServer;

    if (button) {
      button.disabled = true;
    }

    try {
      const response =
        await server.sendResultsToPC(dom, state);

      state.savedToPC = true;
      state.savedSessionRowId =
        response?.session_row_id ?? null;

      if (button) {
        button.textContent = "Gespeichert";
        button.disabled = true;
      }

      if (dom.hudLeft) {
        dom.hudLeft.textContent = "Gespeichert";
      }
    } catch (error) {
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
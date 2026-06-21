/**
 * Protocol list controller.
 *
 * Organigram reference:
 * - Experiment Design
 *   → Protocol Management
 *   → Protocol List Controller
 *
 * Responsibility:
 * Loads saved protocols, renders the protocol list, and handles load/delete
 * actions from the protocol list UI.
 *
 * Important:
 * Protocol templates are loaded from SQLite only.
 * The old localStorage code is kept commented temporarily as migration reference.
 * Session snapshots remain independent from protocol templates.
 */

/*
 * Legacy localStorage protocol imports.
 *
 * These imports are currently disabled because reusable protocols are now
 * loaded from the backend SQLite database through core/server.js.
 *
 * Keep this block only as temporary migration reference. For a clean final
 * version, remove the legacy localStorage code once the SQLite workflow is
 * confirmed stable.
 */
/*
import {
  listProtocols,
  loadProtocolById,
  deleteProtocolById,
} from "../core/storage.js";
*/

import {
  applyProtocolObject,
  markProtocolStatus,
} from "./protocol.js";

import {
  showExperimentDesignEditor,
  hideProtocolList,
  renderEmptyProtocolList,
} from "./protocolManager.js";

/*
 * Legacy local protocol renderer.
 *
 * This function is currently disabled because protocol templates are no longer
 * rendered from localStorage. Database-backed protocols are rendered by
 * renderDbProtocolItem().
 */
/*
function renderLocalProtocolItem(protocol) {
  return `
    <div class="protocolItem" data-source="local" data-id="${protocol.id}">
      <div>
        <b>${protocol.protocol_name ?? protocol.name ?? "Unbenanntes Protokoll"}</b>
        <div class="muted">
          Lokal · ${protocol.savedAt ? new Date(protocol.savedAt).toLocaleString("de-DE") : "—"}
          · ${protocol.sessionBlocks?.length ?? 0} Blöcke
        </div>
        ${protocol.protocol_comment ? `<div class="muted">${protocol.protocol_comment}</div>` : ""}
      </div>

      <div class="row">
        <button type="button" data-action="load-local" data-id="${protocol.id}">Laden</button>
        <button type="button" data-action="delete-local" data-id="${protocol.id}">Löschen</button>
      </div>
    </div>
  `;
}
*/

/**
 * Render one SQLite-backed protocol list item.
 *
 * Args:
 *   protocol: Protocol row returned by the backend API.
 *
 * Returns:
 *   HTML string representing one protocol item with load/delete buttons.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   The stored protocol_json is parsed only to display additional metadata,
 *   such as the number of session blocks. If parsing fails, the item is still
 *   rendered with unknown block count.
 *
 * Important:
 *   UI text is German by design.
 */
function renderDbProtocolItem(protocol) {
  let parsed = null;

  try {
    parsed = JSON.parse(protocol.protocol_json || "{}");
  } catch {
    parsed = null;
  }

  return `
    <div class="protocolItem" data-source="db" data-id="${protocol.id}">
      <div>
        <b>${protocol.protocol_name ?? "Unbenanntes Protokoll"}</b>
        <div class="muted">
          SQLite · ${protocol.updated_at ? new Date(protocol.updated_at).toLocaleString("de-DE") : "—"}
          · ${parsed?.sessionBlocks?.length ?? "?"} Blöcke
        </div>
        ${protocol.protocol_comment ? `<div class="muted">${protocol.protocol_comment}</div>` : ""}
      </div>

      <div class="row">
        <button type="button" data-action="load-db" data-id="${protocol.id}">Laden</button>
        <button type="button" data-action="delete-db" data-id="${protocol.id}">Löschen</button>
      </div>
    </div>
  `;
}

/**
 * Load protocols from the backend and render the protocol list UI.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   sessionDesign: Session design editor API used when applying a protocol.
 *   server: Backend communication layer, expected to provide
 *     loadProtocolsFromDB() and deleteProtocolFromDB().
 *
 * Returns:
 *   Promise<void>.
 *
 * Side effects:
 *   Loads protocol templates from the backend, replaces protocolListBox.innerHTML
 *   and registers button handlers for rendered protocol actions.
 *
 * Failure behavior:
 *   If backend loading fails, the protocol list is rendered as empty.
 *
 * Important:
 *   Protocol templates are reusable definitions. Loading a protocol into the
 *   editor does not modify already saved experiment sessions, because sessions
 *   store their own protocol snapshots.
 */
export async function renderProtocolList({
  dom,
  state,
  sessionDesign,
  server,
}) {
  if (!dom.protocolListBox) return;

  /*
   * Legacy local protocol loading.
   *
   * Disabled because SQLite is now the main persistence path.
   */
  /*
  const localProtocols =
    listProtocols();
  */

  let dbProtocols = [];

  try {
    dbProtocols =
      await server.loadProtocolsFromDB();
  } catch {
    // Treat backend load errors as an empty list so the UI remains usable.
    dbProtocols = [];
  }

  /*
   * Legacy condition with localStorage protocols.
   *
   * Disabled because only database protocols are currently rendered.
   */
  /*
  if (!localProtocols.length && !dbProtocols.length) {
  */
  if (!dbProtocols.length) {
    renderEmptyProtocolList(dom);
    return;
  }

  /*
   * Legacy localStorage HTML rendering.
   */
  /*
  const localHtml =
    localProtocols
      .map(renderLocalProtocolItem)
      .join("");
  */

  const dbHtml =
    dbProtocols
      .map(renderDbProtocolItem)
      .join("");

  /*
   * Legacy mixed local/database list rendering.
   */
  /*
  dom.protocolListBox.innerHTML = `
    ${localProtocols.length ? `<p class="muted"><b>Lokale Protokolle</b></p>${localHtml}` : ""}
    ${dbProtocols.length ? `<p class="muted"><b>Datenbank-Protokolle</b></p>${dbHtml}` : ""}
  `;
  */

  // Render only SQLite-backed protocol templates.
  dom.protocolListBox.innerHTML = `
    ${dbProtocols.length ? `<p class="muted"><b>Datenbank-Protokolle</b></p>${dbHtml}` : ""}
  `;

  bindProtocolListActions({
    dom,
    state,
    sessionDesign,
    server,
    dbProtocols,
  });
}

/**
 * Register click handlers for protocol list action buttons.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   sessionDesign: Session design editor API.
 *   server: Backend communication layer.
 *   dbProtocols: Protocol rows currently rendered in the list.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Attaches click listeners to all rendered protocol action buttons.
 *
 * Behavior:
 *   Buttons are dispatched by their data-action attribute:
 *   - load-db: load a protocol template into the editor
 *   - delete-db: delete a protocol template from the database
 */
function bindProtocolListActions({
  dom,
  state,
  sessionDesign,
  server,
  dbProtocols,
}) {
  dom.protocolListBox
    ?.querySelectorAll("button[data-action]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const id =
          button.dataset.id;

        const action =
          button.dataset.action;

        /*
         * Legacy localStorage actions.
         *
         * Disabled because database-backed protocols are now the active workflow.
         */
        /*
        if (action === "load-local") {
          handleLoadLocal({
            id,
            dom,
            state,
            sessionDesign,
          });
        }

        if (action === "delete-local") {
          handleDeleteLocal({
            id,
            dom,
            state,
            sessionDesign,
            server,
          });
        }
        */

        if (action === "load-db") {
          handleLoadDb({
            id,
            dom,
            state,
            sessionDesign,
            dbProtocols,
          });
        }

        if (action === "delete-db") {
          await handleDeleteDb({
            id,
            dom,
            state,
            sessionDesign,
            server,
          });
        }
      });
    });
}

/*
 * Legacy localStorage protocol loading.
 *
 * Disabled because protocol templates are now loaded from SQLite.
 */
/*
function handleLoadLocal({
  id,
  dom,
  state,
  sessionDesign,
}) {
  const protocol =
    loadProtocolById(id);

  if (!protocol) {
    alert("Lokales Protokoll nicht gefunden.");
    return;
  }

  applyProtocolObject(
    protocol,
    dom,
    state,
    sessionDesign
  );

  hideProtocolList(dom);
  showExperimentDesignEditor(dom);
  markProtocolStatus(dom, state, true);

  alert("Lokales Protokoll geladen.");
}
*/

/*
 * Legacy localStorage protocol deletion.
 *
 * Disabled because protocol templates are now deleted through the backend API.
 */
/*
function handleDeleteLocal({
  id,
  dom,
  state,
  sessionDesign,
  server,
}) {
  deleteProtocolById(id);

  renderProtocolList({
    dom,
    state,
    sessionDesign,
    server,
  });

  alert("Lokales Protokoll gelöscht.");
}
*/

/**
 * Load one SQLite-backed protocol template into the experiment design editor.
 *
 * Args:
 *   id: Database protocol ID from the clicked list button.
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   sessionDesign: Session design editor API.
 *   dbProtocols: Protocol rows currently available in the rendered list.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Parses protocol JSON, applies it to the editor/state, hides the protocol
 *   list, shows the experiment design editor, updates protocol status and shows
 *   a user-facing alert.
 *
 * Failure behavior:
 *   Shows a German alert if the protocol cannot be found or parsed.
 *
 * Important:
 *   Loading a protocol only updates the editable protocol draft. The actual
 *   session snapshot is created later when the experiment run starts.
 */
function handleLoadDb({
  id,
  dom,
  state,
  sessionDesign,
  dbProtocols,
}) {
  const item =
    dbProtocols.find(
      (protocol) =>
        String(protocol.id) === String(id)
    );

  if (!item) {
    alert("Datenbank-Protokoll nicht gefunden.");
    return;
  }

  let protocol = null;

  try {
    protocol =
      JSON.parse(item.protocol_json || "{}");
  } catch {
    alert("Datenbank-Protokoll konnte nicht gelesen werden.");
    return;
  }

  applyProtocolObject(
    protocol,
    dom,
    state,
    sessionDesign
  );

  hideProtocolList(dom);
  showExperimentDesignEditor(dom);
  markProtocolStatus(dom, state, true);

  alert("Datenbank-Protokoll geladen.");
}

/**
 * Delete one SQLite-backed protocol template.
 *
 * Args:
 *   id: Database protocol ID from the clicked list button.
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared application state.
 *   sessionDesign: Session design editor API.
 *   server: Backend communication layer, expected to provide deleteProtocolFromDB().
 *
 * Returns:
 *   Promise<void>.
 *
 * Side effects:
 *   Shows a confirmation dialog, sends a DELETE request through the backend
 *   communication layer, re-renders the protocol list and shows user-facing
 *   success/error alerts.
 *
 * Failure behavior:
 *   If deletion fails, a German alert displays the backend or JavaScript error
 *   message.
 *
 * Important:
 *   Deleting a reusable protocol template must not delete already saved
 *   experiment sessions, because sessions store independent snapshots.
 */
async function handleDeleteDb({
  id,
  dom,
  state,
  sessionDesign,
  server,
}) {
  if (!confirm("Datenbank-Protokoll wirklich löschen?")) {
    return;
  }

  try {
    await server.deleteProtocolFromDB(id);

    await renderProtocolList({
      dom,
      state,
      sessionDesign,
      server,
    });

    alert("Datenbank-Protokoll gelöscht.");
  } catch (err) {
    alert(
      "Löschen fehlgeschlagen: " +
      (err?.message || err)
    );
  }
}
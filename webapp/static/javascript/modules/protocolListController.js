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

/*import {
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

export async function renderProtocolList({
  dom,
  state,
  sessionDesign,
  server,
}) {
  if (!dom.protocolListBox) return;

/*  const localProtocols =
    listProtocols();
*/

  let dbProtocols = [];

  try {
    dbProtocols =
      await server.loadProtocolsFromDB();
  } catch {
    dbProtocols = [];
  }

//  if (!localProtocols.length && !dbProtocols.length) {
  if ( !dbProtocols.length) {
    renderEmptyProtocolList(dom);
    return;
  }

/*  const localHtml =
    localProtocols
      .map(renderLocalProtocolItem)
      .join("");
*/

  const dbHtml =
    dbProtocols
      .map(renderDbProtocolItem)
      .join("");

/*  dom.protocolListBox.innerHTML = `
    ${localProtocols.length ? `<p class="muted"><b>Lokale Protokolle</b></p>${localHtml}` : ""}
    ${dbProtocols.length ? `<p class="muted"><b>Datenbank-Protokolle</b></p>${dbHtml}` : ""}
  `;
*/
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
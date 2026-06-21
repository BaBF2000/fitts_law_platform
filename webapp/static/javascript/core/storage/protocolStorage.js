/**
 * Local protocol storage.
 *
 * Organigram reference:
 * - Core Storage
 *   → Protocol Storage
 * - Experiment Design
 *   → Protocol Persistence
 *
 * Responsibility:
 * Stores protocol definitions in localStorage.
 *
 * Current status:
 * This module is kept as a local/legacy persistence layer. The main protocol
 * persistence path is handled through the backend API in core/server.js.
 *
 * Important:
 * Experiment session snapshots are stored separately when results are saved.
 * A saved session must remain reproducible even if the reusable protocol
 * template is later edited or deleted.
 */

// localStorage key for locally stored protocol templates.
// Version suffix allows future migration if the stored structure changes.
const PROTOCOL_KEY = "fitts_protocol_v1";

/**
 * Create a local protocol identifier.
 *
 * Returns:
 *   String ID based on the current timestamp and a random suffix.
 *
 * Side effects:
 *   Uses Date.now() and Math.random().
 *
 * Notes:
 *   This ID is only intended for localStorage protocol entries. Backend-stored
 *   protocols use database IDs instead.
 */
function makeProtocolId() {
  return `protocol_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
}

/**
 * Load all locally stored protocol templates.
 *
 * Returns:
 *   Array of protocol objects. Returns an empty array if no local protocols
 *   exist, if parsing fails, or if the stored structure is invalid.
 *
 * Side effects:
 *   Reads from localStorage.
 *
 * Compatibility behavior:
 *   Older versions may have stored a single protocol object instead of an array.
 *   If such an object contains sessionBlocks, it is wrapped in an array.
 */
export function listProtocols() {
  try {
    const raw =
      localStorage.getItem(PROTOCOL_KEY);

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return parsed?.sessionBlocks
        ? [parsed]
        : [];
    }

    return parsed;
  } catch {
    return [];
  }
}

/**
 * Save or update a local protocol template.
 *
 * Args:
 *   data: Protocol object created by the experiment design UI.
 *
 * Returns:
 *   Saved protocol payload including id, protocol_name, protocol_comment,
 *   savedAt and version.
 *
 * Side effects:
 *   Writes the updated protocol list to localStorage.
 *
 * Behavior:
 *   If data.id already exists, the protocol is replaced. Otherwise, a new local
 *   ID is generated. The saved protocol is moved to the beginning of the list.
 *
 * Compatibility:
 *   Supports multiple naming fields such as protocol_name, protocolName and
 *   name to handle older protocol objects.
 */
export function saveProtocol(data) {
  const protocols =
    listProtocols();

  const protocolName =
    data.protocol_name ||
    data.protocolName ||
    data.name ||
    `Protokoll ${new Date().toLocaleString("de-DE")}`;

  const protocolComment =
    data.protocol_comment ||
    data.protocolComment ||
    data.comment ||
    "";

  const payload = {
    ...data,

    id:
      data.id ||
      makeProtocolId(),

    protocol_name:
      protocolName,

    protocol_comment:
      protocolComment,

    name:
      protocolName,

    savedAt:
      new Date().toISOString(),

    version:
      2,
  };

  const updated = [
    payload,
    ...protocols.filter(
      (p) => p.id !== payload.id
    ),
  ];

  localStorage.setItem(
    PROTOCOL_KEY,
    JSON.stringify(updated)
  );

  return payload;
}

/**
 * Load the most recently saved local protocol.
 *
 * Returns:
 *   First protocol from listProtocols(), or null if no local protocol exists.
 *
 * Side effects:
 *   Reads from localStorage through listProtocols().
 */
export function loadProtocol() {
  return listProtocols()[0] ?? null;
}

/**
 * Load one local protocol by its local ID.
 *
 * Args:
 *   id: Local protocol identifier.
 *
 * Returns:
 *   Matching protocol object, or null if no protocol with this ID exists.
 *
 * Side effects:
 *   Reads from localStorage through listProtocols().
 */
export function loadProtocolById(id) {
  return (
    listProtocols().find(
      (p) => p.id === id
    ) ?? null
  );
}

/**
 * Delete one local protocol by its local ID.
 *
 * Args:
 *   id: Local protocol identifier.
 *
 * Returns:
 *   Updated protocol list after deletion.
 *
 * Side effects:
 *   Writes the updated protocol list to localStorage.
 */
export function deleteProtocolById(id) {
  const updated =
    listProtocols().filter(
      (p) => p.id !== id
    );

  try {
    localStorage.setItem(
      PROTOCOL_KEY,
      JSON.stringify(updated)
    );
  } catch {
    // Ignore persistence failures.
  }

  return updated;
}

/**
 * Remove all locally stored protocol templates.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Removes the protocol storage entry from localStorage.
 */
export function clearProtocol() {
  localStorage.removeItem(
    PROTOCOL_KEY
  );
}
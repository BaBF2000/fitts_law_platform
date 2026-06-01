/**
 * Protocol storage.
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
 * Important:
 * This storage layer is temporary.
 * Protocols may later be migrated to the backend database while
 * experiment session snapshots remain stored separately.
 */

const PROTOCOL_KEY =
  "fitts_protocol_v1";

function makeProtocolId() {
  return `protocol_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
}

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

export function loadProtocol() {
  return listProtocols()[0] ?? null;
}

export function loadProtocolById(id) {
  return (
    listProtocols().find(
      (p) => p.id === id
    ) ?? null
  );
}

export function deleteProtocolById(id) {
  const updated =
    listProtocols().filter(
      (p) => p.id !== id
    );

  localStorage.setItem(
    PROTOCOL_KEY,
    JSON.stringify(updated)
  );

  return updated;
}

export function clearProtocol() {
  localStorage.removeItem(
    PROTOCOL_KEY
  );
}
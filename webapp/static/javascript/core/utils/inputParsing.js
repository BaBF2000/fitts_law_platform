/**
 * User input parsing utilities.
 *
 * Organigram reference:
 * - Experiment Design
 *   → Session Blocks
 *   → Parameter Input
 *
 * Responsibility:
 * Parses user-entered parameter values.
 *
 * Supported formats:
 * - single number: "0.5"
 * - JSON list: "[0.1, 0.3, 0.5]"
 */

export function parseNumberOrList(input) {
  const raw = (input ?? "").toString().trim();

  if (!raw) {
    return {
      kind: "invalid",
      values: [],
    };
  }

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const arr = JSON.parse(raw);

      if (!Array.isArray(arr) || arr.length === 0) {
        return {
          kind: "invalid",
          values: [],
        };
      }

      const values = arr
        .map(Number)
        .filter((v) => Number.isFinite(v) && v >= 0);

      return values.length
        ? { kind: "list", values }
        : { kind: "invalid", values: [] };
    } catch {
      return {
        kind: "invalid",
        values: [],
      };
    }
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    return {
      kind: "invalid",
      values: [],
    };
  }

  return {
    kind: "single",
    values: [value],
  };
}
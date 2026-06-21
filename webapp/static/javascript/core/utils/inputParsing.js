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

/**
 * Parse a user-entered numeric parameter field.
 *
 * Args:
 *   input: Raw user input from a form field. Supported formats are a single
 *     number such as "0.5" or a JSON array such as "[0.1, 0.3, 0.5]".
 *
 * Returns:
 *   Object with:
 *     - kind: "single", "list" or "invalid"
 *     - values: array of parsed numeric values
 *
 * Side effects:
 *   None.
 *
 * Validation:
 *   Only finite values greater than or equal to 0 are accepted. Empty input,
 *   invalid JSON, empty lists and negative values return kind="invalid".
 *
 * Notes:
 *   JSON list syntax is intentionally strict. For example, "[1, 2, 3]" is
 *   valid, while "1, 2, 3" is not treated as a list.
 */
export function parseNumberOrList(input) {
  // Normalize all input types to a trimmed string so form values, numbers and
  // null/undefined can be handled consistently.
  const raw = (input ?? "").toString().trim();

  if (!raw) {
    return {
      kind: "invalid",
      values: [],
    };
  }

  // JSON array input allows designers to define a discrete set of candidate
  // values for a parameter.
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const arr = JSON.parse(raw);

      if (!Array.isArray(arr) || arr.length === 0) {
        return {
          kind: "invalid",
          values: [],
        };
      }

      // Convert array entries to numbers and keep only finite non-negative values.
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

  // Fallback: interpret the input as a single numeric value.
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
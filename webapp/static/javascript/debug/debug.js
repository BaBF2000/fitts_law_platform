/**
 * Minimal debug overlay.
 *
 * Organigram reference:
 * - Debug Tools
 *   → Runtime Debug Overlay
 *
 * Responsibility:
 * Provides a lightweight on-screen debug console for development and testing.
 *
 * Features:
 * - Disabled by default.
 * - Safe to call when disabled: log calls become no-ops.
 * - Keeps only the last MAX_LINES messages in memory.
 * - Can be enabled manually, through URL query parameters, or with a hotkey.
 * - Can display strings, numbers, objects and Error instances.
 *
 * Important:
 * This module is intended for development/debugging.
 * It should not affect experiment logic, trial generation or result recording.
 */

/**
 * Whether the overlay is currently active.
 *
 * When disabled, log(), warn() and error() return immediately.
 */
let enabled = false;

/**
 * Maximum number of debug lines kept in memory.
 *
 * Older lines are removed when the limit is exceeded.
 */
const MAX_LINES = 120;

/**
 * Internal line buffer.
 *
 * Each entry is a formatted string containing timestamp, level and message.
 */
let lines = [];

/**
 * Overlay DOM element.
 *
 * null means the overlay is currently not attached to the document.
 */
let el = null;

/**
 * Whether the keyboard shortcut was already registered.
 *
 * This avoids registering the same keydown listener multiple times.
 */
let hotkeyBound = false;

/**
 * Build the CSS string used by the debug overlay.
 *
 * Returns:
 *   Inline CSS string.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Keeps ensureEl() shorter and makes the overlay style easier to inspect.
 */
function overlayCssText() {
  return [
    "position:fixed",
    "left:10px",
    "bottom:10px",
    "z-index:99999",
    "background:rgba(17,17,17,.92)",
    "color:#0f0",
    "padding:10px",
    "border-radius:10px",
    "font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    "max-width:92vw",
    "max-height:40vh",
    "overflow:auto",
    "white-space:pre-wrap",
    "box-shadow:0 8px 30px rgba(0,0,0,.35)",
    "user-select:text",
    "pointer-events:auto",
  ].join(";");
}

/**
 * Create the overlay DOM element if it does not already exist.
 *
 * Returns:
 *   The overlay DOM element, or null if document.body is not available.
 *
 * Side effects:
 *   May create and append the overlay to document.body.
 *
 * Behavior:
 *   Double-clicking the overlay disables and removes it.
 */
function ensureEl() {
  if (el) return el;

  if (!document.body) {
    return null;
  }

  el = document.createElement("div");
  el.id = "dbgOverlay";
  el.style.cssText = overlayCssText();

  // Allow quick hide by double-clicking the overlay itself.
  el.addEventListener("dblclick", () => setEnabled(false));

  document.body.appendChild(el);
  render();

  return el;
}

/**
 * Render the current debug line buffer into the overlay.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates overlay text content and scroll position.
 */
function render() {
  if (!el) return;

  el.textContent = lines.join("\n");
  el.scrollTop = el.scrollHeight;
}

/**
 * Convert any logged value into a safe string.
 *
 * Args:
 *   value: Any value passed to log(), warn() or error().
 *
 * Returns:
 *   String representation of the value.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   - Error objects use stack trace when available.
 *   - Objects are JSON-stringified when possible.
 *   - Circular or unsupported objects fall back to String(value).
 */
function formatValue(value) {
  if (value instanceof Error) {
    return value.stack || value.message;
  }

  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Format one debug line.
 *
 * Args:
 *   level: Message level, for example "log", "warn" or "error".
 *   args: Values passed by the caller.
 *
 * Returns:
 *   Formatted debug line string.
 *
 * Side effects:
 *   None.
 */
function formatLine(level, args) {
  const ts = new Date().toISOString().slice(11, 19);

  const msg = args
    .map(formatValue)
    .join(" ");

  return `[${ts}] [${level}] ${msg}`;
}

/**
 * Add one formatted line to the internal buffer.
 *
 * Args:
 *   line: Formatted debug line.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Mutates the internal lines array and trims old lines.
 */
function pushLine(line) {
  lines.push(line);

  if (lines.length > MAX_LINES) {
    lines = lines.slice(lines.length - MAX_LINES);
  }
}

/**
 * Check whether the debug overlay is currently enabled.
 *
 * Returns:
 *   true if enabled, otherwise false.
 *
 * Side effects:
 *   None.
 */
export function isEnabled() {
  return enabled;
}

/**
 * Enable or disable the debug overlay.
 *
 * Args:
 *   on: Boolean-like value. true enables the overlay, false disables it.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   May create, remove or update the overlay DOM element.
 *
 * Behavior:
 *   Disabling removes the overlay from the DOM but keeps the buffered lines in
 *   memory. Calling clear() is required to delete the lines.
 */
export function setEnabled(on) {
  const next = !!on;

  if (enabled === next) {
    return;
  }

  enabled = next;

  if (!enabled) {
    if (el) {
      el.remove();
    }

    el = null;
    return;
  }

  ensureEl();
  log("debug overlay enabled");
}

/**
 * Toggle the debug overlay state.
 *
 * Returns:
 *   New enabled state.
 *
 * Side effects:
 *   Enables or disables the overlay.
 */
export function toggleDebug() {
  setEnabled(!enabled);
  return enabled;
}

/**
 * Clear all debug lines.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Clears the internal buffer and refreshes the overlay when visible.
 */
export function clear() {
  lines = [];
  render();
}

/**
 * Return a copy of the current debug lines.
 *
 * Returns:
 *   Array of debug line strings.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Useful if another module wants to export or inspect the current debug log.
 */
export function getLines() {
  return [...lines];
}

/**
 * Write a normal debug message.
 *
 * Args:
 *   ...args: Values to display.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Appends one line to the overlay when debug is enabled.
 *
 * Important:
 *   If the overlay is disabled, this function does nothing.
 */
export function log(...args) {
  if (!enabled) return;

  pushLine(formatLine("log", args));

  ensureEl();
  render();
}

/**
 * Write a warning debug message.
 *
 * Args:
 *   ...args: Values to display.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Appends one warning line to the overlay when debug is enabled.
 */
export function warn(...args) {
  if (!enabled) return;

  pushLine(formatLine("warn", args));

  ensureEl();
  render();
}

/**
 * Write an error debug message.
 *
 * Args:
 *   ...args: Values to display.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Appends one error line to the overlay when debug is enabled.
 */
export function error(...args) {
  if (!enabled) return;

  pushLine(formatLine("error", args));

  ensureEl();
  render();
}

/**
 * Initialize optional debug overlay activation helpers.
 *
 * Args:
 *   options: Optional configuration object.
 *
 * Supported options:
 *   queryParam:
 *     URL parameter used to auto-enable debug mode.
 *     Default: "debug"
 *
 *   hotkey:
 *     Whether Ctrl+Shift+D should toggle the overlay.
 *     Default: true
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   May enable the overlay from the URL and may register a keyboard listener.
 *
 * Example:
 *   initDebugOverlay();
 *   // Enables overlay when URL contains ?debug=1
 */
export function initDebugOverlay({
  queryParam = "debug",
  hotkey = true,
} = {}) {
  const params = new URLSearchParams(location.search);

  if (params.get(queryParam) === "1") {
    setEnabled(true);
  }

  if (!hotkey || hotkeyBound) {
    return;
  }

  hotkeyBound = true;

  document.addEventListener("keydown", (event) => {
    const isToggle =
      event.ctrlKey &&
      event.shiftKey &&
      event.key.toLowerCase() === "d";

    if (!isToggle) return;

    event.preventDefault();
    toggleDebug();
  });
}
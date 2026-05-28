// Minimal debug overlay.
// - Disabled by default
// - Safe to call even when disabled (no-ops)
// - Keeps last N lines in memory

let enabled = false;

const MAX_LINES = 120;
let lines = [];
let el = null;

function ensureEl() {
  if (el) return el;

  el = document.createElement("div");
  el.id = "dbgOverlay";
  el.style.cssText =
    "position:fixed;left:10px;bottom:10px;z-index:99999;" +
    "background:rgba(17,17,17,.92);color:#0f0;padding:10px;border-radius:10px;" +
    "font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;" +
    "max-width:92vw;max-height:40vh;overflow:auto;white-space:pre-wrap;" +
    "box-shadow:0 8px 30px rgba(0,0,0,.35)";

  // Allow quick hide/show
  el.addEventListener("dblclick", () => setEnabled(false));
  document.body.appendChild(el);
  render();
  return el;
}

function render() {
  if (!el) return;
  el.textContent = lines.join("\n");
  el.scrollTop = el.scrollHeight;
}

export function isEnabled() {
  return enabled;
}

export function setEnabled(on) {
  enabled = !!on;

  if (!enabled) {
    if (el) el.remove();
    el = null;
    return;
  }

  ensureEl();
  log("debug overlay enabled");
}

export function toggleDebug() {
  setEnabled(!enabled);
  return enabled;
}

export function clear() {
  lines = [];
  render();
}

export function log(...args) {
  if (!enabled) return;

  const msg = args
    .map((x) => {
      if (x instanceof Error) return x.stack || x.message;
      if (typeof x === "object") {
        try { return JSON.stringify(x); } catch { return String(x); }
      }
      return String(x);
    })
    .join(" ");

  const ts = new Date().toISOString().slice(11, 19);
  lines.push(`[${ts}] ${msg}`);
  if (lines.length > MAX_LINES) lines = lines.slice(lines.length - MAX_LINES);

  ensureEl();
  render();
}
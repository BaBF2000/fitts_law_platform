/**
 * Session comment handlers.
 *
 * Organigram reference:
 * - Experiment Setup
 *   → Session Metadata
 *   → Optional Comment
 *
 * Responsibility:
 * Toggles the optional session comment input on the start screen.
 */

export function setupCommentToggle(dom) {
  dom.btnToggleSessionComment?.addEventListener("click", () => {
    if (!dom.sessionCommentBox) return;

    const open =
      dom.sessionCommentBox.style.display !== "none";

    dom.sessionCommentBox.style.display =
      open ? "none" : "block";

    dom.btnToggleSessionComment.textContent =
      open ? "+ Kommentar" : "− Kommentar";
  });
}
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
 *
 * Important:
 * This module only controls UI visibility for the optional session comment.
 * The comment value itself is read later when the experiment run starts.
 */

/**
 * Register the session-comment toggle button handler.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Registers a click event listener on btnToggleSessionComment.
 *
 * Behavior:
 *   - Shows the optional session comment box when it is hidden.
 *   - Hides the optional session comment box when it is visible.
 *   - Updates the button label accordingly.
 *
 * Important:
 *   UI text is German by design.
 */
export function setupCommentToggle(dom) {
  dom.btnToggleSessionComment?.addEventListener("click", () => {
    if (!dom.sessionCommentBox) return;

    // The box is considered open when its display value is not "none".
    const open =
      dom.sessionCommentBox.style.display !== "none";

    dom.sessionCommentBox.style.display =
      open ? "none" : "block";

    dom.btnToggleSessionComment.textContent =
      open ? "+ Kommentar" : "- Kommentar";
  });
}
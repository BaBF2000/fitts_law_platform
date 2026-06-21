/**
 * Protocol list view.
 *
 * Organigram reference:
 * - Experiment Design
 *   → Protocol Management
 *   → Protocol List View
 *
 * Responsibility:
 * Renders saved protocols and handles protocol list visibility.
 *
 * Important:
 * This module only updates simple protocol-management UI visibility and empty
 * states. Loading, saving and applying protocol data are handled by other
 * protocol modules.
 */

/**
 * Show the experiment design editor and its save button.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates display styles for the experiment design editor and save button.
 *
 * Related UI:
 *   Used when the user wants to create or edit a protocol design.
 */
export function showExperimentDesignEditor(dom) {
  if (dom.experimentDesignEditor) {
    dom.experimentDesignEditor.style.display = "block";
  }

  if (dom.btnSaveProtocol) {
    dom.btnSaveProtocol.style.display = "inline-block";
  }
}

/**
 * Hide the experiment design editor and its save button.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates display styles for the experiment design editor and save button.
 *
 * Related UI:
 *   Used when the protocol design editor should not be visible on the setup
 *   screen.
 */
export function hideExperimentDesignEditor(dom) {
  if (dom.experimentDesignEditor) {
    dom.experimentDesignEditor.style.display = "none";
  }

  if (dom.btnSaveProtocol) {
    dom.btnSaveProtocol.style.display = "none";
  }
}

/**
 * Show the saved protocol list container.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates the protocol list container display style.
 */
export function showProtocolList(dom) {
  if (dom.protocolListBox) {
    dom.protocolListBox.style.display = "block";
  }
}

/**
 * Hide the saved protocol list container.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates the protocol list container display style.
 */
export function hideProtocolList(dom) {
  if (dom.protocolListBox) {
    dom.protocolListBox.style.display = "none";
  }
}

/**
 * Render the empty state for the saved protocol list.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Replaces protocolListBox.innerHTML with an empty-state message.
 *
 * Important:
 *   UI text is German by design.
 */
export function renderEmptyProtocolList(dom) {
  if (!dom.protocolListBox) return;

  dom.protocolListBox.innerHTML = `
    <p class="muted">Noch kein Protokoll gespeichert.</p>
  `;
}
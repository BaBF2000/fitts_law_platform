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
 */

export function showExperimentDesignEditor(dom) {
  if (dom.experimentDesignEditor) {
    dom.experimentDesignEditor.style.display = "block";
  }

  if (dom.btnSaveProtocol) {
    dom.btnSaveProtocol.style.display = "inline-block";
  }
}

export function hideExperimentDesignEditor(dom) {
  if (dom.experimentDesignEditor) {
    dom.experimentDesignEditor.style.display = "none";
  }

  if (dom.btnSaveProtocol) {
    dom.btnSaveProtocol.style.display = "none";
  }
}

export function showProtocolList(dom) {
  if (dom.protocolListBox) {
    dom.protocolListBox.style.display = "block";
  }
}

export function hideProtocolList(dom) {
  if (dom.protocolListBox) {
    dom.protocolListBox.style.display = "none";
  }
}

export function renderEmptyProtocolList(dom) {
  if (!dom.protocolListBox) return;

  dom.protocolListBox.innerHTML = `
    <p class="muted">Noch kein Protokoll gespeichert.</p>
  `;
}
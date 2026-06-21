/**
 * Session block state helpers.
 *
 * Organigram reference:
 * - Experiment Design
 *   → Session Block Editor
 *   → Block State
 *
 * Responsibility:
 * Reads editable block values from the DOM and manages field availability.
 *
 * Important:
 * This module does not render blocks.
 * Rendering is handled by sessionBlockTemplate.js and sessionDesign.js.
 */

import {
  loadAdminSettings,
} from "../../core/adminSettings.js";

/**
 * Create a default session block configuration.
 *
 * Returns:
 *   New block object with default shape, parameter mode, parameter values,
 *   randomization flags and required overlap.
 *
 * Side effects:
 *   Reads current admin settings to use the active defaultRequiredOverlap value.
 *
 * Purpose:
 *   Used when the user adds a new block or when the editor needs an initial
 *   block.
 *
 * Important:
 *   The default required overlap is admin-configurable, so new blocks follow
 *   the current application constraint settings.
 */
export function defaultBlock() {
  const admin = loadAdminSettings();

  return {
    shape: "circle",
    param_mode: "A_W",

    dist_entered: "0.50",
    width_entered: "0.05",
    id_entered: "5",

    random_A: false,
    random_W: false,
    random_ID: false,

    required_overlap:
      String(admin.defaultRequiredOverlap),
  };
}

/**
 * Read one session block from the DOM.
 *
 * Args:
 *   index: Zero-based block index used in DOM element IDs.
 *
 * Returns:
 *   Block object containing shape, parameter mode, entered A/W/ID values,
 *   randomization flags and required overlap.
 *
 * Side effects:
 *   Reads current values from DOM elements.
 *
 * Behavior:
 *   Missing DOM elements fall back to safe defaults or empty strings.
 *
 * Related DOM IDs:
 *   - blk_<index>_shape
 *   - blk_<index>_param_mode
 *   - blk_<index>_dist
 *   - blk_<index>_width
 *   - blk_<index>_id
 *   - blk_<index>_random_A
 *   - blk_<index>_random_W
 *   - blk_<index>_random_ID
 *   - blk_<index>_required_overlap
 */
export function readBlockFromDOM(index) {
  return {
    shape:
      document.getElementById(`blk_${index}_shape`)?.value ??
      "circle",

    param_mode:
      document.getElementById(`blk_${index}_param_mode`)?.value ??
      "A_W",

    dist_entered:
      document.getElementById(`blk_${index}_dist`)?.value ??
      "",

    width_entered:
      document.getElementById(`blk_${index}_width`)?.value ??
      "",

    id_entered:
      document.getElementById(`blk_${index}_id`)?.value ??
      "",

    // Random buttons store their active state in data-active instead of using a
    // native checkbox checked state.
    random_A:
      document.getElementById(`blk_${index}_random_A`)?.dataset.active === "1",

    random_W:
      document.getElementById(`blk_${index}_random_W`)?.dataset.active === "1",

    random_ID:
      document.getElementById(`blk_${index}_random_ID`)?.dataset.active === "1",

    required_overlap:
      document.getElementById(`blk_${index}_required_overlap`)?.value ??
      "1.0",
  };
}

/**
 * Check whether an input string represents a list.
 *
 * Args:
 *   value: Raw input value.
 *
 * Returns:
 *   true if the trimmed value starts with "[" and ends with "]", otherwise false.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   List inputs represent discrete value choices. Therefore the random button is
 *   disabled for list inputs, because the list itself already defines multiple
 *   possible values.
 */
export function isListInput(value) {
  const raw =
    (value ?? "").toString().trim();

  return raw.startsWith("[") && raw.endsWith("]");
}

/**
 * Update a randomization button state.
 *
 * Args:
 *   button: Randomization button DOM element.
 *   enabled: Whether the button should be usable.
 *   active: Whether randomization should be active when enabled.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates button.disabled and button.dataset.active.
 *
 * Behavior:
 *   If the button is disabled, data-active is forced to "0".
 */
export function setRandomButtonState(
  button,
  enabled,
  active
) {
  if (!button) return;

  button.disabled = !enabled;
  button.dataset.active =
    enabled && active ? "1" : "0";
}

/**
 * Enable or disable block fields according to the selected parameter mode.
 *
 * Args:
 *   index: Zero-based block index used in DOM element IDs.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates input disabled states, visual styles and random button states.
 *
 * Parameter modes:
 *   - A_W  enables A and W
 *   - ID_W enables ID and W
 *   - ID_A enables ID and A
 *
 * Behavior:
 *   - Inactive fields are disabled and visually dimmed.
 *   - Random buttons are enabled only when their field is active and the input
 *     is not a list.
 *   - Disabled random buttons are forced to inactive state.
 *
 * Important:
 *   This function only controls the editor UI. The final protocol validation is
 *   still handled later in protocol.js.
 */
export function updateBlockFieldState(index) {
  const mode =
    document.getElementById(`blk_${index}_param_mode`)?.value ??
    "A_W";

  const fields = {
    A: document.getElementById(`blk_${index}_dist`),
    W: document.getElementById(`blk_${index}_width`),
    ID: document.getElementById(`blk_${index}_id`),
  };

  const buttons = {
    A: document.getElementById(`blk_${index}_random_A`),
    W: document.getElementById(`blk_${index}_random_W`),
    ID: document.getElementById(`blk_${index}_random_ID`),
  };

  // Defines which parameter inputs are editable for each parameter mode.
  const activeByMode = {
    A_W: ["A", "W"],
    ID_W: ["ID", "W"],
    ID_A: ["ID", "A"],
  };

  const enabledFields =
    activeByMode[mode] ?? ["A", "W"];

  for (const key of ["A", "W", "ID"]) {
    const input = fields[key];
    const button = buttons[key];

    const fieldEnabled =
      enabledFields.includes(key);

    const hasList =
      isListInput(input?.value);

    if (input) {
      input.disabled = !fieldEnabled;
      input.style.opacity = fieldEnabled ? "1" : "0.45";
      input.style.backgroundColor = fieldEnabled ? "" : "#e5e7eb";
      input.style.cursor = fieldEnabled ? "" : "not-allowed";
    }

    // A random button is only meaningful for active scalar inputs.
    // List inputs are already discrete alternatives and therefore do not use the
    // random toggle.
    const randomEnabled =
      fieldEnabled && !hasList;

    const randomActive =
      button?.dataset.active === "1";

    setRandomButtonState(
      button,
      randomEnabled,
      randomActive
    );
  }
}
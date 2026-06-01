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

export function isListInput(value) {
  const raw =
    (value ?? "").toString().trim();

  return raw.startsWith("[") && raw.endsWith("]");
}

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
import {
  loadAdminSettings,
  saveAdminSettings,
  clearAdminSettings,
} from "../core/adminSettings.js";

/**
 * Initialize the admin settings UI.
 *
 * Organigram reference:
 * - Admin Settings
 *   → Application Constraints
 *   → Runtime Constraint Configuration
 *
 * Responsibility:
 * Wires the admin settings panel to persistent constraint settings.
 *
 * This module connects:
 * - opening the admin settings panel
 * - filling the panel with current settings
 * - saving edited settings
 * - resetting settings to defaults
 * - returning to the start screen
 *
 * Important:
 * The actual validation, defaults and persistence logic live in
 * core/adminSettings.js. This file only connects the UI controls.
 */

/**
 * Register admin settings UI handlers.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   ui: Core UI helper module, expected to provide show().
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Registers click event listeners for admin settings buttons.
 *
 * Handled controls:
 *   - btnAdminSettings: opens the admin settings screen.
 *   - btnAdminClose: returns to the start screen.
 *   - btnAdminSave: saves current admin settings.
 *   - btnAdminReset: clears stored admin settings and reloads defaults.
 *
 * Related modules:
 *   - core/adminSettings.js stores and validates the settings.
 *   - experimentConstraints.js reads these settings during runtime and
 *     Monte Carlo constraint analysis.
 */
export function initAdminSettingsUI(dom, ui) {
  /**
   * Fill the admin settings form with currently active values.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Reads current admin settings and writes values into form inputs.
   *
   * Behavior:
   *   loadAdminSettings() returns either saved custom values or default values.
   *
   * Important:
   *   The input values are assigned directly here. Sanitization should happen
   *   inside saveAdminSettings() or loadAdminSettings().
   */
  function fill() {
    const s = loadAdminSettings();

    document.getElementById("adminMinVisibleTargetPx").value =
      s.minVisibleTargetPx;

    document.getElementById("adminTouchSafetyFactor").value =
      s.touchSafetyFactor;

    document.getElementById("adminMaxTargetSizeRatio").value =
      s.maxTargetSizeRatio;

    document.getElementById("adminMinAmplitudeMarginPx").value =
      s.minAmplitudeMarginPx;

    document.getElementById("adminDefaultRequiredOverlap").value =
      s.defaultRequiredOverlap;
  }

  /**
   * Open the admin settings screen.
   *
   * Side effects:
   *   Refreshes the form values and switches the visible UI view to
   *   "adminSettings".
   */
  document.getElementById("btnAdminSettings")?.addEventListener("click", () => {
    fill();
    ui.show(dom, "adminSettings");
  });

  /**
   * Close the admin settings screen without explicitly saving.
   *
   * Side effects:
   *   Switches the UI back to the start screen.
   *
   * Important:
   *   Unsaved edits are discarded visually because fill() reloads persisted
   *   values the next time the panel is opened.
   */
  document.getElementById("btnAdminClose")?.addEventListener("click", () => {
    ui.show(dom, "start");
  });

  /**
   * Save the current admin settings form values.
   *
   * Side effects:
   *   Reads form input values, saves them through saveAdminSettings() and
   *   returns to the start screen.
   *
   * Stored settings:
   *   - minVisibleTargetPx
   *   - touchSafetyFactor
   *   - maxTargetSizeRatio
   *   - minAmplitudeMarginPx
   *   - defaultRequiredOverlap
   *
   * Important:
   *   These values affect target-size constraints, overlap defaults, amplitude
   *   safety margins and Monte Carlo diagnostics.
   */
  document.getElementById("btnAdminSave")?.addEventListener("click", () => {
    saveAdminSettings({
      minVisibleTargetPx:
        document.getElementById("adminMinVisibleTargetPx").value,

      touchSafetyFactor:
        document.getElementById("adminTouchSafetyFactor").value,

      maxTargetSizeRatio:
        document.getElementById("adminMaxTargetSizeRatio").value,

      minAmplitudeMarginPx:
        document.getElementById("adminMinAmplitudeMarginPx").value,

      defaultRequiredOverlap:
        document.getElementById("adminDefaultRequiredOverlap").value,
    });

    ui.show(dom, "start");
  });

  /**
   * Reset admin settings to defaults.
   *
   * Side effects:
   *   Clears persisted admin settings and immediately refills the form with
   *   default values.
   *
   * Important:
   *   The user remains on the admin settings screen after reset, so they can
   *   inspect or save/edit the default values.
   */
  document.getElementById("btnAdminReset")?.addEventListener("click", () => {
    clearAdminSettings();
    fill();
  });
}
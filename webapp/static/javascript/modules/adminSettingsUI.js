import {
  loadAdminSettings,
  saveAdminSettings,
  clearAdminSettings,
} from "../core/adminSettings.js";

export function initAdminSettingsUI(dom, ui) {
  function fill() {
    const s = loadAdminSettings();

    document.getElementById("adminMinVisibleTargetPx").value = s.minVisibleTargetPx;
    document.getElementById("adminTouchSafetyFactor").value = s.touchSafetyFactor;
    document.getElementById("adminMaxTargetSizeRatio").value = s.maxTargetSizeRatio;
    document.getElementById("adminMinAmplitudeMarginPx").value = s.minAmplitudeMarginPx;
    document.getElementById("adminDefaultRequiredOverlap").value = s.defaultRequiredOverlap;
  }

  document.getElementById("btnAdminSettings")?.addEventListener("click", () => {
    fill();
    ui.show(dom, "adminSettings");
  });

  document.getElementById("btnAdminClose")?.addEventListener("click", () => {
    ui.show(dom, "start");
  });

  document.getElementById("btnAdminSave")?.addEventListener("click", () => {
    saveAdminSettings({
      minVisibleTargetPx: document.getElementById("adminMinVisibleTargetPx").value,
      touchSafetyFactor: document.getElementById("adminTouchSafetyFactor").value,
      maxTargetSizeRatio: document.getElementById("adminMaxTargetSizeRatio").value,
      minAmplitudeMarginPx: document.getElementById("adminMinAmplitudeMarginPx").value,
      defaultRequiredOverlap: document.getElementById("adminDefaultRequiredOverlap").value,
    });

    ui.show(dom, "start");
  });

  document.getElementById("btnAdminReset")?.addEventListener("click", () => {
    clearAdminSettings();
    fill();
  });
}
/**
 * Experiment runtime helpers.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Runtime State
 *   → Timeout Handling
 *
 * Responsibility:
 * Handles runtime reset, timeout cleanup and basic trial timeout scheduling.
 *
 * Important:
 * This module mutates the shared experiment state object.
 */

export function clearTimeoutIfNeeded(state) {
  if (state.timeoutHandle) {
    clearTimeout(state.timeoutHandle);
    state.timeoutHandle = null;
  }
}

export function resetRun({
  dom,
  state,
  pairEngine,
  targetDebugOverlay,
}) {
  clearTimeoutIfNeeded(state);

  pairEngine?.clearPair?.();

  state.trials = [];
  state.trialIndex = -1;
  state.current = null;
  state.results = [];

  state.errorCount = 0;
  state.startTime = 0;
  state.isDemoRun = false;

  state.currentPair = null;
  state.activeTargetKey = "a";
  state.interactionIndex = 0;
  state.interactionResults = [];

  if (dom.crosshair) {
    dom.crosshair.style.display = "none";
  }

  if (dom.hudLeft) {
    dom.hudLeft.textContent = "Bereit";
  }

  targetDebugOverlay?.clear?.();
}

export function setTrialTimeout({
  state,
  timeoutMs,
  onTimeout,
}) {
  clearTimeoutIfNeeded(state);

  if (!timeoutMs || timeoutMs <= 0) {
    return;
  }

  state.timeoutHandle = setTimeout(() => {
    onTimeout?.();
  }, timeoutMs);
}
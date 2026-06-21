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
 *
 * Related modules:
 * - experiment.js calls these helpers when starting, advancing or finishing runs.
 * - trialPairEngine.js manages the active pair interaction state.
 * - TargetDebugOverlay.js is cleared here during runtime reset.
 */

/**
 * Clear the currently active trial timeout, if one exists.
 *
 * Args:
 *   state: Shared application state containing timeoutHandle.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Cancels the active timeout and resets state.timeoutHandle to null.
 *
 * Purpose:
 *   Prevents a timeout from a previous trial from firing after the experiment
 *   has advanced to the next trial or has been reset.
 */
export function clearTimeoutIfNeeded(state) {
  if (state.timeoutHandle) {
    clearTimeout(state.timeoutHandle);
    state.timeoutHandle = null;
  }
}

/**
 * Reset all runtime data before starting a new experiment run.
 *
 * Args:
 *   dom: Centralized DOM reference object from getDom().
 *   state: Shared experiment state object.
 *   pairEngine: Current trial pair engine instance, if one exists.
 *   targetDebugOverlay: Optional debug overlay controller.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Mutates state, clears active targets, hides the crosshair, updates the HUD
 *   and clears the debug overlay.
 *
 * Reset state fields:
 *   - trials
 *   - trialIndex
 *   - current
 *   - results
 *   - errorCount
 *   - startTime
 *   - isDemoRun
 *   - currentPair
 *   - activeTargetKey
 *   - interactionIndex
 *   - interactionResults
 *
 * Important:
 *   This function resets runtime execution data only. It does not delete saved
 *   protocols, calibration data or participant metadata.
 */
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

/**
 * Schedule a timeout for the active trial.
 *
 * Args:
 *   state: Shared experiment state object.
 *   timeoutMs: Timeout duration in milliseconds.
 *   onTimeout: Optional callback executed when the timeout fires.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Clears any previous timeout and may store a new timeout handle in state.
 *
 * Behavior:
 *   If timeoutMs is missing, zero or negative, no timeout is scheduled.
 *
 * Important:
 *   This helper only schedules the timeout. The caller decides what should
 *   happen when the timeout fires through the onTimeout callback.
 */
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
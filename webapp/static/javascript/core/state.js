export const state = {
  // calibration
  REF_MM: 85.60,
  mmPerPx: null,

  // experiment
  trials: [],
  trialIndex: -1,
  current: null,
  results: [],
  errorCount: 0,
  startTime: 0,
  timeoutHandle: null,

// ✅ run mode
  isDemoRun: false,

  // ui
  dragging: false,
  dragStartX: 0,
  startW: 0,

  sessionBlocks: [], // [{ n, dist_set, dist_entered, width_set, width_entered, id_set, id_entered }]

  savedToPC: false,
  savedSessionRowId: null,

  calSamples: [],      // array of mmPerPx samples
  calErrorPct: null,   // displayed uncertainty in %
};
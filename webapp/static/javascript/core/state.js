/**
 * Global application state.
 *
 * Organigram reference:
 * - Core State
 *   → Calibration State
 *   → Protocol State
 *   → Experiment Runtime State
 *   → Persistence State
 *
 * Responsibility:
 * Stores the mutable runtime state shared across the application.
 *
 * Important:
 * This object should only contain state values.
 * Business logic belongs in dedicated modules, for example:
 * - calibration.js
 * - sessionDesign.js
 * - trialParameters.js
 * - experiment.js
 * - experimentRuntime.js
 *
 * Extension guide:
 * - Add new state values only when they must be shared across modules.
 * - Prefer local variables for temporary implementation details.
 * - Group new values under a clearly named section.
 * 
 * Note:
 * The exported state object is mutable and shared by reference between modules.
 * Modules should update only the fields they are responsible for and avoid
 * replacing the whole state object.
 */

export const state = {
  // ------------------------------------------------------------
  // Calibration
  // ------------------------------------------------------------

  // Physical reference width used during screen calibration
  // (standard bank card width in millimeters).
  REF_MM: 85.60,

  // Calibration factor: millimeters per CSS pixel.
  // Null means that calibration has not been completed yet.
  mmPerPx: null,

  // Calibration samples collected during repeated measurements.
  calSamples: [],

  // Estimated calibration error in percent.
  calErrorPct: null,

  // ------------------------------------------------------------
  // Touchability / finger contact model
  // ------------------------------------------------------------

  // Estimated finger contact diameter in CSS pixels.
  touchDiameterPx: null,

  // Estimated finger contact diameter in millimeters.
  touchDiameterMm: null,

  // Shape-specific minimum target widths derived from touchability.
  touchabilityByShape: {},

  // True when touchability was measured instead of using fallback values.
  touchabilityMeasured: false,

  // Source of touchability values:
  // - "measured": based on the device/browser touch contact estimate
  // - "fallback": based on predefined default values
  touchabilitySource: "fallback",

  // ------------------------------------------------------------
  // Experimental protocol
  // ------------------------------------------------------------

  // True when the current protocol passed validation
  protocolReady: false,

  // Optional free-text comment for the current session
  sessionComment: "",

 // Current protocol block definitions created in the session design UI.
 // These blocks are later expanded into trials.
 sessionBlocks: [],

  // Number of valid target interactions required within each trial
  interactionsPerTrial: 1,

  // Currently loaded or active protocol object
  // Used as the frontend-side protocol snapshot before an experiment is started
  currentProtocol: null,

  // Protocol metadata.
  protocolName: "",
  protocolComment: "",

  // ------------------------------------------------------------
  // Experiment runtime
  // ------------------------------------------------------------

  // Fully expanded list of trials generated from the protocol blocks
  trials: [],

  // Index of the currently active trial
  trialIndex: -1,

  // Current runtime trial object
  current: null,

  // Final result rows prepared for local CSV export and backend storage
  // Rows are built during experiment runtime and sent to /save_results
  results: [],

  // ------------------------------------------------------------
  // Pair mode: two alternating targets
  // ------------------------------------------------------------

  // Runtime object for the current target pair
  currentPair: null,

  // Active target identifier: "a" or "b".
  activeTargetKey: "a",

  // Current interaction index within the active trial
  interactionIndex: 0,

  // Raw interaction-level results before trial-level summarization
  interactionResults: [],

  // ------------------------------------------------------------
  // Error tracking
  // ------------------------------------------------------------

  // Total number of invalid interactions across the session
  errorCount: 0,

  // Timestamp at which the current trial started
  startTime: 0,

  // Timeout handler reference for the active trial.
  // Must be cleared when a trial ends or the run is aborted.
  timeoutHandle: null,

  // ------------------------------------------------------------
  // Session mode
  // ------------------------------------------------------------

  // True when the experiment is running in demo mode.
  isDemoRun: false,

  // Session target composition:
  // - "fixed": same target shape throughout the session
  // - "mixed": multiple defined shapes across blocks
  // - "shuffle": randomized shape selection
  // Session target composition. Kept in snake_case for compatibility with
  // exported metadata/backend naming
  session_target_mode: "unknown",

  // ------------------------------------------------------------
  // Persistence / save state
  // ------------------------------------------------------------

  // True once the results were successfully saved to the backend.
  savedToPC: false,

  // Backend session row ID returned after saving.
  savedSessionRowId: null,

  // ------------------------------------------------------------
  // Calibration UI drag state
  // ------------------------------------------------------------

  // Drag state used by the calibration UI.
  dragging: false,
  dragStartX: 0,
  startW: 0,
};
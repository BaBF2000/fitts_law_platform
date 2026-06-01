/**
 * Storage facade.
 *
 * Organigram reference:
 * - Core
 *   → Storage Layer
 *
 * Responsibility:
 * Provides a single import entry point for all local persistence helpers.
 *
 * This file intentionally contains no storage logic.
 * It only re-exports specialized storage modules:
 *
 * - calibrationStorage.js
 * - touchabilityStorage.js
 * - protocolStorage.js
 * - deviceSignature.js
 *
 * Benefits:
 * - stable import paths
 * - easier refactoring
 * - separation of responsibilities
 *
 * Extension guide:
 * - Calibration persistence:
 *     storage/calibrationStorage.js
 *
 * - Participant touchability persistence:
 *     storage/touchabilityStorage.js
 *
 * - Protocol persistence:
 *     storage/protocolStorage.js
 *
 * - Device compatibility checks:
 *     storage/deviceSignature.js
 */
export {
  getDeviceSignature,
  isCalibrationLikelyValid,
} from "./storage/deviceSignature.js";

export {
  loadCalibration,
  saveCalibration,
  clearCalibration,
} from "./storage/calibrationStorage.js";

export {
  saveTouchabilityForParticipant,
  loadTouchabilityForParticipant,
  clearTouchabilityForParticipant,
} from "./storage/touchabilityStorage.js";

export {
  listProtocols,
  saveProtocol,
  loadProtocol,
  loadProtocolById,
  deleteProtocolById,
  clearProtocol,
} from "./storage/protocolStorage.js";

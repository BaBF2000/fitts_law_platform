/**
 * Monte Carlo profile metadata.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Sampling Profiles
 *
 * Responsibility:
 * Provides UI metadata for available sampling profiles.
 *
 * Important:
 * This module does not implement the sampling algorithms.
 * It only describes the available profiles for the user interface.
 *
 * Related modules:
 * - core/distributions.js implements the actual distribution sampling.
 * - monteCarloSampling.js applies the selected sampling profile.
 * - monteCarloEngine.js exposes these profiles in simulation metadata.
 */

/**
 * Suggested Monte Carlo sampling profiles shown in the UI.
 *
 * Fields:
 *   id:
 *     Internal profile identifier used by the simulation code.
 *
 *   label:
 *     Human-readable profile name shown in the interface.
 *
 *   description:
 *     Short German explanation shown to the experiment designer.
 *
 * Available profiles:
 *   - uniform: samples uniformly within the requested value range.
 *   - truncated_uniform: samples uniformly within technically valid limits.
 *   - normal: samples normally around the requested range midpoint.
 *   - truncated_normal: samples normally, but restricted to valid limits.
 *
 * Important:
 *   The ids must match the sampling modes supported by the distribution and
 *   Monte Carlo sampling modules.
 */
export const SUGGESTED_PROFILES = [
  {
    id: "uniform",
    label: "Uniform",
    description: "Uniforme Verteilung innerhalb der gewünschten Wertebereiche.",
  },
  {
    id: "truncated_uniform",
    label: "Trunkierte Uniformverteilung",
    description: "Uniforme Verteilung innerhalb der technisch gültigen Grenzen.",
  },
  {
    id: "normal",
    label: "Normalverteilung",
    description: "Normalverteilung um den Mittelwert der gewünschten Werte.",
  },
  {
    id: "truncated_normal",
    label: "Trunkierte Normalverteilung",
    description: "Normalverteilung innerhalb der technisch gültigen Grenzen.",
  },
];
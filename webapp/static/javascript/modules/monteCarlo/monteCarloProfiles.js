/**
 * Monte Carlo profile metadata.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Sampling Profiles
 *
 * Responsibility:
 * Provides UI metadata for available sampling profiles.
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
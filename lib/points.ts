/**
 * lib/points.ts — Section 8.3
 *
 * Computes the gamification points awarded for completing a roadmap node.
 *
 * Formula:
 *   points = round(difficulty × hours × (dimension_weight × 10) × tier_multiplier)
 *
 * Tier multipliers: T1 = 2.0, T2 = 1.5, T3 = 1.2, T4 = 1.0, T5 = 0.7
 */

const TIER_MULTIPLIERS: Record<number, number> = {
  1: 2.0,
  2: 1.5,
  3: 1.2,
  4: 1.0,
  5: 0.7,
};

// Cluster weight for each dimension (used as dimensionWeight in the formula).
// We use the "tech" cluster as a reasonable default dimension weight reference
// since the spec doesn't specify a cluster-specific weight here.
// The dimension_weight is passed in as a 0–1 fractional value by the caller
// (e.g. 0.15 for a 15% weight dimension in tech cluster).
// Per the formula: dimension_weight × 10 maps 0.15 → 1.5.

/**
 * Compute points for a roadmap node.
 *
 * @param difficulty   Node difficulty (1–5)
 * @param hours        Estimated hours (integer)
 * @param dimensionWeight  The cluster weight of the target dimension, as a decimal (e.g. 0.15 for 15%)
 * @param tier         Node tier (1–5)
 * @returns            Integer points value
 */
export function computePoints(
  difficulty: number,
  hours: number,
  dimensionWeight: number,
  tier: number,
): number {
  const tierMultiplier = TIER_MULTIPLIERS[tier] ?? 1.0;
  const raw = difficulty * hours * (dimensionWeight * 10) * tierMultiplier;
  return Math.round(raw);
}

// Convenience: get dimension weight from cluster + dimension key
const CLUSTER_WEIGHTS: Record<string, Record<string, number>> = {
  medicine:    { academic: 0.25, credentialing: 0.25, practical: 0.20, portfolio: 0.08, domain: 0.10, prof_dev: 0.05, soft_skills: 0.07 },
  engineering: { academic: 0.20, credentialing: 0.18, practical: 0.15, portfolio: 0.22, domain: 0.12, prof_dev: 0.05, soft_skills: 0.08 },
  tech:        { academic: 0.15, credentialing: 0.15, practical: 0.15, portfolio: 0.30, domain: 0.15, prof_dev: 0.05, soft_skills: 0.05 },
  unsupported: { academic: 0.15, credentialing: 0.15, practical: 0.15, portfolio: 0.15, domain: 0.15, prof_dev: 0.15, soft_skills: 0.10 },
};

export function getDimensionWeight(cluster: string, dimensionTarget: string): number {
  const weights = CLUSTER_WEIGHTS[cluster] ?? CLUSTER_WEIGHTS.unsupported;
  return weights[dimensionTarget] ?? 0.10; // fallback 10%
}

/**
 * lib/role-match.ts — Section 8.2
 *
 * Computes a Job Readiness / role-match score (0–100) that answers:
 * "How well does this student's profile match THIS specific job's requirements?"
 *
 * Formula:
 *   deficit[i]        = max(0, R[i] - S[i])          // only penalise underperformance
 *   weighted_distance = sqrt( Σ (weight[i] * deficit[i]²) / 100 )
 *   max_distance      = sqrt( Σ (weight[i] * 100²) / 100 ) = 100
 *   match_score       = round(100 × (1 − weighted_distance / max_distance))
 */

const CLUSTER_WEIGHTS: Record<string, Record<string, number>> = {
  medicine:    { academic: 25, credentialing: 25, practical: 20, portfolio:  8, domain: 10, prof_dev:  5, soft_skills:  7 },
  engineering: { academic: 20, credentialing: 18, practical: 15, portfolio: 22, domain: 12, prof_dev:  5, soft_skills:  8 },
  tech:        { academic: 15, credentialing: 15, practical: 15, portfolio: 30, domain: 15, prof_dev:  5, soft_skills:  5 },
  unsupported: { academic: 15, credentialing: 15, practical: 15, portfolio: 15, domain: 15, prof_dev: 15, soft_skills: 10 },
};

export interface DimVector {
  dim_academic:      number;
  dim_credentialing: number;
  dim_practical:     number;
  dim_portfolio:     number;
  dim_domain:        number;
  dim_prof_dev:      number;
  dim_soft_skills:   number;
}

const DIM_KEYS: (keyof DimVector)[] = [
  'dim_academic',
  'dim_credentialing',
  'dim_practical',
  'dim_portfolio',
  'dim_domain',
  'dim_prof_dev',
  'dim_soft_skills',
];

const WEIGHT_KEY_MAP: Record<keyof DimVector, string> = {
  dim_academic:      'academic',
  dim_credentialing: 'credentialing',
  dim_practical:     'practical',
  dim_portfolio:     'portfolio',
  dim_domain:        'domain',
  dim_prof_dev:      'prof_dev',
  dim_soft_skills:   'soft_skills',
};

/**
 * Compute a 0–100 role-match score.
 *
 * @param studentDims  Student's 7-dim vector from student_dimensions
 * @param roleRequiredDims  The job's dimension_requirements JSON column
 * @param cluster  Student's cluster (medicine | engineering | tech | unsupported)
 * @returns Integer 0–100
 */
export function computeRoleMatch(
  studentDims: DimVector,
  roleRequiredDims: Partial<DimVector>,
  cluster: string,
): number {
  const weights = CLUSTER_WEIGHTS[cluster] ?? CLUSTER_WEIGHTS.unsupported;

  let weightedDistanceSq = 0;

  for (const key of DIM_KEYS) {
    const s = studentDims[key] ?? 0;
    const r = roleRequiredDims[key] ?? 0;
    const deficit = Math.max(0, r - s); // only penalise underperformance
    const w = weights[WEIGHT_KEY_MAP[key]] ?? 0;
    weightedDistanceSq += w * deficit * deficit;
  }

  // weighted_distance = sqrt(Σ (w * deficit²) / 100)
  const weightedDistance = Math.sqrt(weightedDistanceSq / 100);

  // max_distance when every deficit = 100: sqrt(Σ(w * 100²) / 100) = sqrt(100 * Σw / 100) = sqrt(Σw) = 10 (weights sum to 100)
  // Actually: sqrt(100² * Σ(w)/100) = sqrt(100 * 100) = 100. Let's verify:
  // Σ(w * 100²) / 100 = 100² * Σ(w) / 100 = 100 * Σ(w) = 100 * 100 = 10000 → sqrt = 100
  const maxDistance = 100;

  const matchScore = Math.round(100 * (1 - weightedDistance / maxDistance));
  return Math.max(0, Math.min(100, matchScore));
}

/**
 * Compute per-dimension gap vector (student − requirement).
 * Positive means student exceeds requirement; negative means deficit.
 */
export function computeGapVector(
  studentDims: DimVector,
  roleRequiredDims: Partial<DimVector>,
): Record<keyof DimVector, number> {
  const result = {} as Record<keyof DimVector, number>;
  for (const key of DIM_KEYS) {
    result[key] = (studentDims[key] ?? 0) - (roleRequiredDims[key] ?? 0);
  }
  return result;
}

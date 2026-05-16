/**
 * lib/job-helpers.ts
 *
 * Shared helpers for the Jobs / Applications phase: loading a student's cached
 * dimension vector, and deriving the per-job strengths / gaps / breakdown.
 */

import sql from './db';
import { computeGapVector, type DimVector } from './role-match';

export const DIM_KEYS: (keyof DimVector)[] = [
  'dim_academic',
  'dim_credentialing',
  'dim_practical',
  'dim_portfolio',
  'dim_domain',
  'dim_prof_dev',
  'dim_soft_skills',
];

const ZERO_DIMS: DimVector = {
  dim_academic: 0,
  dim_credentialing: 0,
  dim_practical: 0,
  dim_portfolio: 0,
  dim_domain: 0,
  dim_prof_dev: 0,
  dim_soft_skills: 0,
};

/** Load the student's cached 7-dim vector + general readiness. Returns zeros if not yet computed. */
export async function loadStudentDimensions(
  studentId: string,
): Promise<{ dims: DimVector; generalReadiness: number }> {
  const [row] = await sql`SELECT * FROM student_dimensions WHERE student_id = ${studentId}`;
  if (!row) return { dims: { ...ZERO_DIMS }, generalReadiness: 0 };
  return {
    dims: {
      dim_academic: Number(row.dim_academic),
      dim_credentialing: Number(row.dim_credentialing),
      dim_practical: Number(row.dim_practical),
      dim_portfolio: Number(row.dim_portfolio),
      dim_domain: Number(row.dim_domain),
      dim_prof_dev: Number(row.dim_prof_dev),
      dim_soft_skills: Number(row.dim_soft_skills),
    },
    generalReadiness: Number(row.general_readiness),
  };
}

/** Coerce a possibly-string JSON column value into a real JS value. */
export function asJson(raw: any): any {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/** Coerce a JSON column expected to be an array. */
export function asArray<T = any>(raw: any): T[] {
  const v = asJson(raw);
  return Array.isArray(v) ? v : [];
}

/** Normalize a job's dimension_requirements JSON into a Partial<DimVector>. */
export function normalizeRequirements(raw: any): Partial<DimVector> {
  const obj = asJson(raw);
  const out: Partial<DimVector> = {};
  if (obj && typeof obj === 'object') {
    for (const k of DIM_KEYS) {
      if (obj[k] != null) out[k] = Number(obj[k]);
    }
  }
  return out;
}

export interface DimDelta {
  dim: keyof DimVector;
  student: number;
  required: number;
  delta: number; // student − required (positive = exceeds)
}

/**
 * Compute the match breakdown for a job: top strengths (dims where the student
 * meets/exceeds a meaningful requirement) and top gaps (largest deficits).
 */
export function computeJobBreakdown(
  studentDims: DimVector,
  requirements: Partial<DimVector>,
): { strengths: DimDelta[]; gaps: DimDelta[] } {
  const gapVec = computeGapVector(studentDims, requirements);
  const deltas: DimDelta[] = DIM_KEYS.map((dim) => ({
    dim,
    student: studentDims[dim] ?? 0,
    required: requirements[dim] ?? 0,
    delta: gapVec[dim],
  }));

  // Strengths: requirement is meaningful (>0) and the student meets it; rank by how strongly.
  const strengths = deltas
    .filter((d) => d.required > 0 && d.delta >= 0)
    .sort((a, b) => b.required - a.required || b.delta - a.delta)
    .slice(0, 3);

  // Gaps: student is below requirement; rank by the size of the deficit.
  const gaps = deltas
    .filter((d) => d.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 2);

  return { strengths, gaps };
}

/** Human-readable dimension labels (used by the auto-subtitle on /jobs/[id]). */
export const DIM_LABEL_EN: Record<string, string> = {
  dim_academic: 'Academic',
  dim_credentialing: 'Credentialing',
  dim_practical: 'Practical Experience',
  dim_portfolio: 'Portfolio',
  dim_domain: 'Domain Knowledge',
  dim_prof_dev: 'Professional Development',
  dim_soft_skills: 'Soft Skills',
};

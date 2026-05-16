/**
 * lib/job-vector.ts — Section 8.4
 *
 * Turns a job's structured fields into the 7-dimension required vector stored in
 * jobs.dimension_requirements. This is the exact formula scripts/seed-jobs.mjs
 * computed inline; extracted here so POST /api/corporates/jobs reuses it.
 *
 *   dim_academic      = 50 + education_level_score*10 + required_experience_years*5
 *   dim_credentialing = required_certs.length * 20
 *   dim_practical     = required_experience_years * 15
 *   dim_portfolio     = required_skills.filter(s => s.importance >= 3).length * 10
 *   dim_domain        = required_skills.length * 5
 *   dim_prof_dev      = 40 (constant)
 *   dim_soft_skills   = 60 (constant)
 * Every value capped at 100. Education score: high_school=1, bachelor=3, master=4, phd=5.
 */

import type { DimVector } from './role-match';

const EDU_SCORE: Record<string, number> = {
  high_school: 1,
  bachelor: 3,
  master: 4,
  phd: 5,
};

export interface JobVectorInput {
  required_skills: { skill: string; importance: number }[];
  required_certs: string[];
  required_experience_years: number;
  required_education_level: string;
}

export function computeJobDimensionRequirements(job: JobVectorInput): DimVector {
  const cap = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  const skills = Array.isArray(job.required_skills) ? job.required_skills : [];
  const certs = Array.isArray(job.required_certs) ? job.required_certs : [];
  const years = Number(job.required_experience_years) || 0;
  const eduScore = EDU_SCORE[job.required_education_level] ?? 3;

  return {
    dim_academic: cap(50 + eduScore * 10 + years * 5),
    dim_credentialing: cap(certs.length * 20),
    dim_practical: cap(years * 15),
    dim_portfolio: cap(skills.filter((s) => Number(s.importance) >= 3).length * 10),
    dim_domain: cap(skills.length * 5),
    dim_prof_dev: 40,
    dim_soft_skills: 60,
  };
}

import sql from './db';

export type BoostMatrix = Record<string, Record<string, number>>;

/**
 * Computes the simulator boost matrix LIVE from real job data (Section 8.5).
 * Not stored statically — recomputed on every call (~10ms at demo scale).
 *
 * For each (skill, role_category) pair: boost is the summed importance of that
 * skill across jobs in the role_category, divided by the number of jobs in that
 * role_category, scaled ×2 and capped at 10.
 */
export async function computeBoostMatrix(cluster: string): Promise<BoostMatrix> {
  const jobs = await sql`
    SELECT id, role_category, required_skills
    FROM jobs
    WHERE cluster = ${cluster} AND status = 'open'
  `;

  // Count jobs per role_category.
  const jobsPerRole: Record<string, number> = {};
  for (const job of jobs) {
    jobsPerRole[job.role_category] = (jobsPerRole[job.role_category] ?? 0) + 1;
  }

  // Sum importance per (skill, role_category).
  const importanceSum: Record<string, Record<string, number>> = {};
  for (const job of jobs) {
    const skills = Array.isArray(job.required_skills) ? job.required_skills : [];
    for (const s of skills) {
      const skillKey = s?.skill;
      const importance = Number(s?.importance) || 0;
      if (!skillKey) continue;
      importanceSum[skillKey] ??= {};
      importanceSum[skillKey][job.role_category] =
        (importanceSum[skillKey][job.role_category] ?? 0) + importance;
    }
  }

  // Normalize into boost integers.
  const matrix: BoostMatrix = {};
  for (const [skillKey, roleMap] of Object.entries(importanceSum)) {
    matrix[skillKey] = {};
    for (const [roleCategory, sumImportance] of Object.entries(roleMap)) {
      const totalJobs = jobsPerRole[roleCategory] || 1;
      const boost = Math.min(10, Math.round((sumImportance / totalJobs) * 2));
      matrix[skillKey][roleCategory] = boost;
    }
  }

  return matrix;
}

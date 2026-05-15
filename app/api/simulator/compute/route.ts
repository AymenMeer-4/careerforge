/**
 * POST /api/simulator/compute
 * Body: { activeSkills: string[] }  — skill_keys the student toggled "on".
 * Returns simulated dimensions (with a boosted dim_domain), a simulated general
 * readiness number, and a per-role simulated match. All derived from real data:
 * the boost matrix is computed live from open jobs (Section 8.5).
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeBoostMatrix } from '@/lib/simulator';
import { computeRoleMatch, type DimVector } from '@/lib/role-match';
import roleCatalog from '@/data/role-catalog.json';

const CLUSTER_WEIGHTS: Record<string, Record<string, number>> = {
  medicine:    { academic: 25, credentialing: 25, practical: 20, portfolio:  8, domain: 10, prof_dev:  5, soft_skills:  7 },
  engineering: { academic: 20, credentialing: 18, practical: 15, portfolio: 22, domain: 12, prof_dev:  5, soft_skills:  8 },
  tech:        { academic: 15, credentialing: 15, practical: 15, portfolio: 30, domain: 15, prof_dev:  5, soft_skills:  5 },
  unsupported: { academic: 15, credentialing: 15, practical: 15, portfolio: 15, domain: 15, prof_dev: 15, soft_skills: 10 },
};

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const activeSkills: string[] = Array.isArray(body.activeSkills) ? body.activeSkills : [];

    const [student] = await sql`
      SELECT cluster, target_role FROM students WHERE user_id = ${session.userId}
    `;
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }
    const cluster = student.cluster;
    const weights = CLUSTER_WEIGHTS[cluster] || CLUSTER_WEIGHTS.unsupported;

    const [dimsRow] = await sql`
      SELECT * FROM student_dimensions WHERE student_id = ${session.userId}
    `;
    const baseDims: DimVector = {
      dim_academic:      Number(dimsRow?.dim_academic ?? 0),
      dim_credentialing: Number(dimsRow?.dim_credentialing ?? 0),
      dim_practical:     Number(dimsRow?.dim_practical ?? 0),
      dim_portfolio:     Number(dimsRow?.dim_portfolio ?? 0),
      dim_domain:        Number(dimsRow?.dim_domain ?? 0),
      dim_prof_dev:      Number(dimsRow?.dim_prof_dev ?? 0),
      dim_soft_skills:   Number(dimsRow?.dim_soft_skills ?? 0),
    };

    const matrix = await computeBoostMatrix(cluster);

    // Sum boosts per role_category from the active skills.
    const roleBoost: Record<string, number> = {};
    for (const skillKey of activeSkills) {
      const roleMap = matrix[skillKey];
      if (!roleMap) continue;
      for (const [role, boost] of Object.entries(roleMap)) {
        roleBoost[role] = (roleBoost[role] ?? 0) + boost;
      }
    }

    // Simulated domain: base dim_domain lifted by the boost toward the target role.
    // target_role may be stored as an array — normalize to a single role string.
    let targetRole: string | null = student.target_role ?? null;
    if (Array.isArray(targetRole)) targetRole = targetRole[0] ?? null;
    if (typeof targetRole === 'string' && targetRole.startsWith('[')) {
      try {
        const parsed = JSON.parse(targetRole);
        targetRole = Array.isArray(parsed) ? parsed[0] ?? null : targetRole;
      } catch { /* keep as-is */ }
    }
    const targetBoost = targetRole ? roleBoost[targetRole] ?? 0 : 0;
    const simDims: DimVector = {
      ...baseDims,
      dim_domain: Math.min(100, baseDims.dim_domain + targetBoost),
    };

    // Simulated general readiness with the boosted domain.
    const simReadiness =
      (simDims.dim_academic * weights.academic +
        simDims.dim_credentialing * weights.credentialing +
        simDims.dim_practical * weights.practical +
        simDims.dim_portfolio * weights.portfolio +
        simDims.dim_domain * weights.domain +
        simDims.dim_prof_dev * weights.prof_dev +
        simDims.dim_soft_skills * weights.soft_skills) /
      100;

    // Per-role simulated match: base role-match plus the role's accumulated boost.
    const clusterRoles = (roleCatalog as any[]).filter((r) => r.cluster === cluster);
    const roleMatches = await Promise.all(
      clusterRoles.map(async (role) => {
        const jobs = await sql`
          SELECT dimension_requirements FROM jobs
          WHERE role_category = ${role.key} AND status = 'open' AND cluster = ${cluster}
        `;
        let avgReq: Partial<DimVector> = {};
        if (jobs.length > 0) {
          const sums: Record<string, number> = {};
          for (const j of jobs) {
            const req = j.dimension_requirements as Record<string, number>;
            for (const [k, v] of Object.entries(req)) {
              sums[k] = (sums[k] ?? 0) + Number(v);
            }
          }
          for (const [k, v] of Object.entries(sums)) {
            (avgReq as any)[k] = v / jobs.length;
          }
        }
        const baseMatch = computeRoleMatch(baseDims, avgReq, cluster);
        const boost = roleBoost[role.key] ?? 0;
        const simMatch = Math.min(100, baseMatch + boost);
        return {
          role_key: role.key,
          name_en: role.name_en,
          name_ar: role.name_ar,
          base_match: baseMatch,
          simulated_match: simMatch,
        };
      }),
    );

    roleMatches.sort((a, b) => b.simulated_match - a.simulated_match);

    return NextResponse.json({
      base_dims: baseDims,
      simulated_dims: simDims,
      base_readiness: Number((dimsRow?.general_readiness ?? 0)),
      simulated_readiness: Number(simReadiness.toFixed(2)),
      role_matches: roleMatches,
    });
  } catch (error: any) {
    console.error('POST /api/simulator/compute error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

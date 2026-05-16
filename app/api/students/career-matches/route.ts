/**
 * GET /api/students/career-matches
 *
 * Returns top role matches for the current student, sorted descending by match score.
 * Uses the role catalog filtered by student's cluster.
 * Computes role-match using the average dimension_requirements of open jobs per role.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeRoleMatch, type DimVector } from '@/lib/role-match';
import roleCatalog from '@/data/role-catalog.json';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get student cluster + dims
    const [student] = await sql`SELECT cluster FROM students WHERE user_id = ${session.userId}`;
    if (!student) return NextResponse.json({ matches: [] });

    const [dimsRow] = await sql`SELECT * FROM student_dimensions WHERE student_id = ${session.userId}`;
    const studentDims: DimVector = dimsRow
      ? {
          dim_academic:      Number(dimsRow.dim_academic),
          dim_credentialing: Number(dimsRow.dim_credentialing),
          dim_practical:     Number(dimsRow.dim_practical),
          dim_portfolio:     Number(dimsRow.dim_portfolio),
          dim_domain:        Number(dimsRow.dim_domain),
          dim_prof_dev:      Number(dimsRow.dim_prof_dev),
          dim_soft_skills:   Number(dimsRow.dim_soft_skills),
        }
      : {
          dim_academic: 0, dim_credentialing: 0, dim_practical: 0,
          dim_portfolio: 0, dim_domain: 0, dim_prof_dev: 0, dim_soft_skills: 0,
        };

    // Filter roles by student's cluster
    const clusterRoles = (roleCatalog as any[]).filter(r => r.cluster === student.cluster);

    // For each role, compute average required dims from open jobs
    const matches = await Promise.all(
      clusterRoles.map(async (role) => {
        const jobs = await sql`
          SELECT dimension_requirements
          FROM jobs
          WHERE role_category = ${role.key}
            AND cluster = ${student.cluster}
            AND status = 'open'
        `;

        let avgRequired: Partial<DimVector> = {};
        if (jobs.length > 0) {
          const sums: Record<string, number> = {};
          for (const job of jobs) {
            const req = job.dimension_requirements as Record<string, number>;
            for (const [k, v] of Object.entries(req)) {
              sums[k] = (sums[k] ?? 0) + Number(v);
            }
          }
          for (const [k, v] of Object.entries(sums)) {
            (avgRequired as any)[k] = v / jobs.length;
          }
        } else {
          // No jobs posted for this role — use cluster defaults
          const defaults: Record<string, Partial<DimVector>> = {
            medicine:    { dim_academic: 75, dim_credentialing: 70, dim_practical: 55, dim_portfolio: 35, dim_domain: 55, dim_prof_dev: 45, dim_soft_skills: 55 },
            engineering: { dim_academic: 65, dim_credentialing: 55, dim_practical: 60, dim_portfolio: 60, dim_domain: 50, dim_prof_dev: 45, dim_soft_skills: 50 },
            tech:        { dim_academic: 55, dim_credentialing: 50, dim_practical: 55, dim_portfolio: 65, dim_domain: 60, dim_prof_dev: 45, dim_soft_skills: 45 },
          };
          avgRequired = defaults[student.cluster] ?? defaults.tech;
        }

        const score = computeRoleMatch(studentDims, avgRequired, student.cluster);
        return {
          key:      role.key,
          name_en:  role.name_en,
          name_ar:  role.name_ar,
          cluster:  role.cluster,
          score,
          job_count: jobs.length,
        };
      })
    );

    // Sort descending by score, return top 4
    const sorted = matches.sort((a, b) => b.score - a.score).slice(0, 4);
    return NextResponse.json({ matches: sorted });
  } catch (error: any) {
    console.error('GET /api/students/career-matches error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

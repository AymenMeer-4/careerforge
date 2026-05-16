/**
 * GET /api/insights/career-fit
 *
 * Career Fit Distribution: the student's Job Readiness averaged across all open
 * jobs in each role category of the role catalog (Section 5.8).
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeRoleMatch } from '@/lib/role-match';
import { loadStudentDimensions, normalizeRequirements } from '@/lib/job-helpers';
import roleCatalog from '@/data/role-catalog.json';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const studentId = session.userId;

    const [student] = await sql`SELECT cluster FROM students WHERE user_id = ${studentId}`;
    const cluster: string = student?.cluster ?? 'tech';
    const { dims } = await loadStudentDimensions(studentId);

    const jobs = await sql`
      SELECT role_category, dimension_requirements FROM jobs WHERE status = 'open'
    `;

    const roles = (roleCatalog as any[]).filter((r) => r.cluster === cluster);

    const distribution = roles.map((role) => {
      const inCategory = jobs.filter((j: any) => j.role_category === role.key);
      let score = 0;
      if (inCategory.length > 0) {
        const sum = inCategory.reduce(
          (acc: number, j: any) =>
            acc + computeRoleMatch(dims, normalizeRequirements(j.dimension_requirements), cluster),
          0,
        );
        score = Math.round(sum / inCategory.length);
      }
      return {
        key: role.key,
        name_en: role.name_en,
        name_ar: role.name_ar,
        score,
        job_count: inCategory.length,
      };
    });

    distribution.sort((a, b) => b.score - a.score);

    return NextResponse.json({ distribution });
  } catch (error: any) {
    console.error('GET /api/insights/career-fit error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

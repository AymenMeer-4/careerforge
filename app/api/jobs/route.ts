/**
 * GET /api/jobs
 *
 * Returns open jobs with a live per-job Job Readiness score (Section 8.2),
 * filtered by the student's opportunity_types intersecting jobs.posting_type.
 * Optional query params: ?posting_type= &cluster= &region= &sort= &limit=
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeRoleMatch } from '@/lib/role-match';
import { loadStudentDimensions, normalizeRequirements } from '@/lib/job-helpers';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const studentId = session.userId;

    const [student] = await sql`
      SELECT cluster, opportunity_types FROM students WHERE user_id = ${studentId}
    `;
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }
    const cluster: string = student.cluster ?? 'tech';
    const opportunityTypes: string[] = Array.isArray(student.opportunity_types)
      ? student.opportunity_types
      : [];

    const { dims } = await loadStudentDimensions(studentId);

    const url = new URL(req.url);
    const filterPostingType = url.searchParams.get('posting_type');
    const filterCluster = url.searchParams.get('cluster');
    const filterRegion = url.searchParams.get('region');
    const sort = url.searchParams.get('sort') ?? 'readiness';
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : null;

    const rows = await sql`
      SELECT j.*, c.company_name, c.verification_status
      FROM jobs j
      JOIN corporates c ON c.user_id = j.corporate_id
      WHERE j.status = 'open'
    `;

    let jobs = rows.map((j: any) => {
      const job_readiness = computeRoleMatch(dims, normalizeRequirements(j.dimension_requirements), cluster);
      return { ...j, job_readiness };
    });

    // Filter by opportunity_types ∩ posting_type (only when the student has set preferences)
    if (opportunityTypes.length > 0) {
      jobs = jobs.filter((j: any) => opportunityTypes.includes(j.posting_type));
    }
    if (filterPostingType) jobs = jobs.filter((j: any) => j.posting_type === filterPostingType);
    if (filterCluster) jobs = jobs.filter((j: any) => j.cluster === filterCluster);
    if (filterRegion) jobs = jobs.filter((j: any) => j.location_region === filterRegion);

    // Sort
    if (sort === 'date') {
      jobs.sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sort === 'deadline') {
      jobs.sort((a: any, b: any) => {
        const da = a.deadline ? +new Date(a.deadline) : Infinity;
        const db = b.deadline ? +new Date(b.deadline) : Infinity;
        return da - db;
      });
    } else {
      jobs.sort((a: any, b: any) => b.job_readiness - a.job_readiness);
    }

    if (limit) jobs = jobs.slice(0, limit);

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error('GET /api/jobs error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

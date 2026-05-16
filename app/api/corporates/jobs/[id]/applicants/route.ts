/**
 * GET /api/corporates/jobs/[id]/applicants
 *
 * Applicants for one of THIS corporate's jobs, sorted by match_score DESC.
 * Each row: student name, university, year, match_score, top 3 strengths,
 * top 2 gaps (deterministic, via computeJobBreakdown + loadStudentDimensions).
 * Does NOT include fit_summary — that is loaded on-demand on the detail page.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import {
  loadStudentDimensions,
  normalizeRequirements,
  computeJobBreakdown,
} from '@/lib/job-helpers';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'corporate') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;

    const [job] = await sql`
      SELECT * FROM jobs WHERE id = ${id} AND corporate_id = ${session.userId}
    `;
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const requirements = normalizeRequirements(job.dimension_requirements);

    const full = await sql`
      SELECT a.id AS application_id, a.student_id, a.status, a.match_score, a.applied_at,
             u.name, s.university, s.year_of_study
      FROM applications a
      JOIN students s ON s.user_id = a.student_id
      JOIN users u ON u.id = a.student_id
      WHERE a.job_id = ${id}
      ORDER BY a.match_score DESC, a.applied_at ASC
    `;

    const result = [];
    for (const r of full) {
      const { dims } = await loadStudentDimensions(r.student_id);
      const { strengths, gaps } = computeJobBreakdown(dims, requirements);
      result.push({
        application_id: r.application_id,
        student_id: r.student_id,
        name: r.name,
        university: r.university,
        year_of_study: r.year_of_study,
        status: r.status,
        match_score: Number(r.match_score),
        applied_at: r.applied_at,
        strengths,
        gaps,
      });
    }

    return NextResponse.json({ job, applicants: result });
  } catch (error: any) {
    console.error('GET /api/corporates/jobs/[id]/applicants error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

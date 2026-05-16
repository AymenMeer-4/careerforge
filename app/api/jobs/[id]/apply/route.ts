/**
 * POST /api/jobs/[id]/apply
 *
 * Creates an applications row, persisting the live job_readiness (Section 8.2)
 * into applications.match_score.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeRoleMatch } from '@/lib/role-match';
import { loadStudentDimensions, normalizeRequirements } from '@/lib/job-helpers';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const studentId = session.userId;
    const { id } = await params;

    const [job] = await sql`SELECT * FROM jobs WHERE id = ${id}`;
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.status !== 'open') {
      return NextResponse.json({ error: 'This job is no longer open.' }, { status: 400 });
    }

    const [existing] = await sql`
      SELECT id FROM applications WHERE job_id = ${id} AND student_id = ${studentId}
    `;
    if (existing) {
      return NextResponse.json({ error: 'You have already applied to this job.' }, { status: 409 });
    }

    const [student] = await sql`SELECT cluster FROM students WHERE user_id = ${studentId}`;
    const cluster: string = student?.cluster ?? 'tech';
    const { dims } = await loadStudentDimensions(studentId);
    const matchScore = computeRoleMatch(dims, normalizeRequirements(job.dimension_requirements), cluster);

    const [application] = await sql`
      INSERT INTO applications (job_id, student_id, status, match_score)
      VALUES (${id}, ${studentId}, 'submitted', ${matchScore})
      RETURNING *
    `;

    return NextResponse.json({ success: true, application });
  } catch (error: any) {
    console.error('POST /api/jobs/[id]/apply error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

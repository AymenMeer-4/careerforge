/**
 * GET /api/jobs/[id]
 *
 * Returns the full job + the student's cached general_readiness + a freshly
 * computed job_readiness for THIS job + a breakdown (top 3 strengths, top 2
 * gaps) relative to this job's dimension_requirements and required_skills.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeRoleMatch } from '@/lib/role-match';
import {
  loadStudentDimensions,
  normalizeRequirements,
  computeJobBreakdown,
  asArray,
} from '@/lib/job-helpers';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const studentId = session.userId;
    const { id } = await params;

    const [job] = await sql`
      SELECT j.*, c.company_name, c.verification_status
      FROM jobs j
      JOIN corporates c ON c.user_id = j.corporate_id
      WHERE j.id = ${id}
    `;
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const [student] = await sql`SELECT cluster FROM students WHERE user_id = ${studentId}`;
    const cluster: string = student?.cluster ?? 'tech';

    const { dims, generalReadiness } = await loadStudentDimensions(studentId);
    const requirements = normalizeRequirements(job.dimension_requirements);
    const job_readiness = computeRoleMatch(dims, requirements, cluster);

    const { strengths, gaps } = computeJobBreakdown(dims, requirements);

    // Skill overlap — which required skills the student already has.
    const studentSkills = await sql`
      SELECT skill_key, skill_canonical_name FROM student_skills WHERE student_id = ${studentId}
    `;
    const haveSkillKeys = new Set(studentSkills.map((s: any) => s.skill_key));
    const requiredSkills = asArray<{ skill: string; importance: number }>(job.required_skills);
    const haveSkills = requiredSkills.filter((s) => haveSkillKeys.has(s.skill)).map((s) => s.skill);
    const missingSkills = requiredSkills.filter((s) => !haveSkillKeys.has(s.skill)).map((s) => s.skill);

    // Whether this student already applied.
    const [existingApp] = await sql`
      SELECT id, status FROM applications WHERE job_id = ${id} AND student_id = ${studentId}
    `;

    return NextResponse.json({
      job,
      general_readiness: generalReadiness,
      job_readiness,
      breakdown: { strengths, gaps, haveSkills, missingSkills },
      already_applied: !!existingApp,
    });
  } catch (error: any) {
    console.error('GET /api/jobs/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

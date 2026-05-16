/**
 * GET /api/corporates/applications/[id]
 * Full applicant detail for the corporate detail page (ownership-checked).
 * Deterministic strengths/gaps via computeJobBreakdown. Does NOT include the
 * AI fit summary — that is loaded separately from .../fit-summary.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import {
  loadStudentDimensions,
  normalizeRequirements,
  computeJobBreakdown,
  asArray,
} from '@/lib/job-helpers';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'corporate') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;

    const [app] = await sql`
      SELECT a.id, a.status, a.match_score, a.applied_at, a.student_id,
             a.rejection_primary_reason, a.rejection_comment, a.rejection_gap_tags,
             j.id AS job_id, j.title AS job_title, j.required_skills, j.dimension_requirements,
             u.name, s.university, s.year_of_study, s.gpa_value, s.gpa_scale,
             s.cluster, s.target_role, s.hours_per_week
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      JOIN students s ON s.user_id = a.student_id
      JOIN users u ON u.id = a.student_id
      WHERE a.id = ${id} AND j.corporate_id = ${session.userId}
    `;
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const { dims } = await loadStudentDimensions(app.student_id);
    const requirements = normalizeRequirements(app.dimension_requirements);
    const { strengths, gaps } = computeJobBreakdown(dims, requirements);

    const [{ done_nodes }] = await sql`
      SELECT COUNT(*)::int AS done_nodes FROM roadmap_nodes
      WHERE student_id = ${app.student_id} AND status = 'completed'
    `;
    const [{ high_total }] = await sql`
      SELECT COUNT(*)::int AS high_total FROM student_skills
      WHERE student_id = ${app.student_id} AND proficiency_level = 'high'
    `;
    const [{ high_validated }] = await sql`
      SELECT COUNT(*)::int AS high_validated FROM student_skills
      WHERE student_id = ${app.student_id} AND proficiency_level = 'high'
        AND validation_status = 'validated'
    `;

    return NextResponse.json({
      application: {
        id: app.id,
        status: app.status,
        match_score: Number(app.match_score),
        applied_at: app.applied_at,
        rejection_primary_reason: app.rejection_primary_reason,
        rejection_comment: app.rejection_comment,
        rejection_gap_tags: asArray<string>(app.rejection_gap_tags),
      },
      job: {
        id: app.job_id,
        title: app.job_title,
        required_skills: asArray<{ skill: string; importance: number }>(app.required_skills),
      },
      student: {
        name: app.name,
        university: app.university,
        year_of_study: app.year_of_study,
        gpa_value: Number(app.gpa_value),
        gpa_scale: app.gpa_scale,
        cluster: app.cluster,
        target_role: String(app.target_role ?? ''),
        hours_per_week: app.hours_per_week,
        completed_roadmap_nodes: Number(done_nodes ?? 0),
        high_skills_total: Number(high_total ?? 0),
        high_skills_validated: Number(high_validated ?? 0),
      },
      strengths,
      gaps,
    });
  } catch (error: any) {
    console.error('GET /api/corporates/applications/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

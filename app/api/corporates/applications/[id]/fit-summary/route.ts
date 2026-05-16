/**
 * GET /api/corporates/applications/[id]/fit-summary — Section 7 / 9.9 (Claude #9)
 *
 * Requires a corporate session AND ownership of the parent job.
 *
 * Cache rules (cached on the applications row):
 *  - cached & fresh  (generated_at >= profile_updated_at)  → return, stale:false
 *  - cached & stale  (student profile changed since)        → return, stale:true
 *  - empty OR ?regenerate=true                              → call Claude #9,
 *    persist, return stale:false. On Claude failure persist the real fallback
 *    message (no fake summary), deterministic strengths/gaps stay visible.
 *
 * "profile_updated_at" = GREATEST(students.updated_at, latest skill update,
 * student_dimensions.last_computed_at) so a newly validated skill (which
 * recomputes dimensions) also invalidates the cache.
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
import { callClaudeValidated } from '@/lib/claude-retry';
import {
  buildApplicantFitSummaryPrompt,
  ApplicantFitSummarySchema,
} from '@/lib/prompts/applicant-fit-summary';

const FALLBACK_EN = 'AI summary unavailable. Review the deterministic strengths and gaps above.';
const FALLBACK_AR = 'ملخص الذكاء الاصطناعي غير متاح. راجع نقاط القوة والفجوات الموضحة أعلاه.';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'corporate') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const regenerate = new URL(req.url).searchParams.get('regenerate') === 'true';

    const [app] = await sql`
      SELECT a.*, j.id AS job_id, j.title, j.role_category, j.required_skills,
             j.required_certs, j.required_experience_years, j.required_education_level,
             j.dimension_requirements, j.cluster
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.id = ${id} AND j.corporate_id = ${session.userId}
    `;
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const [profileUpdated] = await sql`
      SELECT GREATEST(
        s.updated_at,
        COALESCE((SELECT MAX(updated_at) FROM student_skills WHERE student_id = s.user_id), s.updated_at),
        COALESCE((SELECT last_computed_at FROM student_dimensions WHERE student_id = s.user_id), s.updated_at)
      ) AS profile_updated_at
      FROM students s WHERE s.user_id = ${app.student_id}
    `;
    const profileUpdatedAt: Date | null = profileUpdated?.profile_updated_at
      ? new Date(profileUpdated.profile_updated_at)
      : null;

    const cached = app.fit_summary_en != null;
    const generatedAt: Date | null = app.fit_summary_generated_at
      ? new Date(app.fit_summary_generated_at)
      : null;
    const isStale =
      !generatedAt || !profileUpdatedAt ? cached : generatedAt < profileUpdatedAt;

    if (cached && !regenerate) {
      return NextResponse.json({
        summary_en: app.fit_summary_en,
        summary_ar: app.fit_summary_ar,
        risk_flags: asArray<string>(app.fit_summary_risk_flags),
        recommended_action: app.fit_summary_recommended_action,
        generated_at: app.fit_summary_generated_at,
        stale: !!isStale,
      });
    }

    // ── Generate (cache empty or forced regenerate) ──────────────────────────
    const [student] = await sql`
      SELECT s.*, u.name FROM students s JOIN users u ON u.id = s.user_id
      WHERE s.user_id = ${app.student_id}
    `;
    const { dims } = await loadStudentDimensions(app.student_id);
    const requirements = normalizeRequirements(app.dimension_requirements);
    const cluster: string = student?.cluster ?? app.cluster ?? 'tech';
    const jobReadiness = computeRoleMatch(dims, requirements, cluster);
    const { strengths, gaps } = computeJobBreakdown(dims, requirements);

    const skills = await sql`
      SELECT skill_canonical_name, proficiency_level, validation_status
      FROM student_skills WHERE student_id = ${app.student_id}
    `;
    const [{ verified_certs }] = await sql`
      SELECT COUNT(*)::int AS verified_certs FROM student_experiences
      WHERE student_id = ${app.student_id} AND type = 'certificate' AND verification_status = 'verified'
    `;
    const [{ avg_mock }] = await sql`
      SELECT AVG(total_score)::float AS avg_mock FROM mock_interview_sessions
      WHERE student_id = ${app.student_id}
    `;
    const [{ done_nodes }] = await sql`
      SELECT COUNT(*)::int AS done_nodes FROM roadmap_nodes
      WHERE student_id = ${app.student_id} AND status = 'completed'
    `;

    const { system, userMessage } = buildApplicantFitSummaryPrompt({
      studentProfile: {
        cluster,
        year_of_study: String(student?.year_of_study ?? ''),
        gpa_value: Number(student?.gpa_value ?? 0),
        gpa_scale: String(student?.gpa_scale ?? ''),
        target_role: String(student?.target_role ?? ''),
        opportunity_types: asArray<string>(student?.opportunity_types),
        verified_certs_count: Number(verified_certs ?? 0),
        mock_interview_avg: avg_mock == null ? null : Number(avg_mock),
        completed_roadmap_nodes: Number(done_nodes ?? 0),
      },
      studentDims: dims,
      studentSkills: skills.map((s: any) => ({
        skill_canonical_name: s.skill_canonical_name,
        proficiency_level: s.proficiency_level,
        validation_status: s.validation_status,
      })),
      job: {
        title: app.title,
        role_category: app.role_category,
        required_skills: asArray<{ skill: string; importance: number }>(app.required_skills),
        required_certs: asArray<string>(app.required_certs),
        required_experience_years: Number(app.required_experience_years),
        required_education_level: app.required_education_level,
        dimension_requirements: requirements,
      },
      jobReadiness,
      topStrengths: strengths,
      topGaps: gaps,
    });

    const result = await callClaudeValidated(system, userMessage, ApplicantFitSummarySchema, {
      temperature: 0.3,
      max_tokens: 1200,
    });

    let summary_en: string;
    let summary_ar: string;
    let risk_flags: string[];
    let recommended_action: string | null;

    if (result.ok) {
      summary_en = result.data.summary_en;
      summary_ar = result.data.summary_ar;
      risk_flags = result.data.risk_flags ?? [];
      recommended_action = result.data.recommended_action;
    } else {
      console.error('fit-summary: Claude #9 failed —', result.error);
      summary_en = FALLBACK_EN;
      summary_ar = FALLBACK_AR;
      risk_flags = [];
      recommended_action = null;
    }

    const [updated] = await sql`
      UPDATE applications SET
        fit_summary_en = ${summary_en},
        fit_summary_ar = ${summary_ar},
        fit_summary_risk_flags = ${sql.json(risk_flags)},
        fit_summary_recommended_action = ${recommended_action},
        fit_summary_generated_at = NOW()
      WHERE id = ${id}
      RETURNING fit_summary_generated_at
    `;

    return NextResponse.json({
      summary_en,
      summary_ar,
      risk_flags,
      recommended_action,
      generated_at: updated.fit_summary_generated_at,
      stale: false,
    });
  } catch (error: any) {
    console.error('GET /api/corporates/applications/[id]/fit-summary error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

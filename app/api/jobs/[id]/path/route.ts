/**
 * GET /api/jobs/[id]/path — "Close the Gap" (Claude #6, Section 9.6)
 *
 * Computes the per-job gap, calls Claude for 3–5 specific steps, validates with
 * Zod (retry once on malformed JSON), and returns { steps }. Persists nothing —
 * persistence happens only via POST /api/roadmap/nodes ("Add to my Roadmap").
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeRoleMatch } from '@/lib/role-match';
import { loadStudentDimensions, normalizeRequirements, DIM_KEYS, asArray } from '@/lib/job-helpers';
import { buildJobPathPrompt, JobPathStepsSchema } from '@/lib/prompts/job-path';
import { callClaudeValidated } from '@/lib/claude-retry';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const studentId = session.userId;
    const { id } = await params;

    const [job] = await sql`
      SELECT j.*, c.company_name
      FROM jobs j
      JOIN corporates c ON c.user_id = j.corporate_id
      WHERE j.id = ${id}
    `;
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const [student] = await sql`SELECT * FROM students WHERE user_id = ${studentId}`;
    if (!student) return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    const cluster: string = student.cluster ?? 'tech';

    const { dims, generalReadiness } = await loadStudentDimensions(studentId);
    const requirements = normalizeRequirements(job.dimension_requirements);
    const jobReadiness = computeRoleMatch(dims, requirements, cluster);

    // Already well-matched — no path needed (handled with an empty-state on the page).
    if (jobReadiness >= 95) {
      return NextResponse.json({ steps: [], already_matched: true });
    }

    // ── Compute the gap ───────────────────────────────────────────────────────
    const dimensionDeltas: Record<string, number> = {};
    for (const key of DIM_KEYS) {
      const deficit = (requirements[key] ?? 0) - (dims[key] ?? 0);
      if (deficit > 0) dimensionDeltas[key] = deficit;
    }

    const studentSkills = await sql`SELECT skill_key FROM student_skills WHERE student_id = ${studentId}`;
    const haveSkillKeys = new Set(studentSkills.map((s: any) => s.skill_key));
    const requiredSkills = asArray<{ skill: string; importance: number }>(job.required_skills);
    const missingSkills = requiredSkills.filter((s) => !haveSkillKeys.has(s.skill)).map((s) => s.skill);

    const experiences = await sql`
      SELECT title FROM student_experiences
      WHERE student_id = ${studentId} AND type IN ('certificate', 'training')
    `;
    const requiredCerts = asArray<string>(job.required_certs);
    const missingCerts = requiredCerts.filter(
      (cert) =>
        !experiences.some((e: any) =>
          String(e.title || '').toLowerCase().includes(String(cert).toLowerCase()),
        ),
    );

    // ── Build prompt & call Claude (#6) ───────────────────────────────────────
    const { system, userMessage } = buildJobPathPrompt({
      studentProfile: {
        name: undefined,
        cluster,
        year_of_study: student.year_of_study,
        gpa_value: Number(student.gpa_value),
        gpa_scale: student.gpa_scale,
        target_role: String(student.target_role ?? 'n/a'),
        opportunity_types: Array.isArray(student.opportunity_types) ? student.opportunity_types : [],
      },
      studentDims: dims,
      generalReadiness,
      jobReadiness,
      job: {
        title: job.title,
        company_name: job.company_name,
        role_category: job.role_category,
        required_skills: requiredSkills,
        required_certs: requiredCerts,
        required_experience_years: job.required_experience_years,
        required_education_level: job.required_education_level,
        dimension_requirements: requirements,
      },
      gap: { dimensionDeltas, missingSkills, missingCerts },
    });

    const result = await callClaudeValidated(system, userMessage, JobPathStepsSchema, {
      max_tokens: 4000,
      temperature: 0.3,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: `Close the Gap generation failed: ${result.error}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ steps: result.data, job_readiness: jobReadiness });
  } catch (error: any) {
    console.error('GET /api/jobs/[id]/path error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

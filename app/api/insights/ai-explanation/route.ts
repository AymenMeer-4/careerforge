/**
 * POST /api/insights/ai-explanation — Claude #4 (Section 9.4)
 *
 * Explains why the student is matched to their top role and the growth
 * trajectory for it. Bilingual output.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeRoleMatch } from '@/lib/role-match';
import {
  loadStudentDimensions,
  normalizeRequirements,
  DIM_KEYS,
  DIM_LABEL_EN,
} from '@/lib/job-helpers';
import { buildInsightExplanationPrompt, InsightExplanationSchema } from '@/lib/prompts/insight-explanation';
import { callClaudeValidated } from '@/lib/claude-retry';
import roleCatalog from '@/data/role-catalog.json';

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const studentId = session.userId;

    const [student] = await sql`SELECT * FROM students WHERE user_id = ${studentId}`;
    if (!student) return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    const cluster: string = student.cluster ?? 'tech';

    const { dims } = await loadStudentDimensions(studentId);

    // Determine the top-match role: highest average Job Readiness across its open jobs.
    const jobs = await sql`SELECT role_category, dimension_requirements FROM jobs WHERE status = 'open'`;
    const roles = (roleCatalog as any[]).filter((r) => r.cluster === cluster);

    let topRole = roles[0] ?? { key: 'n/a', name_en: 'N/A', name_ar: 'غير متاح' };
    let topScore = 0;
    for (const role of roles) {
      const inCategory = jobs.filter((j: any) => j.role_category === role.key);
      if (inCategory.length === 0) continue;
      const avg =
        inCategory.reduce(
          (acc: number, j: any) =>
            acc + computeRoleMatch(dims, normalizeRequirements(j.dimension_requirements), cluster),
          0,
        ) / inCategory.length;
      if (avg > topScore) {
        topScore = avg;
        topRole = role;
      }
    }

    // Strongest contributing dimensions (by raw value).
    const strengths = [...DIM_KEYS]
      .sort((a, b) => (dims[b] ?? 0) - (dims[a] ?? 0))
      .slice(0, 3)
      .map((k) => DIM_LABEL_EN[k]);

    const { system, userMessage } = buildInsightExplanationPrompt({
      studentProfile: {
        cluster,
        specialty: student.specialty,
        year_of_study: student.year_of_study,
        gpa_value: Number(student.gpa_value),
        gpa_scale: student.gpa_scale,
      },
      studentDims: dims,
      topRoleName: topRole.name_en,
      topRoleScore: topScore,
      strengths,
    });

    const result = await callClaudeValidated(system, userMessage, InsightExplanationSchema, {
      max_tokens: 1500,
      temperature: 0.4,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: `AI explanation failed: ${result.error}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      explanation: result.data,
      top_role: { key: topRole.key, name_en: topRole.name_en, name_ar: topRole.name_ar },
      top_score: Math.round(topScore),
    });
  } catch (error: any) {
    console.error('POST /api/insights/ai-explanation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

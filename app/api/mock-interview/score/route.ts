/**
 * POST /api/mock-interview/score — Claude #3 (Section 9.3)
 *
 * Scores a mock-interview response, persists the session to
 * mock_interview_sessions, then recomputes readiness (dim_soft_skills is the
 * average of all session total_scores — recomputed in lib/readiness.ts).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeStudentDimensions } from '@/lib/readiness';
import { buildMockInterviewPrompt, MockInterviewSchema } from '@/lib/prompts/mock-interview';
import { callClaudeValidated } from '@/lib/claude-retry';
import scenarios from '@/data/mock-interview-scenarios.json';

const BodySchema = z.object({
  scenario_key: z.string().min(1),
  response_text: z.string().min(50, 'Response must be at least 50 characters.'),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const studentId = session.userId;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { scenario_key, response_text } = parsed.data;

    // Resolve the scenario text from the seed data.
    const flat = Object.values(scenarios as Record<string, any[]>).flat();
    const scenario = flat.find((s) => s.scenario_key === scenario_key);
    if (!scenario) {
      return NextResponse.json({ error: 'Unknown scenario.' }, { status: 400 });
    }

    const { system, userMessage } = buildMockInterviewPrompt({
      scenario: scenario.prompt_en,
      response: response_text,
    });

    const result = await callClaudeValidated(system, userMessage, MockInterviewSchema, {
      max_tokens: 2000,
      temperature: 0,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: `Mock interview scoring failed: ${result.error}` },
        { status: 500 },
      );
    }
    const r = result.data;

    // Persist the session.
    await sql`
      INSERT INTO mock_interview_sessions (
        student_id, scenario_key, response_text,
        clarity, specificity, relevance, depth, structure,
        total_score, feedback_text, improvement_areas
      ) VALUES (
        ${studentId}, ${scenario_key}, ${response_text},
        ${r.clarity}, ${r.specificity}, ${r.relevance}, ${r.depth}, ${r.structure},
        ${r.total}, ${r.feedback}, ${JSON.stringify(r.improvement_areas)}
      )
    `;

    // Recompute readiness — dim_soft_skills = AVG(mock_interview_sessions.total_score).
    await computeStudentDimensions(studentId);

    return NextResponse.json({ result: r });
  } catch (error: any) {
    console.error('POST /api/mock-interview/score error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/skills/validate-start  — Claude #8a (Section 9.8a)
 * Body: { skill_key, skill_canonical_name, description_en, student_cluster, student_year }
 * Generates 2-3 scenario questions to probe a High claim. Does NOT write to DB.
 * On malformed JSON twice: returns 500 with a real error (no fake questions).
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { callClaude } from '@/lib/claude';
import { parseClaudeJson } from '@/lib/claude-json';
import {
  buildValidationQuestionsPrompt,
  ValidationQuestionsSchema,
} from '@/lib/prompts/skill-validation';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const skill_canonical_name = String(body.skill_canonical_name || '').trim();
    const description_en = String(body.description_en || '').trim();

    if (!skill_canonical_name || !description_en) {
      return NextResponse.json(
        { error: 'skill_canonical_name and description_en are required' },
        { status: 400 },
      );
    }

    // Cluster/year come from the DB so questions are reliably context-aware.
    const [student] = await sql`
      SELECT cluster, year_of_study FROM students WHERE user_id = ${session.userId}
    `;
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }
    const student_cluster = student.cluster;
    const student_year = student.year_of_study;

    const { system, prompt } = buildValidationQuestionsPrompt({
      skill_canonical_name,
      description_en,
      student_cluster,
      student_year,
    });

    const first = await callClaude(system, [{ role: 'user', content: prompt }], {
      max_tokens: 1200,
      temperature: 0.4,
    });
    if (!first.ok) {
      return NextResponse.json({ error: `Claude API error: ${first.error}` }, { status: 500 });
    }

    try {
      const parsed = ValidationQuestionsSchema.parse(parseClaudeJson(first.text));
      return NextResponse.json(parsed);
    } catch {
      const retry = await callClaude(
        system,
        [
          { role: 'user', content: prompt },
          { role: 'assistant', content: first.text },
          {
            role: 'user',
            content:
              'The previous response was malformed JSON. Return ONLY the valid JSON object with a "questions" array of exactly 3 items. Start with { and end with }.',
          },
        ],
        { max_tokens: 1200, temperature: 0 },
      );
      if (!retry.ok) {
        return NextResponse.json(
          { error: `Claude API error on retry: ${retry.error}` },
          { status: 500 },
        );
      }
      try {
        const parsed = ValidationQuestionsSchema.parse(parseClaudeJson(retry.text));
        return NextResponse.json(parsed);
      } catch (err) {
        console.error('skills/validate-start: invalid JSON twice', err);
        return NextResponse.json(
          { error: 'Validation could not generate questions right now.' },
          { status: 500 },
        );
      }
    }
  } catch (error: any) {
    console.error('POST /api/skills/validate-start error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/skills/validate-score  — Claude #8b (Section 9.8b)
 * Body: { skill_canonical_name, questions, responses }
 *   questions:  [{ id, question_en, question_ar }]
 *   responses:  [{ question_id, answer }]
 * Scores the responses and returns scores + avg + recommendation. Does NOT write to DB.
 * On malformed JSON twice: returns 200 with { scoring_failed: true, validation_notes }
 * so the client saves the skill with validation_status='failed' — never a fake score.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { callClaude } from '@/lib/claude';
import { parseClaudeJson } from '@/lib/claude-json';
import {
  buildValidationScoringPrompt,
  ValidationScoringSchema,
} from '@/lib/prompts/skill-validation';

const SCORING_FAILED_NOTES = 'Automatic scoring failed — skill saved at claimed level';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const skill_canonical_name = String(body.skill_canonical_name || '').trim();
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const responses = Array.isArray(body.responses) ? body.responses : [];

    if (!skill_canonical_name || questions.length === 0 || responses.length === 0) {
      return NextResponse.json(
        { error: 'skill_canonical_name, questions and responses are required' },
        { status: 400 },
      );
    }

    const [student] = await sql`
      SELECT cluster, year_of_study FROM students WHERE user_id = ${session.userId}
    `;
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    const { system, prompt } = buildValidationScoringPrompt({
      skill_canonical_name,
      questions,
      responses,
      student_cluster: student.cluster,
      student_year: student.year_of_study,
    });

    const first = await callClaude(system, [{ role: 'user', content: prompt }], {
      max_tokens: 1500,
      temperature: 0,
    });
    if (!first.ok) {
      return NextResponse.json({ error: `Claude API error: ${first.error}` }, { status: 500 });
    }

    try {
      const parsed = ValidationScoringSchema.parse(parseClaudeJson(first.text));
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
              'The previous response was malformed JSON. Return ONLY the valid JSON object with scores, avg_score, reasoning and determined_level. Start with { and end with }.',
          },
        ],
        { max_tokens: 1500, temperature: 0 },
      );
      if (!retry.ok) {
        return NextResponse.json(
          { error: `Claude API error on retry: ${retry.error}` },
          { status: 500 },
        );
      }
      try {
        const parsed = ValidationScoringSchema.parse(parseClaudeJson(retry.text));
        return NextResponse.json(parsed);
      } catch (err) {
        // No fake validation status ever — signal the client to save as 'failed'.
        console.error('skills/validate-score: invalid JSON twice', err);
        return NextResponse.json({
          scoring_failed: true,
          validation_notes: SCORING_FAILED_NOTES,
        });
      }
    }
  } catch (error: any) {
    console.error('POST /api/skills/validate-score error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

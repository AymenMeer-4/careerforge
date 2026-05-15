/**
 * POST /api/skills/describe  — Claude #5 (Section 9.5)
 * Body: { skill_input: string, iteration_history?: SkillIteration[] }
 * Generates a skill description + suggested level. Does NOT write to the DB.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { callClaude } from '@/lib/claude';
import { parseClaudeJson } from '@/lib/claude-json';
import {
  buildSkillDescriptionPrompt,
  SkillDescriptionSchema,
} from '@/lib/prompts/skill-description';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const skillInput = String(body.skill_input || '').trim();
    if (!skillInput) {
      return NextResponse.json({ error: 'skill_input is required' }, { status: 400 });
    }
    const iterationHistory = Array.isArray(body.iteration_history)
      ? body.iteration_history
      : [];

    // Load student context.
    const [student] = await sql`
      SELECT cluster, specialty, year_of_study, gpa_value, gpa_scale, target_role
      FROM students WHERE user_id = ${session.userId}
    `;
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    const otherSkills = await sql`
      SELECT skill_canonical_name, proficiency_level
      FROM student_skills WHERE student_id = ${session.userId}
    `;

    const { system, prompt } = buildSkillDescriptionPrompt({
      skillInput,
      studentContext: {
        cluster: student.cluster,
        specialty: student.specialty,
        year: student.year_of_study,
        gpa_value: student.gpa_value,
        gpa_scale: student.gpa_scale,
        target_role: student.target_role,
        other_skills: otherSkills.map((s: any) => ({
          name: s.skill_canonical_name,
          level: s.proficiency_level,
        })),
      },
      iterationHistory,
    });

    // Call Claude with one retry on malformed JSON.
    const first = await callClaude(system, [{ role: 'user', content: prompt }], {
      max_tokens: 1500,
      temperature: 0.3,
    });
    if (!first.ok) {
      return NextResponse.json({ error: `Claude API error: ${first.error}` }, { status: 500 });
    }

    try {
      const parsed = SkillDescriptionSchema.parse(parseClaudeJson(first.text));
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
              'The previous response was malformed JSON. Return ONLY the valid JSON object, no markdown, no prose. Start with { and end with }.',
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
        const parsed = SkillDescriptionSchema.parse(parseClaudeJson(retry.text));
        return NextResponse.json(parsed);
      } catch (err) {
        console.error('skills/describe: invalid JSON twice', err);
        return NextResponse.json(
          { error: 'Skill description failed: Claude returned invalid JSON twice.' },
          { status: 500 },
        );
      }
    }
  } catch (error: any) {
    console.error('POST /api/skills/describe error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

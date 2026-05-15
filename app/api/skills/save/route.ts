/**
 * POST /api/skills/save
 * Body: the full skill object plus optional validation fields.
 *   { skill_key, skill_canonical_name, description_en, description_ar,
 *     proficiency_level, ai_suggested_level, reasoning_en, reasoning_ar,
 *     iteration_count?, fully_approved?,
 *     validation_status?, validation_questions?, validation_responses?,
 *     validation_score?, validation_notes? }
 * proficiency_score is derived server-side from the level (low=30/mid=60/high=90).
 * Upserts into student_skills, then recomputes readiness.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeStudentDimensions } from '@/lib/readiness';

const SCORE_BY_LEVEL: Record<string, number> = { low: 30, mid: 60, high: 90 };
const VALID_STATUSES = ['not_required', 'skipped', 'validated', 'dropped', 'failed'];

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const studentId = session.userId;

    const body = await req.json();
    const skill_key = String(body.skill_key || '').trim();
    const skill_canonical_name = String(body.skill_canonical_name || '').trim();
    const proficiency_level = String(body.proficiency_level || '').trim();

    if (!skill_key || !skill_canonical_name) {
      return NextResponse.json(
        { error: 'skill_key and skill_canonical_name are required' },
        { status: 400 },
      );
    }
    if (!(proficiency_level in SCORE_BY_LEVEL)) {
      return NextResponse.json(
        { error: 'proficiency_level must be low, mid or high' },
        { status: 400 },
      );
    }

    const proficiency_score = SCORE_BY_LEVEL[proficiency_level];

    let validation_status = String(body.validation_status || 'not_required');
    if (!VALID_STATUSES.includes(validation_status)) {
      validation_status = 'not_required';
    }

    // validated_at is set whenever a validation round actually ran.
    const validationRan = ['validated', 'dropped', 'failed'].includes(validation_status);

    const validation_questions = body.validation_questions
      ? JSON.stringify(body.validation_questions)
      : null;
    const validation_responses = body.validation_responses
      ? JSON.stringify(body.validation_responses)
      : null;
    const validation_score =
      body.validation_score === undefined || body.validation_score === null
        ? null
        : Number(body.validation_score);
    const validation_notes = body.validation_notes ?? null;

    const ai_suggested_level = body.ai_suggested_level ?? null;
    const iteration_count = Number(body.iteration_count ?? 0);
    const fully_approved = body.fully_approved === false ? false : true;

    const [saved] = await sql`
      INSERT INTO student_skills (
        student_id, skill_key, skill_canonical_name, description_en, description_ar,
        proficiency_level, proficiency_score, ai_suggested_level,
        reasoning_en, reasoning_ar, iteration_count, fully_approved,
        validation_status, validation_questions, validation_responses,
        validation_score, validation_notes, validated_at
      ) VALUES (
        ${studentId}, ${skill_key}, ${skill_canonical_name},
        ${body.description_en ?? ''}, ${body.description_ar ?? ''},
        ${proficiency_level}, ${proficiency_score}, ${ai_suggested_level},
        ${body.reasoning_en ?? ''}, ${body.reasoning_ar ?? ''},
        ${iteration_count}, ${fully_approved},
        ${validation_status}, ${validation_questions}, ${validation_responses},
        ${validation_score}, ${validation_notes},
        ${validationRan ? sql`NOW()` : null}
      )
      ON CONFLICT (student_id, skill_key) DO UPDATE SET
        skill_canonical_name = EXCLUDED.skill_canonical_name,
        description_en = EXCLUDED.description_en,
        description_ar = EXCLUDED.description_ar,
        proficiency_level = EXCLUDED.proficiency_level,
        proficiency_score = EXCLUDED.proficiency_score,
        ai_suggested_level = EXCLUDED.ai_suggested_level,
        reasoning_en = EXCLUDED.reasoning_en,
        reasoning_ar = EXCLUDED.reasoning_ar,
        iteration_count = EXCLUDED.iteration_count,
        fully_approved = EXCLUDED.fully_approved,
        validation_status = EXCLUDED.validation_status,
        validation_questions = EXCLUDED.validation_questions,
        validation_responses = EXCLUDED.validation_responses,
        validation_score = EXCLUDED.validation_score,
        validation_notes = EXCLUDED.validation_notes,
        validated_at = EXCLUDED.validated_at,
        updated_at = NOW()
      RETURNING *
    `;

    // Recompute readiness — dim_domain depends on this skill (Section 8.1).
    let dimensions = null;
    try {
      dimensions = await computeStudentDimensions(studentId);
    } catch (recomputeErr) {
      console.error('skills/save: readiness recompute failed', recomputeErr);
    }

    return NextResponse.json({ skill: saved, dimensions });
  } catch (error: any) {
    console.error('POST /api/skills/save error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { z } from 'zod';

// ── 9.8a — Question generation (level-agnostic: assesses actual proficiency) ──
export const ValidationQuestionSchema = z.object({
  id: z.string().min(1),
  question_en: z.string().min(1),
  question_ar: z.string().min(1),
});

export const ValidationQuestionsSchema = z.object({
  questions: z.array(ValidationQuestionSchema).length(3),
});

export type ValidationQuestion = z.infer<typeof ValidationQuestionSchema>;
export type ValidationQuestions = z.infer<typeof ValidationQuestionsSchema>;

export function buildValidationQuestionsPrompt({
  skill_canonical_name,
  description_en,
  student_cluster,
  student_year,
}: {
  skill_canonical_name: string;
  description_en: string;
  student_cluster: string;
  student_year: string;
}): { system: string; prompt: string } {
  const system =
    'You generate short scenario questions that reveal a student\'s true proficiency in a skill — from beginner to professional. Return ONLY valid JSON, no prose.';

  const prompt = `A Saudi student in ${student_cluster} cluster, year ${student_year}, is adding ${skill_canonical_name} to their skill profile. Skill context: ${description_en}

Generate EXACTLY 3 short scenario questions that, taken together, reveal the student's actual proficiency level — whether they are a beginner, an independent practitioner, or a professional. Questions must:
- Be realistic Saudi workplace scenarios (not textbook trivia).
- Each be answerable in 1-2 sentences (no multi-paragraph essays).
- Probe judgment / first-instinct decisions, not memorized definitions.
- Range in difficulty so a beginner can attempt question 1 but only a strong practitioner handles question 3 well.
- Cover different facets of the skill (not three variants of the same question).

Return ONLY this JSON:
{
  "questions": [
    { "id": "q1", "question_en": "...", "question_ar": "..." },
    { "id": "q2", "question_en": "...", "question_ar": "..." },
    { "id": "q3", "question_en": "...", "question_ar": "..." }
  ]
}

Example for "Python" (Tech cluster, year 4): "You have a production table with 10M rows and a SELECT query taking 8 seconds. What's the first thing you check?" — probes indexing/EXPLAIN intuition in one sentence.

Bias toward scenarios common in Saudi tech/medicine/engineering employers (Aramco, STC, KFSH, NEOM, etc.). Return ONLY valid JSON, no prose.`;

  return { system, prompt };
}

// ── 9.8b — Response scoring (decides the level from the answers) ─────────────
export const ValidationScoreSchema = z.object({
  question_id: z.string().min(1),
  score: z.number().min(0).max(10),
  feedback_en: z.string().min(1),
  feedback_ar: z.string().min(1),
});

export const ValidationScoringSchema = z.object({
  scores: z.array(ValidationScoreSchema).length(3),
  avg_score: z.number().min(0).max(10),
  reasoning_en: z.string().min(1),
  reasoning_ar: z.string().min(1),
  determined_level: z.enum(['low', 'mid', 'high']),
});

export type ValidationScoring = z.infer<typeof ValidationScoringSchema>;

export function buildValidationScoringPrompt({
  skill_canonical_name,
  questions,
  responses,
  student_cluster,
  student_year,
}: {
  skill_canonical_name: string;
  questions: ValidationQuestion[];
  responses: { question_id: string; answer: string }[];
  student_cluster: string;
  student_year: string;
}): { system: string; prompt: string } {
  const system =
    'You score a student\'s scenario answers honestly but respectfully, then decide their true proficiency level. Return ONLY valid JSON, no prose.';

  const qaBlock = questions
    .map((q, i) => {
      const answer = responses.find((r) => r.question_id === q.id)?.answer ?? '(no answer)';
      return `Q${i + 1} [${q.id}]: ${q.question_en}\nStudent answer: ${answer}`;
    })
    .join('\n\n');

  const prompt = `A student (${student_cluster} cluster, year ${student_year}) is adding ${skill_canonical_name} to their profile and answered 3 scenario questions. Score each answer on a 0-10 scale, then decide their actual proficiency level from the average.

Questions and student responses:
${qaBlock}

Scoring rubric (for each question):
- 9-10: Specific, accurate, shows real-world judgment. References concrete tools/tradeoffs.
- 6-8: Reasonable answer, broadly correct but generic or missing nuance.
- 3-5: Surface understanding. Vague, partial, or shows learning gaps.
- 0-2: Wrong, off-topic, or clearly guessing.

Return ONLY this JSON:
{
  "scores": [
    { "question_id": "q1", "score": 0, "feedback_en": "...", "feedback_ar": "..." },
    { "question_id": "q2", "score": 0, "feedback_en": "...", "feedback_ar": "..." },
    { "question_id": "q3", "score": 0, "feedback_en": "...", "feedback_ar": "..." }
  ],
  "avg_score": 0.0,
  "reasoning_en": "2-3 sentences explaining the level decision, plainly and respectfully.",
  "reasoning_ar": "نفس الشرح بالعربية",
  "determined_level": "low" | "mid" | "high"
}

Level thresholds (from avg_score):
- avg_score >= 7.0 -> "high"  (production / professional / can teach others)
- 4.0 <= avg_score < 7.0 -> "mid"  (comfortable applying it independently on small projects)
- avg_score < 4.0 -> "low"  (beginner / still learning fundamentals)

Be honest but not harsh. The student took the time to answer — respect that. State the level plainly with reasoning. Return ONLY valid JSON.`;

  return { system, prompt };
}

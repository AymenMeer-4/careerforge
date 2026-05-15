import { z } from 'zod';

// ── Response schema (Claude #5 — Section 9.5) ────────────────────────────────
export const SkillDescriptionSchema = z.object({
  skill_key: z.string().min(1),
  skill_canonical_name: z.string().min(1),
  description_en: z.string().min(1),
  description_ar: z.string().min(1),
  suggested_level: z.enum(['low', 'mid', 'high']),
  reasoning_en: z.string().min(1),
  reasoning_ar: z.string().min(1),
});

export type SkillDescription = z.infer<typeof SkillDescriptionSchema>;

// One round of the "Not quite..." refinement loop.
export interface SkillIteration {
  ai_output: SkillDescription;
  student_feedback: string;
}

export interface SkillStudentContext {
  cluster: string;
  specialty: string;
  year: string;
  gpa_value: number | string;
  gpa_scale: string;
  target_role: string | null;
  other_skills: { name: string; level: string }[];
}

export function buildSkillDescriptionPrompt({
  skillInput,
  studentContext,
  iterationHistory,
}: {
  skillInput: string;
  studentContext: SkillStudentContext;
  iterationHistory?: SkillIteration[];
}): { system: string; prompt: string } {
  const otherSkills =
    studentContext.other_skills.length > 0
      ? studentContext.other_skills.map((s) => `${s.name} (${s.level})`).join(', ')
      : 'none yet';

  let iterationBlock = 'None — this is the first attempt.';
  if (iterationHistory && iterationHistory.length > 0) {
    iterationBlock = iterationHistory
      .map((it, i) => {
        return `Iteration ${i + 1}:
  AI suggested: ${it.ai_output.skill_canonical_name} — level "${it.ai_output.suggested_level}"
  AI description: ${it.ai_output.description_en}
  Student feedback / correction: "${it.student_feedback}"`;
      })
      .join('\n');
  }

  const system =
    'You help a Saudi student catalog their skills. You describe a skill and SUGGEST a starting level, but the student always decides their actual level. Return ONLY valid JSON, no prose outside the JSON.';

  const prompt = `A Saudi student is cataloging their skills. They typed: "${skillInput}".

Student profile context:
- Specialty / cluster: ${studentContext.cluster} / ${studentContext.specialty}
- Year of study: ${studentContext.year}
- GPA: ${studentContext.gpa_value} / ${studentContext.gpa_scale}
- Target role: ${studentContext.target_role || 'not set'}
- Other skills already in profile: ${otherSkills}

Previous iterations for this skill (if any):
${iterationBlock}

Generate this JSON exactly:
{
  "skill_key": "kebab-case-slug",
  "skill_canonical_name": "Proper Name",
  "description_en": "2-3 sentences in plain language: what this skill is, why it matters in the Saudi job market.",
  "description_ar": "نفس الوصف باللغة العربية",
  "suggested_level": "low" | "mid" | "high",
  "reasoning_en": "1-2 sentences: why this level is a reasonable starting point for someone with this student's profile. Frame it as a SUGGESTION — the student decides their actual level.",
  "reasoning_ar": "السبب باللغة العربية"
}

Rules:
- The student picks the actual level themselves. Your suggested_level is a starting hint, NOT a decision.
- If iteration_history contains corrections, weight them heavily — the student knows their skills better than you.
- Level meanings: low = beginner / learning fundamentals; mid = comfortable applying it independently on small projects; high = production / professional / can teach others.
- Return ONLY valid JSON. No prose outside the JSON.`;

  return { system, prompt };
}

/**
 * lib/prompts/insight-explanation.ts — Section 9.4 (Claude #4)
 *
 * Explains why a Saudi student is well-matched to their top role, and describes
 * the growth trajectory for that role in the Saudi market. Bilingual output.
 */

import { z } from 'zod';
import type { DimVector } from '../role-match';

export const InsightExplanationSchema = z.object({
  why_this_role_en: z.string().min(1),
  why_this_role_ar: z.string().min(1),
  growth_trajectory_en: z.string().min(1),
  growth_trajectory_ar: z.string().min(1),
});

export type InsightExplanation = z.infer<typeof InsightExplanationSchema>;

export interface InsightExplanationPromptInput {
  studentProfile: {
    cluster: string;
    specialty: string;
    year_of_study: string;
    gpa_value: number;
    gpa_scale: string;
  };
  studentDims: DimVector;
  topRoleName: string;
  topRoleScore: number;
  strengths: string[];
}

export function buildInsightExplanationPrompt(input: InsightExplanationPromptInput): {
  system: string;
  userMessage: string;
} {
  const { studentProfile, studentDims, topRoleName, topRoleScore, strengths } = input;

  const dimSummary = `academic ${studentDims.dim_academic.toFixed(0)}, credentialing ${studentDims.dim_credentialing.toFixed(
    0,
  )}, practical ${studentDims.dim_practical.toFixed(0)}, portfolio ${studentDims.dim_portfolio.toFixed(
    0,
  )}, domain ${studentDims.dim_domain.toFixed(0)}, prof_dev ${studentDims.dim_prof_dev.toFixed(
    0,
  )}, soft_skills ${studentDims.dim_soft_skills.toFixed(0)}`;

  const system = `You are a bilingual (English and Arabic) career analyst for the Saudi job market. You explain career-fit decisions clearly and reference Vision 2030 themes where genuinely relevant. You always return ONLY valid JSON — no markdown fences, no prose outside the JSON object.`;

  const userMessage = `A Saudi student's strongest career match has been computed. Explain it.

## Student Profile
- Cluster: ${studentProfile.cluster}
- Specialty: ${studentProfile.specialty}
- Year of study: ${studentProfile.year_of_study}
- GPA: ${studentProfile.gpa_value} / ${studentProfile.gpa_scale}
- 7-dimension readiness vector: ${dimSummary}

## Top-Match Role
- Role: ${topRoleName}
- Match score: ${Math.round(topRoleScore)}%
- Strongest contributing dimensions: ${strengths.join(', ') || 'n/a'}

## Task
1. In 2–3 sentences, explain why this student is well-matched to this role, citing SPECIFIC strengths from their profile above.
2. In 2–3 sentences, describe the growth trajectory for this role in the Saudi market. Reference Vision 2030 themes where genuinely relevant.

## Output Format
Return ONLY this JSON object — no markdown, no prose:
{
  "why_this_role_en": "...",
  "why_this_role_ar": "...",
  "growth_trajectory_en": "...",
  "growth_trajectory_ar": "..."
}`;

  return { system, userMessage };
}

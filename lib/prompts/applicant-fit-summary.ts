/**
 * lib/prompts/applicant-fit-summary.ts — Section 9.9 (Claude #9)
 *
 * The corporate-side AI moment: a 2–3 sentence honest fit assessment for a
 * recruiter triaging an applicant. Goes beyond the deterministic strengths/gaps
 * (already on screen) to add risk flags + a hiring recommendation.
 */

import { z } from 'zod';
import type { DimVector } from '../role-match';
import type { DimDelta } from '../job-helpers';

export const ApplicantFitSummarySchema = z.object({
  summary_en: z.string().min(1),
  summary_ar: z.string().min(1),
  risk_flags: z.array(z.string().min(1)).max(3).default([]),
  recommended_action: z.enum(['advance', 'screen_first', 'decline', 'wait_pool']),
});

export type ApplicantFitSummary = z.infer<typeof ApplicantFitSummarySchema>;

export interface FitSummaryStudentProfile {
  cluster: string;
  year_of_study: string;
  gpa_value: number;
  gpa_scale: string;
  target_role: string;
  opportunity_types: string[];
  verified_certs_count: number;
  mock_interview_avg: number | null;
  completed_roadmap_nodes: number;
}

export interface FitSummarySkill {
  skill_canonical_name: string;
  proficiency_level: string;
  validation_status: string;
}

export interface FitSummaryJob {
  title: string;
  role_category: string;
  required_skills: { skill: string; importance: number }[];
  required_certs: string[];
  required_experience_years: number;
  required_education_level: string;
  dimension_requirements: Partial<DimVector>;
}

export interface ApplicantFitSummaryInput {
  studentProfile: FitSummaryStudentProfile;
  studentDims: DimVector;
  studentSkills: FitSummarySkill[];
  job: FitSummaryJob;
  jobReadiness: number;
  topStrengths: DimDelta[];
  topGaps: DimDelta[];
}

const DIM_LABEL: Record<string, string> = {
  dim_academic: 'Academic',
  dim_credentialing: 'Credentialing',
  dim_practical: 'Practical Experience',
  dim_portfolio: 'Portfolio',
  dim_domain: 'Domain Knowledge',
  dim_prof_dev: 'Professional Development',
  dim_soft_skills: 'Soft Skills',
};

export function buildApplicantFitSummaryPrompt(
  input: ApplicantFitSummaryInput,
): { system: string; userMessage: string } {
  const { studentProfile: sp, studentDims, studentSkills, job, jobReadiness, topStrengths, topGaps } = input;

  const dims = (Object.keys(DIM_LABEL) as (keyof DimVector)[])
    .map((k) => `${DIM_LABEL[k]}: ${Math.round(studentDims[k] ?? 0)}`)
    .join(', ');

  const skills = studentSkills.length
    ? studentSkills
        .map((s) => `${s.skill_canonical_name} (${s.proficiency_level}, ${s.validation_status})`)
        .join(', ')
    : '(none listed)';

  const reqSkills = job.required_skills.length
    ? job.required_skills.map((s) => `${s.skill} (importance ${s.importance}/5)`).join(', ')
    : '(none)';

  const strengthStr = topStrengths.length
    ? topStrengths
        .map((d) => `${DIM_LABEL[d.dim]} (${Math.round(d.student)}/${Math.round(d.required)})`)
        .join(', ')
    : '(none)';
  const gapStr = topGaps.length
    ? topGaps
        .map((d) => `${DIM_LABEL[d.dim]} (${Math.round(d.student)}/${Math.round(d.required)})`)
        .join(', ')
    : '(none)';

  const system =
    'You are assisting a Saudi corporate recruiter who is triaging job applicants. ' +
    'You give honest, factual, efficient fit assessments. No hype, no padding. ' +
    'You always return ONLY valid JSON — no markdown code fences, no prose before or after.';

  const userMessage = `A Saudi recruiter is reviewing this applicant for a specific job and needs a quick, honest fit assessment. Do not repeat the strengths and gaps list — they are already visible to the recruiter. Add the layer they can't compute deterministically: risk flags, recommendation, and a hiring suggestion.

## Applicant
- Cluster: ${sp.cluster}
- Year of study: ${sp.year_of_study}
- GPA: ${sp.gpa_value} / ${sp.gpa_scale}
- Target role: ${sp.target_role || '(unspecified)'}
- Seeking: ${sp.opportunity_types.join(', ') || 'any'}
- 7-dimension vector: ${dims}
- Skills (level, validation status): ${skills}
- Verified certificates: ${sp.verified_certs_count}
- Mock interview avg score: ${sp.mock_interview_avg == null ? 'none taken' : sp.mock_interview_avg.toFixed(1) + '/100'}
- Completed roadmap nodes: ${sp.completed_roadmap_nodes}

## Job
- Title: ${job.title}
- Role category: ${job.role_category}
- Required skills: ${reqSkills}
- Required certifications: ${job.required_certs.length ? job.required_certs.join(', ') : '(none)'}
- Required experience: ${job.required_experience_years} years
- Required education level: ${job.required_education_level}

## Deterministic (already shown to the recruiter — do NOT just restate)
- Job Readiness: ${Math.round(jobReadiness)}%
- Top strengths: ${strengthStr}
- Top gaps: ${gapStr}

## Return ONLY this JSON
{
  "summary_en": "2-3 sentences. Plain language. Honest. Mention 1 strength specific to this job, 1 concrete concern (a gap or risk flag the recruiter should probe), and a 1-line hiring recommendation.",
  "summary_ar": "نفس التقييم بالعربية",
  "risk_flags": ["short kebab-case tags, 0-3, e.g. 'limited-production-experience', 'unvalidated-key-skills', 'cert-mismatch'"],
  "recommended_action": "advance" | "screen_first" | "decline" | "wait_pool"
}

Tone: respectful, factual. No hype, no padding. Saudi corporate recruiters value efficiency. Return ONLY the JSON object — no markdown fences, no prose.`;

  return { system, userMessage };
}

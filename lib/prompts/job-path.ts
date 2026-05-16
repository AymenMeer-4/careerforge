/**
 * lib/prompts/job-path.ts — Section 9.6 (Claude #6)
 *
 * Builds the "Close the Gap" prompt: 3–5 specific, actionable steps that would
 * raise a student's JOB Readiness for ONE specific open posting. Distinct from
 * the general roadmap (Claude #2) which targets the student's long-term role.
 */

import { z } from 'zod';
import type { DimVector } from '../role-match';

const DIM_TARGETS = ['academic', 'credentialing', 'practical', 'portfolio', 'domain', 'prof_dev', 'soft_skills'] as const;

// ── Zod schema for one path step ─────────────────────────────────────────────
export const JobPathResourceSchema = z.object({
  title: z.string(),
  url: z.string().optional().default(''),
  provider: z.string(),
  type: z.string().optional().default('course'),
  hours: z.number().optional().default(0),
  language: z.string().optional().default('en'),
  cost: z.string().optional().default('free'),
});

export const JobPathStepSchema = z.object({
  title_en: z.string().min(1),
  title_ar: z.string().min(1),
  description_en: z.string().min(1),
  description_ar: z.string().min(1),
  dimension_target: z.enum(DIM_TARGETS),
  estimated_hours: z.number().int().min(1),
  expected_lift: z.number().int().min(1).max(15),
  resources: z.array(JobPathResourceSchema).min(1).max(2),
});

export const JobPathStepsSchema = z.array(JobPathStepSchema).min(1).max(6);

export type JobPathStep = z.infer<typeof JobPathStepSchema>;

// ── Prompt input ─────────────────────────────────────────────────────────────
export interface JobPathGap {
  /** per-dimension deficits: student is BELOW the job requirement by this many points */
  dimensionDeltas: Record<string, number>;
  missingSkills: string[];
  missingCerts: string[];
}

export interface JobPathPromptInput {
  studentProfile: {
    name?: string;
    cluster: string;
    year_of_study: string;
    gpa_value: number;
    gpa_scale: string;
    target_role: string;
    opportunity_types: string[];
  };
  studentDims: DimVector;
  generalReadiness: number;
  jobReadiness: number;
  job: {
    title: string;
    company_name: string;
    role_category: string;
    required_skills: { skill: string; importance: number }[];
    required_certs: string[];
    required_experience_years: number;
    required_education_level: string;
    dimension_requirements: Partial<DimVector>;
  };
  gap: JobPathGap;
}

export function buildJobPathPrompt(input: JobPathPromptInput): { system: string; userMessage: string } {
  const { studentProfile, studentDims, generalReadiness, jobReadiness, job, gap } = input;

  const dimSummary = `
  - academic:      ${studentDims.dim_academic.toFixed(1)}
  - credentialing: ${studentDims.dim_credentialing.toFixed(1)}
  - practical:     ${studentDims.dim_practical.toFixed(1)}
  - portfolio:     ${studentDims.dim_portfolio.toFixed(1)}
  - domain:        ${studentDims.dim_domain.toFixed(1)}
  - prof_dev:      ${studentDims.dim_prof_dev.toFixed(1)}
  - soft_skills:   ${studentDims.dim_soft_skills.toFixed(1)}`.trim();

  const reqVector = Object.entries(job.dimension_requirements)
    .map(([k, v]) => `${k.replace('dim_', '')}: ${Number(v).toFixed(0)}`)
    .join(', ');

  const skillsList = job.required_skills.length
    ? job.required_skills.map((s) => `${s.skill} (importance ${s.importance}/5)`).join(', ')
    : '(none specified)';

  const dimGapLines = Object.entries(gap.dimensionDeltas)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([dim, v]) => `  - ${dim.replace('dim_', '')}: ${v.toFixed(1)} points below this job's requirement`)
    .join('\n');

  const system = `You are a bilingual (English and Arabic) career advisor for Saudi university students. You help students close the gap between their current profile and a SPECIFIC job posting in front of them. Every step you suggest must address a real, named gap from the input — never generic advice. You always return ONLY a valid JSON array — no markdown fences, no prose.`;

  const userMessage = `A Saudi student is viewing a specific job posting and wants to know how to raise their readiness for it. Their general readiness across the cluster is ${Math.round(generalReadiness)}%. Their readiness for this specific job is ${Math.round(jobReadiness)}%.

## Student Profile
- Cluster: ${studentProfile.cluster}
- Year of study: ${studentProfile.year_of_study}
- GPA: ${studentProfile.gpa_value} / ${studentProfile.gpa_scale}
- Target role: ${studentProfile.target_role}
- Seeking: ${studentProfile.opportunity_types.join(', ') || 'any'}

## Student's Current 7-Dimension Vector (0–100 each)
${dimSummary}

## The Job
- Title: ${job.title} at ${job.company_name}
- Role category: ${job.role_category}
- Required dimension vector: ${reqVector}
- Required skills (with importance 1–5): ${skillsList}
- Required certifications: ${job.required_certs.length ? job.required_certs.join(', ') : '(none)'}
- Required experience: ${job.required_experience_years} years
- Required education level: ${job.required_education_level}

## Computed Gap (where the student falls short of THIS job specifically)
Dimension deficits:
${dimGapLines || '  (no dimension deficits)'}
Missing skills: ${gap.missingSkills.length ? gap.missingSkills.join(', ') : '(none)'}
Missing certifications: ${gap.missingCerts.length ? gap.missingCerts.join(', ') : '(none)'}

## Task
Generate 3–5 SPECIFIC, ACTIONABLE steps that would close the gap for THIS job. Every step MUST address a real, named gap from the input above (a named missing skill, a named missing cert, or a specific dimension deficit) — never generic advice. Prioritize steps that close the BIGGEST gaps first.

For each step return a JSON object with these exact keys:
- title_en: string — concise step title in English
- title_ar: string — same title in Arabic
- description_en: string — 1–2 sentences in English: what the student does and which named gap it closes
- description_ar: string — same description in Arabic
- dimension_target: one of "academic" | "credentialing" | "practical" | "portfolio" | "domain" | "prof_dev" | "soft_skills"
- estimated_hours: integer — realistic hours to complete
- expected_lift: integer 1–15 — your honest estimate of how many points this step adds to JOB readiness for this specific post
- resources: array of 1–2 objects, each { title, provider, type, hours, language, cost }

## Resource Guidelines
ONLY use these four providers: "Amazon", "edX", "Coursera", "Udemy". Never name or link any other source. Do NOT output a "url" — you cannot know a real working URL. Instead, the "title" must be the exact search phrase the student should type into that provider's search box (e.g. provider "Coursera", title "machine learning specialization"). The "provider" field must be exactly one of: Amazon, edX, Coursera, Udemy.

## Output Format
Return ONLY a valid JSON array of step objects. No markdown code blocks, no prose before or after. Start with [ and end with ].`;

  return { system, userMessage };
}

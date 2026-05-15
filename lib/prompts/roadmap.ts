/**
 * lib/prompts/roadmap.ts — Section 9.1 (Claude #2)
 *
 * Builds the prompt for roadmap generation.
 * Input: student profile + 7-dim scores + target role + gap vector.
 * Output: a { system, userMessage } object ready for callClaude().
 */

import type { DimVector } from '../role-match';

export interface RoadmapPromptInput {
  // Student profile
  name: string;
  cluster: string;
  specialty: string;
  year_of_study: string;
  gpa_value: number;
  gpa_scale: string;
  university: string;
  opportunity_types: string[];
  hours_per_week: number;
  target_role: string;

  // 7-dim current scores
  dims: DimVector;

  // Target role name (display)
  targetRoleName: string;

  // Gap vector: positive = student BELOW requirement, negative = exceeds
  gapVector: Record<string, number>;
}

export function buildRoadmapPrompt(input: RoadmapPromptInput): {
  system: string;
  userMessage: string;
} {
  const {
    name,
    cluster,
    specialty,
    year_of_study,
    gpa_value,
    gpa_scale,
    university,
    opportunity_types,
    hours_per_week,
    target_role,
    dims,
    targetRoleName,
    gapVector,
  } = input;

  const gapSummary = Object.entries(gapVector)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([dim, gap]) => `  ${dim.replace('dim_', '')}: −${gap.toFixed(1)} points below requirement`)
    .join('\n');

  const dimSummary = `
  - academic:      ${dims.dim_academic.toFixed(1)}
  - credentialing: ${dims.dim_credentialing.toFixed(1)}
  - practical:     ${dims.dim_practical.toFixed(1)}
  - portfolio:     ${dims.dim_portfolio.toFixed(1)}
  - domain:        ${dims.dim_domain.toFixed(1)}
  - prof_dev:      ${dims.dim_prof_dev.toFixed(1)}
  - soft_skills:   ${dims.dim_soft_skills.toFixed(1)}`.trim();

  const system = `You are a bilingual (English and Arabic) career advisor for Saudi university students. You generate highly personalised career roadmaps grounded in the Saudi job market and Vision 2030. You always return ONLY valid JSON — no markdown fences, no prose outside the JSON array.`;

  const userMessage = `You are generating a personalized career roadmap for a Saudi student.

## Student Profile
- Name: ${name}
- Cluster: ${cluster}
- Specialty: ${specialty}
- Year of study: ${year_of_study}
- GPA: ${gpa_value} / ${gpa_scale}
- University: ${university}
- Seeking: ${opportunity_types.join(', ')}
- Available hours per week: ${hours_per_week}
- Target role: ${target_role} (${targetRoleName})

## Current Readiness Dimensions (0–100 each)
${dimSummary}

## Gap Vector (where the student falls short of the role's average requirements)
${gapSummary || '  (No significant gaps — student exceeds or meets all dimensions)'}

## Task
Generate exactly 10–12 roadmap nodes, each addressing one of the top gaps identified above. Prioritise nodes that close the BIGGEST gaps. Assign lower tier numbers to more urgent, high-impact nodes.

For each node return a JSON object with these exact keys:
- title_en: string — concise title in English (max 8 words)
- title_ar: string — same title in Arabic
- description_en: string — 1–2 sentences in English explaining what the student will do and why it matters
- description_ar: string — same description in Arabic
- dimension_target: one of: "academic" | "credentialing" | "practical" | "portfolio" | "domain" | "prof_dev" | "soft_skills"
- difficulty: integer 1–5 (1 = easy, 5 = very hard)
- hours: integer — realistic estimated hours to complete
- tier: integer 1–5 (1 = most urgent / highest Saudi market relevance, 5 = lowest priority)
- resources: array of exactly 3 objects, each with: { title, url, provider, type, hours, language, cost }
- why_this_tier_en: string — one sentence explaining why this tier was assigned in English
- why_this_tier_ar: string — same explanation in Arabic

## Resource Guidelines
CRITICAL: You MUST only use resource links from these four platforms:
- Coursera: https://www.coursera.org/
- edX: https://www.edx.org/
- Udemy: https://www.udemy.com/
- Amazon (AWS Training): https://aws.amazon.com/training/

Do NOT use any other domains. Do NOT use Tuwaiq, Misk, MIT OCW, freeCodeCamp, or any other URL.
Every resource URL must start with one of these four base URLs exactly.
If you cannot find a real course on these platforms for a node, pick the closest available course from one of the four platforms.

## Output Format
Return ONLY a valid JSON array of node objects. Do NOT wrap in markdown code blocks. Do NOT add any prose before or after the array. Example shape:
[
  {
    "title_en": "...",
    "title_ar": "...",
    "description_en": "...",
    "description_ar": "...",
    "dimension_target": "domain",
    "difficulty": 3,
    "hours": 20,
    "tier": 1,
    "resources": [
      { "title": "...", "url": "https://...", "provider": "Coursera", "type": "course", "hours": 10, "language": "en", "cost": "free" }
    ],
    "why_this_tier_en": "...",
    "why_this_tier_ar": "..."
  }
]`;

  return { system, userMessage };
}

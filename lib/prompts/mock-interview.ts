/**
 * lib/prompts/mock-interview.ts — Section 9.3 (Claude #3)
 *
 * Scores a candidate's mock-interview response on five 0–20 rubric dimensions
 * and returns feedback + 3 improvement areas.
 */

import { z } from 'zod';

const Score = z.number().min(0).max(20);

export const MockInterviewSchema = z.object({
  clarity: Score,
  specificity: Score,
  relevance: Score,
  depth: Score,
  structure: Score,
  total: z.number().min(0).max(100),
  feedback: z.string().min(1),
  improvement_areas: z
    .array(z.object({ area: z.string().min(1), suggestion: z.string().min(1) }))
    .min(1)
    .max(5),
});

export type MockInterviewResult = z.infer<typeof MockInterviewSchema>;

export interface MockInterviewPromptInput {
  scenario: string;
  response: string;
}

export function buildMockInterviewPrompt(input: MockInterviewPromptInput): {
  system: string;
  userMessage: string;
} {
  const system = `You are an experienced interview coach for Saudi university students. You score interview responses honestly and specifically. You always return ONLY valid JSON — no markdown fences, no prose outside the JSON object.`;

  const userMessage = `You are scoring a candidate's response to a mock interview question.

## Scenario
${input.scenario}

## Candidate's Response
${input.response}

## Task
Score the response on five dimensions, each an integer 0–20:
- clarity: well-structured, easy to follow
- specificity: concrete examples vs vague generalities
- relevance: actually answers what was asked
- depth: thoughtful vs surface-level
- structure: STAR or other logical organization

Then compute total = clarity + specificity + relevance + depth + structure (0–100).
Write a 2–4 sentence feedback paragraph. Be honest and specific.
Provide exactly 3 improvement areas, each with a short "area" label and a concrete "suggestion".

## Output Format
Return ONLY this JSON object — no markdown, no prose:
{
  "clarity": 0,
  "specificity": 0,
  "relevance": 0,
  "depth": 0,
  "structure": 0,
  "total": 0,
  "feedback": "...",
  "improvement_areas": [
    { "area": "...", "suggestion": "..." },
    { "area": "...", "suggestion": "..." },
    { "area": "...", "suggestion": "..." }
  ]
}`;

  return { system, userMessage };
}

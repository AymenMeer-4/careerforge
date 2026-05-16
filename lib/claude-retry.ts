/**
 * lib/claude-retry.ts
 *
 * Generic "call Claude, parse JSON, validate with Zod, retry once" helper.
 * Used by every structured-JSON Claude integration in Phase 8 (job-path,
 * mock-interview, insight-explanation). On a second failure it returns a real
 * error — no fake fallback, per the project-wide "no fakes" rule.
 */

import type { z } from 'zod';
import { callClaude } from './claude';
import { parseClaudeJson } from './claude-json';

export type ValidatedResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function callClaudeValidated<T>(
  system: string,
  userMessage: string,
  schema: z.ZodType<T>,
  options?: { temperature?: number; max_tokens?: number },
): Promise<ValidatedResult<T>> {
  const first = await callClaude(system, [{ role: 'user', content: userMessage }], options);
  if (!first.ok) return { ok: false, error: `Claude API error: ${first.error}` };

  try {
    return { ok: true, data: schema.parse(parseClaudeJson(first.text)) };
  } catch {
    // Retry once with an explicit malformed-JSON correction message.
    const retry = await callClaude(
      system,
      [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: first.text },
        {
          role: 'user',
          content:
            'The previous response was malformed or did not match the required schema. Return ONLY valid JSON matching the exact schema described above — no markdown code fences, no prose before or after.',
        },
      ],
      options,
    );
    if (!retry.ok) return { ok: false, error: `Claude API error on retry: ${retry.error}` };

    try {
      return { ok: true, data: schema.parse(parseClaudeJson(retry.text)) };
    } catch (e: any) {
      console.error('callClaudeValidated: Claude returned invalid data twice', {
        first: first.text.slice(0, 400),
        retry: retry.text.slice(0, 400),
        error: String(e),
      });
      return { ok: false, error: 'Claude returned invalid data twice. Please try again in a moment.' };
    }
  }
}

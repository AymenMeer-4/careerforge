/**
 * Strips markdown code fences Claude sometimes adds despite instructions,
 * then parses the text as JSON. Throws on malformed input.
 */
export function parseClaudeJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  return JSON.parse(cleaned);
}

import { z } from 'zod';

export const TranscriptCourseSchema = z.object({
  course_name: z.string(),
  course_code: z.string().nullable().optional(),
  credits: z.number().nullable().optional(),
  grade: z.string().nullable().optional(),
  semester: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1)
});

export const TranscriptResponseSchema = z.object({
  courses: z.array(TranscriptCourseSchema)
});

export type TranscriptResponse = z.infer<typeof TranscriptResponseSchema>;

export function buildTranscriptPrompt(): { system: string; prompt: string } {
  return {
    system: "You are extracting course data from a Saudi university transcript image. Return ONLY valid JSON, no prose.",
    prompt: `Schema:
{
  "courses": [
    {
      "course_name": "string",
      "course_code": "string",
      "credits": 3,
      "grade": "string",
      "semester": "string",
      "confidence": 0.95
    }
  ]
}

Handle Arabic-English mixed transcripts. Return original language for course names. If extraction is uncertain for any field, set confidence < 0.7 and return your best guess.`
  };
}

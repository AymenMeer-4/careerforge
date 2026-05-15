import { z } from 'zod';

export const CertInspectionResponseSchema = z.object({
  verified: z.boolean(),
  confidence: z.number().min(0).max(1),
  extracted_title: z.string(),
  extracted_issuer: z.string(),
  extracted_date: z.string().nullable().optional(),
  image_type: z.enum(['certificate', 'training_completion', 'internship_letter', 'other', 'unclear']),
  match_title: z.boolean(),
  match_issuer: z.boolean(),
  notes: z.string()
});

export type CertInspectionResponse = z.infer<typeof CertInspectionResponseSchema>;

export function buildCertInspectionPrompt({
  claimedType,
  claimedTitle,
  claimedIssuer,
  claimedDate
}: {
  claimedType: string;
  claimedTitle: string;
  claimedIssuer: string;
  claimedDate?: string;
}): { system: string; prompt: string } {
  return {
    system: "You are inspecting a credential image to verify it matches what the student claims. Return ONLY valid JSON, no prose.",
    prompt: `The student typed:
- Type: ${claimedType}
- Title: ${claimedTitle}
- Issuer: ${claimedIssuer}
- Date: ${claimedDate || 'N/A'}

Look at the attached image and return ONLY this JSON:
{
  "verified": true | false,
  "confidence": 0.95,
  "extracted_title": "what you read on the image",
  "extracted_issuer": "what you read on the image",
  "extracted_date": "YYYY-MM-DD",
  "image_type": "certificate" | "training_completion" | "internship_letter" | "other" | "unclear",
  "match_title": true | false,
  "match_issuer": true | false,
  "notes": "one short sentence: what you saw and any concerns"
}

Rules:
- verified=true ONLY if you can clearly read a real credential matching the claimed title AND issuer with high confidence (>=0.85). Otherwise verified=false.
- Treat screenshots of badges, LinkedIn profile crops, certificates of attendance, and decorative templates as low confidence (< 0.6) unless they bear clear credential markings.
- Arabic-language certs are valid — read both Arabic and English text.
- If the image is blurry, cropped, or clearly not a credential, set image_type='unclear' and confidence < 0.4.
- Be honest. False positives are worse than false negatives — when in doubt, lower the confidence.`
  };
}

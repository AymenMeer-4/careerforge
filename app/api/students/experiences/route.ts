import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { computeStudentDimensions } from '@/lib/readiness';
import { callClaudeVision } from '@/lib/claude';
import { buildCertInspectionPrompt, CertInspectionResponseSchema } from '@/lib/prompts/cert-inspection';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const type = formData.get('type') as string;
    const title = formData.get('title') as string;
    const issuer = formData.get('issuer') as string || null;
    const date_completed = formData.get('date_completed') as string || null;
    const file = formData.get('cert_image') as File | null;

    if (!type || !title) {
      return NextResponse.json({ error: 'Missing type or title' }, { status: 400 });
    }

    let verification_status = 'unverified';
    let verification_method = null;
    let verification_confidence = null;
    let verification_notes = null;

    if (file) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        return NextResponse.json({ error: 'Image must be a JPG or PNG file.' }, { status: 400 });
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image must be 5MB or smaller.' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');
      
      const { system, prompt } = buildCertInspectionPrompt({
        claimedType: type,
        claimedTitle: title,
        claimedIssuer: issuer || '',
        claimedDate: date_completed || ''
      });

      let attempt = 0;
      let parsedResult = null;

      while (attempt < 2 && !parsedResult) {
        attempt++;
        const claudeResponse = await callClaudeVision(system, prompt, base64Data);
        if (claudeResponse.ok) {
          try {
            const jsonMatch = claudeResponse.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found");
            const rawJson = JSON.parse(jsonMatch[0]);
            parsedResult = CertInspectionResponseSchema.parse(rawJson);
          } catch (e) {
            console.error(`Attempt ${attempt} failed to parse JSON from Claude`);
          }
        }
      }

      if (parsedResult) {
        verification_confidence = parsedResult.confidence;
        verification_notes = parsedResult.notes;

        if (parsedResult.confidence >= 0.85 && parsedResult.match_title && parsedResult.match_issuer) {
          verification_status = 'verified';
          verification_method = 'ai_inspection';
        } else if (parsedResult.confidence < 0.6 || (!parsedResult.match_title && !parsedResult.match_issuer)) {
          verification_status = 'rejected';
        } else {
          verification_status = 'pending';
        }
      } else {
        verification_status = 'unverified';
        verification_notes = 'Automatic verification failed — please re-upload or contact support';
      }
    }

    const [newExperience] = await sql`
      INSERT INTO student_experiences (
        student_id, type, title, issuer, date_completed, 
        verification_status, verification_method, verification_confidence, verification_notes
      ) VALUES (
        ${session.userId}, ${type}, ${title}, ${issuer}, ${date_completed || null},
        ${verification_status}, ${verification_method}, ${verification_confidence}, ${verification_notes}
      )
      RETURNING *
    `;

    // Recompute scores
    await computeStudentDimensions(session.userId);

    return NextResponse.json({ success: true, experience: newExperience });
  } catch (error: any) {
    console.error('Error adding experience:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

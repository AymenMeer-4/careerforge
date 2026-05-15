import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { callClaudeVision } from '@/lib/claude';
import { buildTranscriptPrompt, TranscriptResponseSchema } from '@/lib/prompts/transcript';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('transcript_image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    
    const { system, prompt } = buildTranscriptPrompt();

    let attempt = 0;
    let parsedResult = null;

    while (attempt < 2 && !parsedResult) {
      attempt++;
      const claudeResponse = await callClaudeVision(system, prompt, base64Data, { max_tokens: 8000 });
      if (claudeResponse.ok) {
        try {
          const jsonMatch = claudeResponse.text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("No JSON found");
          const rawJson = JSON.parse(jsonMatch[0]);
          parsedResult = TranscriptResponseSchema.parse(rawJson);
        } catch (e) {
          console.error(`Attempt ${attempt} failed to parse transcript JSON from Claude`, e);
        }
      }
    }

    if (parsedResult) {
      return NextResponse.json({ success: true, courses: parsedResult.courses });
    } else {
      return NextResponse.json({ error: 'Failed to parse transcript automatically' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error parsing transcript:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

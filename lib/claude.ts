import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export type ClaudeResponse = 
  | { ok: true; text: string }
  | { ok: false; error: string };

const MODEL = 'claude-sonnet-4-5-20250929'; // Use a known working model for now. User can update if needed.

export async function callClaude(
  system: string,
  messages: Anthropic.MessageParam[],
  options?: { temperature?: number; max_tokens?: number }
): Promise<ClaudeResponse> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: options?.max_tokens || 4000,
      temperature: options?.temperature || 0,
      system: system,
      messages: messages,
    });

    return { 
      ok: true, 
      text: response.content[0].type === 'text' ? response.content[0].text : '' 
    };
  } catch (error: any) {
    console.error('Claude API Error:', error);
    return { ok: false, error: error.message || 'Unknown error' };
  }
}

export async function callClaudeVision(
  system: string,
  prompt: string,
  imageBase64: string,
  options?: { temperature?: number; max_tokens?: number }
): Promise<ClaudeResponse> {
  try {
    // Basic media type detection
    let mediaType = 'image/jpeg';
    if (imageBase64.startsWith('iVBORw0KGgo')) {
      mediaType = 'image/png';
    } else if (imageBase64.startsWith('/9j/')) {
      mediaType = 'image/jpeg';
    } else if (imageBase64.startsWith('UklGR')) {
      mediaType = 'image/webp';
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: options?.max_tokens || 4000,
      temperature: options?.temperature || 0,
      system: system,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    return { 
      ok: true, 
      text: response.content[0].type === 'text' ? response.content[0].text : '' 
    };
  } catch (error: any) {
    console.error('Claude Vision API Error:', error);
    return { ok: false, error: error.message || 'Unknown error' };
  }
}

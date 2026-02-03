import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Force dynamic rendering - prevents build-time execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Initialize OpenAI only when the route is called, not at build time
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const { image, checklistItem, language, mode, specs } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    // Handle image data - could be full data URL or just base64
    let imageUrl: string;
    if (image.startsWith('data:image/')) {
      imageUrl = image;
    } else {
      imageUrl = `data:image/jpeg;base64,${image}`;
    }

    const languageInstruction = language === 'ar'
      ? 'IMPORTANT: Respond entirely in Arabic. All reasoning, guidance, and explanations must be in Arabic only.'
      : 'IMPORTANT: Respond entirely in English.';

    let prompt: string;

    // Multi-spec mode: AI identifies which spec is visible in the image
    if (mode === 'multi-spec' && specs && specs.length > 0) {
      const specsListText = specs.map((s: any, i: number) =>
        `${i + 1}. ID: ${s.id}\n   Code: ${s.code}\n   Requirement: ${s.description}\n   Category: ${s.category || 'General'}`
      ).join('\n\n');

      prompt = `${languageInstruction}

You are SAQR, an AI inspection assistant analyzing facilities for regulatory compliance in GCC countries.

Your task: Look at the image and determine which checklist item (if any) is being shown. Then evaluate if that requirement is met.

Available Checklist Items to Match:
${specsListText}

Instructions:
1. Examine the image carefully
2. Determine which checklist item from the list above is most relevant to what's shown
3. If a matching item is found, evaluate if the requirement is PASS or FAIL
4. If nothing in the image matches any of the checklist items, return null for matchedSpecId

IMPORTANT: Respond with ONLY valid JSON, no markdown, no backticks, no explanation. Just the JSON object:
{
  "matchedSpecId": "the ID of the matching spec, or null if no match",
  "status": "pass" or "fail" (only if matchedSpecId is not null),
  "reasoning": "Brief explanation (2-3 sentences) of what you see and why it matches/passes/fails in ${language === 'ar' ? 'Arabic' : 'English'}",
  "confidence": 0.0 to 1.0 (how confident you are in the match AND the pass/fail determination)
}`;
    } else {
      // Single spec mode (original behavior)
      if (!checklistItem) {
        return NextResponse.json({ error: 'Missing checklist item' }, { status: 400 });
      }

      prompt = `${languageInstruction}

You are SAQR, an AI inspection assistant analyzing facilities for regulatory compliance in GCC countries.

Checklist Item to Verify:
Code: ${checklistItem.code || 'N/A'}
Requirement: ${checklistItem.description || checklistItem}
Category: ${checklistItem.category || 'General'}

Analyze the image and determine if this requirement is MET or NOT MET.

IMPORTANT: Respond with ONLY valid JSON, no markdown, no backticks, no explanation. Just the JSON object:
{
  "status": "pass" or "fail",
  "reasoning": "Brief explanation (2-3 sentences) in ${language === 'ar' ? 'Arabic' : 'English'}",
  "confidence": 0.0 to 1.0,
  "needsBetterView": true or false,
  "guidance": "If needsBetterView is true, provide specific guidance in ${language === 'ar' ? 'Arabic' : 'English'}"
}`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high'
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    let content = response.choices[0].message.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Clean up the response - remove markdown code blocks if present
    content = content.trim();
    content = content.replace(/```json\n?/g, '');
    content = content.replace(/```\n?/g, '');
    content = content.trim();

    const result = JSON.parse(content);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('AI Analysis Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Analysis failed'
    }, { status: 500 });
  }
}
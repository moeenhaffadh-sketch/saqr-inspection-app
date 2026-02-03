import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Force dynamic rendering - prevents build-time execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { image, checklistItem, language, mode, specs } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
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
      // Single spec mode - STRICT evidence validation
      if (!checklistItem) {
        return NextResponse.json({ error: 'Missing checklist item' }, { status: 400 });
      }

      prompt = `You are SAQR, a regulatory inspection AI.

SPEC TO VERIFY: ${checklistItem.code || ''} - ${checklistItem.description || checklistItem}

RULES:
1. ONLY return PASS if the image CLEARLY shows evidence of compliance
2. ONLY return FAIL if the image CLEARLY shows non-compliance
3. Return UNCERTAIN if:
   - The image is blurry or unclear
   - The relevant item is not visible in the image
   - You cannot confidently determine compliance
   - The image shows something unrelated to this spec
4. Confidence must be honest - don't inflate it
5. Your finding must describe EXACTLY what you see, not what you assume

Return JSON only (no markdown):
{
  "status": "pass" or "fail" or "uncertain",
  "confidence": 0.0 to 1.0,
  "reasoning": "Describe exactly what is visible in the image",
  "reasoningAr": "Arabic translation of finding",
  "isRelevantEvidence": true or false,
  "evidenceDescription": "What in the image serves as evidence",
  "recommendation": "What to do if FAIL or UNCERTAIN",
  "recommendationAr": "Arabic translation of recommendation"
}`;
    }

    // Strip the data:image prefix for Gemini
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // Try Gemini first
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        console.log('[API] Using Gemini 2.5 Pro');

        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        const imagePart = {
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg",
          },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = result.response;
        const text = response.text();

        console.log('[API] Gemini response received');

        // Clean markdown wrapping
        const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(clean);

        return NextResponse.json(parsed);
      } catch (geminiError: any) {
        console.error('[API] Gemini failed, trying OpenAI fallback:', geminiError.message);
      }
    }

    // OpenAI fallback
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'No AI API key configured' },
        { status: 500 }
      );
    }

    console.log('[API] Using OpenAI GPT-4o (fallback)');

    const openai = new OpenAI({ apiKey: openaiKey });

    // Handle image data for OpenAI
    let imageUrl: string;
    if (image.startsWith('data:image/')) {
      imageUrl = image;
    } else {
      imageUrl = `data:image/jpeg;base64,${image}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const openaiResponse = await openai.chat.completions.create({
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
      max_tokens: 1000,
      temperature: 0.2,
    }, { signal: controller.signal });

    clearTimeout(timeoutId);

    let content = openaiResponse.choices[0].message.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    console.log('[API] OpenAI response received');

    content = content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const result = JSON.parse(content);
      return NextResponse.json(result);
    } catch (parseError) {
      console.error('AI Response Parse Error:', parseError);
      return NextResponse.json({
        status: 'uncertain',
        reasoning: 'AI response could not be parsed. Please try again.',
        confidence: 0,
        error: 'parse_error'
      });
    }
  } catch (error: any) {
    console.error('AI Analysis Error:', error);

    if (error.name === 'AbortError') {
      return NextResponse.json({
        error: 'Analysis timed out',
        status: 'uncertain',
        reasoning: 'Analysis took too long. Try with clearer image.',
        reasoningAr: 'استغرق التحليل وقتًا طويلاً. حاول بصورة أوضح.',
        confidence: 0
      }, { status: 408 });
    }

    return NextResponse.json({
      error: error.message || 'Analysis failed',
      status: 'uncertain',
      reasoning: 'Analysis failed. Please try again.',
      reasoningAr: 'فشل التحليل. حاول مرة أخرى.',
      confidence: 0
    }, { status: 500 });
  }
}

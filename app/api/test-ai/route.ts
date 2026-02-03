import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('[TEST-AI] Testing OpenAI connection...');
  console.log('[TEST-AI] API Key exists:', !!process.env.OPENAI_API_KEY);
  console.log('[TEST-AI] API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 15) + '...');

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log('[TEST-AI] Calling OpenAI...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello in English and Arabic' }],
      max_tokens: 50,
    });

    const reply = response.choices[0].message.content;
    console.log('[TEST-AI] Success! Reply:', reply);

    return NextResponse.json({
      ok: true,
      reply,
      model: 'gpt-4o',
      apiKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) + '...',
    });
  } catch (err: any) {
    console.error('[TEST-AI] Error:', err.message);
    console.error('[TEST-AI] Full error:', err);

    return NextResponse.json({
      ok: false,
      error: err.message,
      type: err.type || err.name,
      status: err.status,
    }, { status: 500 });
  }
}

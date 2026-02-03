import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Fallback to OpenAI if Anthropic not configured
      return NextResponse.json(
        { error: "AI API key not configured" },
        { status: 500 }
      );
    }

    const { image, checklistItem, language } = await request.json();

    if (!image || !checklistItem) {
      return NextResponse.json(
        { error: "Missing image or checklist item" },
        { status: 400 }
      );
    }

    const languageInstruction =
      language === "ar"
        ? "IMPORTANT: Respond entirely in Arabic. All reasoning, guidance, and explanations must be in Arabic only."
        : "IMPORTANT: Respond entirely in English.";

    const prompt = `${languageInstruction}

You are an AI inspection assistant analyzing facilities for regulatory compliance in Bahrain and GCC countries.

Checklist Item to Verify:
Code: ${checklistItem.code}
Requirement: ${checklistItem.description}
Category: ${checklistItem.category}
Authority: ${checklistItem.authority || "MOH Bahrain"}

Analyze the image and determine if this requirement is MET or NOT MET.

Respond with ONLY valid JSON, no markdown, no backticks:
{
  "status": "pass" or "fail",
  "reasoning": "Brief explanation (2-3 sentences) in ${language === "ar" ? "Arabic" : "English"}",
  "confidence": 0.0 to 1.0,
  "needsBetterView": true or false,
  "guidance": "If needsBetterView is true, provide specific guidance in ${language === "ar" ? "Arabic" : "English"}"
}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: image,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type" }, { status: 500 });
    }

    let text = content.text.trim();
    text = text.replace(/```json\n?/g, "");
    text = text.replace(/```\n?/g, "");
    text = text.trim();

    const result = JSON.parse(text);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("AI Analysis Error:", error);
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

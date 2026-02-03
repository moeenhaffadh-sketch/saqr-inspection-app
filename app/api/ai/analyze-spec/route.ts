import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

interface SpecInput {
  code: string;
  text: string;
  textAr?: string;
}

interface SpecResult {
  specCode: string;
  specText: string;
  found: boolean;
  result: "PASS" | "FAIL" | "NEEDS_REVIEW";
  confidence: number;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "OK";
  finding: string;
  findingAr: string;
  instancesVisible?: number;
  recommendation?: string;
  recommendationAr?: string;
  imageQuality: "clear" | "slightly_blurry" | "very_blurry" | "too_dark" | "too_bright" | "obstructed";
  evidenceValid: boolean;
}

interface AnalysisResponse {
  results: SpecResult[];
}

const emptyResult: AnalysisResponse = { results: [] };

export async function POST(request: NextRequest) {
  console.log("[AnalyzeSpec API] Request received");

  try {
    const body = await request.json();
    const { image, specs } = body as {
      image: string;
      specs: SpecInput[];
    };

    if (!image || !specs || specs.length === 0) {
      return NextResponse.json(emptyResult);
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error("[AnalyzeSpec API] No GEMINI_API_KEY");
      return NextResponse.json(emptyResult);
    }

    // Single spec mode - more focused analysis
    const isSingleSpec = specs.length === 1;
    const spec = specs[0];
    const today = new Date().toISOString().split("T")[0];

    let prompt: string;

    if (isSingleSpec) {
      // Focused single-spec prompt
      prompt = `You are SAQR regulatory inspector. Analyze this image for ONE specific spec.

SPEC: [${spec.code}] ${spec.text}

Provide detailed analysis. Be STRICT - this is regulatory compliance.

RULES:
- Describe exactly what you see that relates to this spec
- If the spec subject is visible, analyze it thoroughly
- Count instances if multiple visible (e.g., 3 windows, 2 fire extinguishers)
- Rate image quality honestly
- Give specific finding, not generic
- If image doesn't show the spec subject clearly, say so

SEVERITY LEVELS:
- CRITICAL: Immediate safety/health risk
- MAJOR: Significant non-compliance
- MINOR: Small issues
- OK: Fully compliant

DATE CHECK: Today is ${today}. Check any visible expiry dates.

TEMPERATURE STANDARDS:
- Cold storage: <5C
- Frozen: <-18C
- Hot holding: >63C

Return JSON only (no markdown):
{
  "results": [{
    "specCode": "${spec.code}",
    "specText": "${spec.text.substring(0, 50)}...",
    "found": true,
    "result": "PASS" | "FAIL" | "NEEDS_REVIEW",
    "confidence": 60 to 100,
    "severity": "OK" | "MINOR" | "MAJOR" | "CRITICAL",
    "finding": "Detailed finding in English - describe EXACTLY what you see",
    "findingAr": "Arabic translation of finding",
    "instancesVisible": 1,
    "recommendation": "What to fix if FAIL, null if PASS",
    "recommendationAr": "Arabic recommendation",
    "imageQuality": "clear" | "slightly_blurry" | "very_blurry" | "too_dark" | "too_bright" | "obstructed",
    "evidenceValid": true
  }]
}

IMPORTANT:
- found: true only if you can see the subject clearly
- evidenceValid: true only if this would hold up as regulatory evidence
- confidence: reflects how CLEAR the evidence is
- Be specific about what you observe, not generic`;
    } else {
      // Multi-spec prompt (batch mode)
      const specsText = specs.map((s) => `${s.code}: ${s.text}`).join("\n");

      prompt = `You are SAQR, an expert AI regulatory inspector. Analyze this image for compliance with the following specifications.

SPECS TO CHECK:
${specsText}

ANALYSIS RULES:

1. MULTI-INSTANCE:
   - Count ALL instances visible
   - A spec PASSES only if ALL visible instances comply
   - Example: 3/4 fire extinguishers valid = FAIL

2. DATES:
   - Today is ${today}
   - Check if anything is expired

3. TEMPERATURES:
   - Cold storage <5C, Frozen <-18C, Hot >63C

4. SEVERITY:
   - CRITICAL: Immediate safety/health risk
   - MAJOR: Significant non-compliance
   - MINOR: Small issues
   - OK: Fully compliant

5. EVIDENCE QUALITY:
   - Rate: clear, slightly_blurry, very_blurry, too_dark, too_bright, obstructed
   - found: true only if subject CLEARLY visible
   - evidenceValid: true only if good enough for regulatory evidence

Return JSON only:
{
  "results": [
    {
      "specCode": "FL-05",
      "specText": "Brief description",
      "found": true,
      "result": "PASS" | "FAIL" | "NEEDS_REVIEW",
      "confidence": 60 to 100,
      "severity": "CRITICAL" | "MAJOR" | "MINOR" | "OK",
      "finding": "Clear explanation",
      "findingAr": "Arabic translation",
      "instancesVisible": 3,
      "recommendation": "Action if FAIL",
      "recommendationAr": "Arabic",
      "imageQuality": "clear",
      "evidenceValid": true
    }
  ]
}

Only include specs where you have CLEAR evidence in the image.`;
    }

    const genAI = new GoogleGenerativeAI(geminiKey);

    // Try Pro first, fall back to Flash
    let model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    let usedFallback = false;

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: "image/jpeg",
      },
    };

    let text: string;
    try {
      const result = await model.generateContent([prompt, imagePart]);
      text = result.response.text();
    } catch (proError: unknown) {
      const err = proError as Error & { status?: number };
      if (err.message?.includes("429") || err.status === 429) {
        console.log("[AnalyzeSpec API] Pro quota exceeded, falling back to Flash");
        model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        usedFallback = true;

        const result = await model.generateContent([prompt, imagePart]);
        text = result.response.text();
      } else {
        throw proError;
      }
    }

    console.log("[AnalyzeSpec API] Model:", usedFallback ? "Flash" : "Pro", "Single:", isSingleSpec);

    // Clean and parse response
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const parsed = JSON.parse(clean);

      // Filter results with confidence >= 50 and found: true
      const validResults = (parsed.results || [])
        .filter((r: SpecResult) => r.found && r.confidence >= 50)
        .map((r: SpecResult) => ({
          specCode: r.specCode,
          specText: r.specText,
          found: r.found,
          result: r.result === "REVIEW" ? "NEEDS_REVIEW" : r.result,
          confidence: r.confidence,
          severity: r.severity || "OK",
          finding: r.finding,
          findingAr: r.findingAr,
          instancesVisible: r.instancesVisible,
          recommendation: r.recommendation,
          recommendationAr: r.recommendationAr,
          imageQuality: r.imageQuality || "clear",
          evidenceValid: r.evidenceValid ?? true,
        }));

      console.log("[AnalyzeSpec API] Found", validResults.length, "valid results");

      return NextResponse.json({ results: validResults });
    } catch (parseErr) {
      console.error("[AnalyzeSpec API] Parse error:", parseErr);
      return NextResponse.json(emptyResult);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[AnalyzeSpec API] Error:", err.message);
    return NextResponse.json(emptyResult);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutes for video processing

// Increase body size limit for video uploads (50MB)
export const fetchCache = "force-no-store";
export const revalidate = 0;

interface Spec {
  id: string;
  code: string;
  requirement: string;
  requirementAr: string;
}

interface SpecResult {
  specCode: string;
  specId: string;
  result: "PASS" | "FAIL";
  confidence: number;
  finding: string;
  findingAr: string;
  evidenceTimestamp: number;
  boundingBox?: { top: number; left: number; width: number; height: number };
}

export async function POST(request: NextRequest) {
  console.log("[VideoWalkthrough API] ========== REQUEST RECEIVED ==========");

  try {
    // Log request headers for debugging
    const contentLength = request.headers.get("content-length");
    const contentType = request.headers.get("content-type");
    console.log("[VideoWalkthrough API] Content-Length:", contentLength);
    console.log("[VideoWalkthrough API] Content-Type:", contentType);

    // Parse FormData (no size limit unlike JSON)
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseErr: unknown) {
      const errorMessage = parseErr instanceof Error ? parseErr.message : "Unknown parse error";
      console.error("[VideoWalkthrough API] ERROR: Failed to parse FormData:", errorMessage);
      return NextResponse.json({ error: `Invalid FormData: ${errorMessage}` }, { status: 400 });
    }

    // Extract video file and specs
    const videoFile = formData.get("video") as File | null;
    const specsJson = formData.get("specs") as string | null;

    if (!videoFile) {
      console.error("[VideoWalkthrough API] ERROR: No video file in FormData");
      return NextResponse.json({ error: "Missing video file" }, { status: 400 });
    }

    if (!specsJson) {
      console.error("[VideoWalkthrough API] ERROR: No specs in FormData");
      return NextResponse.json({ error: "Missing specs" }, { status: 400 });
    }

    // Parse specs JSON
    let specs: Spec[];
    try {
      specs = JSON.parse(specsJson);
    } catch {
      return NextResponse.json({ error: "Invalid specs JSON" }, { status: 400 });
    }

    if (specs.length === 0) {
      return NextResponse.json({ error: "Empty specs array" }, { status: 400 });
    }

    // Convert video File to base64 for Gemini
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const base64Video = videoBuffer.toString("base64");
    const mimeType = videoFile.type || "video/webm";

    console.log("[VideoWalkthrough API] Video file size:", videoBuffer.length, "bytes", `(${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    console.log("[VideoWalkthrough API] Base64 length:", base64Video.length, "chars");
    console.log("[VideoWalkthrough API] MIME type:", mimeType);
    console.log("[VideoWalkthrough API] Specs count:", specs.length);
    console.log("[VideoWalkthrough API] Specs:", specs.map((s) => s.code).join(", "));

    // Use base64Video for the rest of the processing
    const video = base64Video;

    // Build specs list for prompt
    const specsListText = specs
      .map((s) => `${s.code} (ID: ${s.id}): ${s.requirement}`)
      .join("\n");

    // SAQR Video Walkthrough Prompt
    const prompt = `You are SAQR, an advanced AI regulatory inspector powered by Gemini 2.5 Pro.
You are analyzing a VIDEO WALKTHROUGH of a facility. The inspector recorded a continuous walkthrough showing all areas.

TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

=== INSPECTION SPECS TO CHECK ===
${specsListText}

=== YOUR TASK ===
Watch the ENTIRE video carefully. For each spec, determine if there is evidence in the video that allows you to make a compliance determination.

ANALYSIS APPROACH:
1. Watch the video from start to finish
2. Note timestamps where relevant items appear
3. For each spec, find the BEST frame that shows evidence
4. Make PASS/FAIL determination based on what you see
5. Record the timestamp (in seconds) of the evidence frame

IMPORTANT RULES:
- Only report specs where you have CLEAR visual evidence
- Provide the exact timestamp (in seconds) where evidence is visible
- Confidence must be >= 0.6 to include a result
- Be specific about what you see as evidence
- For items that should be present (fire extinguishers, exit signs), mark as FAIL if not visible
- For condition-based items (clean surfaces, no cracks), evaluate what is visible

TEXT/OCR ANALYSIS:
- Read any visible licenses, permits, certificates
- Check expiry dates against today's date
- Read temperature displays on refrigerators/freezers
- Validate safety signage content

DAMAGE DETECTION:
- Look for cracks, water damage, mold, pest evidence
- Note any structural issues, broken equipment
- Check for blocked exits or pathways

Return JSON only (no markdown, no backticks):
{
  "results": [
    {
      "specCode": "FL-XX",
      "specId": "the spec ID from above",
      "result": "PASS" | "FAIL",
      "confidence": 0.6 to 1.0,
      "finding": "Brief description of what you observed",
      "findingAr": "Arabic translation of the finding",
      "evidenceTimestamp": 23.5,
      "boundingBox": { "top": 10, "left": 20, "width": 30, "height": 25 }
    }
  ],
  "summary": {
    "totalSpecs": ${specs.length},
    "matched": number of specs with results,
    "passed": number of PASS results,
    "failed": number of FAIL results,
    "unmatchedSpecs": ["FL-XX", "FL-YY"] // spec codes not found in video
  },
  "videoQuality": {
    "overall": "good" | "fair" | "poor",
    "issues": ["too dark in storage area", "shaky footage in kitchen"],
    "coverage": "Entrance, main area, kitchen visible. Storage and restrooms not clearly shown."
  }
}

CRITICAL: Include evidenceTimestamp for EVERY result - this is the exact second in the video where the evidence is visible.`;

    // Check for Gemini API key
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error("[VideoWalkthrough API] ERROR: No GEMINI_API_KEY configured");
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    console.log("[VideoWalkthrough API] Sending to Gemini 2.5 Pro...");

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    // Clean base64 if it has data URL prefix
    const cleanVideo = video.replace(/^data:[^;]+;base64,/, "");

    // Determine the actual MIME type
    const actualMimeType = mimeType?.startsWith("video/")
      ? mimeType.split(";")[0] // Remove codecs info
      : "video/webm";

    const videoPart = {
      inlineData: {
        data: cleanVideo,
        mimeType: actualMimeType,
      },
    };

    const result = await model.generateContent([prompt, videoPart]);
    const response = result.response;
    const text = response.text();

    console.log("[VideoWalkthrough API] Gemini response received");
    console.log("[VideoWalkthrough API] Raw response length:", text?.length);

    // Clean markdown wrapping
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error("[VideoWalkthrough API] Failed to parse response:", clean?.substring(0, 500));
      return NextResponse.json({
        error: "Failed to parse AI response",
        rawResponse: clean?.substring(0, 200),
      }, { status: 500 });
    }

    console.log("[VideoWalkthrough API] Matched specs:", parsed.results?.length || 0);
    console.log("[VideoWalkthrough API] Summary:", JSON.stringify(parsed.summary));

    // Filter results by confidence
    const filteredResults: SpecResult[] = (parsed.results || [])
      .filter((r: any) => (r.confidence || 0) >= 0.5)
      .map((r: any) => ({
        specCode: r.specCode,
        specId: r.specId,
        result: r.result,
        confidence: r.confidence,
        finding: r.finding || "Evidence found in video",
        findingAr: r.findingAr || "تم العثور على دليل في الفيديو",
        evidenceTimestamp: r.evidenceTimestamp || 0,
        boundingBox: r.boundingBox,
      }));

    // Calculate summary
    const matchedSpecIds = new Set(filteredResults.map((r) => r.specId));
    const unmatchedSpecs = specs
      .filter((s) => !matchedSpecIds.has(s.id))
      .map((s) => s.code);

    const summary = {
      totalSpecs: specs.length,
      matched: filteredResults.length,
      passed: filteredResults.filter((r) => r.result === "PASS").length,
      failed: filteredResults.filter((r) => r.result === "FAIL").length,
      unmatchedSpecs,
    };

    return NextResponse.json({
      results: filteredResults,
      summary,
      videoQuality: parsed.videoQuality || null,
    });
  } catch (error: any) {
    console.error("[VideoWalkthrough API] Error:", error);

    // Check for specific Gemini errors
    if (error.message?.includes("RESOURCE_EXHAUSTED")) {
      return NextResponse.json(
        { error: "Video is too large. Please record a shorter video." },
        { status: 413 }
      );
    }

    if (error.message?.includes("INVALID_ARGUMENT")) {
      return NextResponse.json(
        { error: "Video format not supported. Please try again." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Video analysis failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // Documents need more time for OCR

interface SpecInput {
  id: string;
  code: string;
  text: string;
  textAr?: string;
}

interface DocSpecResult {
  specCode: string;
  specId: string;
  found: boolean;
  result: "PASS" | "FAIL" | "NEEDS_REVIEW";
  confidence: number;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "OK";
  finding: string;
  findingAr: string;
  recommendation?: string;
  recommendationAr?: string;
}

interface DocAnalysisResponse {
  documentType: string;
  documentTypeAr: string;
  extractedText: string;
  details: {
    issuingAuthority?: string;
    licenseNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    isExpired?: boolean;
    hasStamp?: boolean;
    hasSignature?: boolean;
    businessName?: string;
    otherFields?: Record<string, string>;
  };
  specResults: DocSpecResult[];
  imageQuality: "clear" | "slightly_blurry" | "very_blurry" | "too_dark";
  evidenceValid: boolean;
}

const emptyResult: DocAnalysisResponse = {
  documentType: "unknown",
  documentTypeAr: "غير معروف",
  extractedText: "",
  details: {},
  specResults: [],
  imageQuality: "clear",
  evidenceValid: false,
};

export async function POST(request: NextRequest) {
  console.log("[AnalyzeDoc API] Request received");

  try {
    const body = await request.json();
    const { image, pdf, specs } = body as {
      image?: string;
      pdf?: string;
      specs: SpecInput[];
    };

    if ((!image && !pdf) || !specs || specs.length === 0) {
      console.error("[AnalyzeDoc API] Missing image/pdf or specs");
      return NextResponse.json(emptyResult);
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error("[AnalyzeDoc API] No GEMINI_API_KEY");
      return NextResponse.json(emptyResult);
    }

    // Build specs list
    const specsText = specs
      .map((s, i) => `${i + 1}. [${s.code}] ${s.text}`)
      .join("\n");

    const today = new Date().toISOString().split("T")[0];

    const prompt = `You are SAQR (صقر) document verification AI for Bahrain regulatory compliance.

DOCUMENT ANALYSIS TASK:
Read this document thoroughly using OCR. Extract ALL text, numbers, dates, stamps, and signatures.

SPECIFICATIONS TO VERIFY:
${specsText}

EXTRACTION RULES:
1. Read ALL text in the document, in any language (English, Arabic, or both)
2. Extract: document type, issuing authority, issue date, expiry date, license/permit number
3. Check if document is VALID (not expired as of today: ${today})
4. Check if document matches the business/facility name if visible
5. Check if document has official stamps, signatures, or QR codes
6. Check if document is ORIGINAL or COPY
7. Read any temperatures, measurements, or numerical values
8. Read any schedules, frequencies, or date ranges

MATCHING RULES:
- Match extracted information against each spec
- A spec PASSES if the document provides valid evidence for it
- Expired documents = FAIL with severity CRITICAL
- Missing required stamps/signatures = FAIL with severity MAJOR
- Document present but partially illegible = NEEDS_REVIEW

Return ONLY valid JSON (no markdown):
{
  "documentType": "Business License" | "Health Certificate" | "Training Record" | "Pest Control Contract" | "Fire Safety Certificate" | "Insurance Policy" | "Municipality Permit" | "Equipment Calibration" | "Cleaning Schedule" | "Temperature Log" | "Other",
  "documentTypeAr": "رخصة تجارية" | "شهادة صحية" | "سجل تدريب" | "عقد مكافحة الآفات" | "شهادة السلامة من الحريق" | "بوليصة تأمين" | "تصريح بلدية" | "معايرة المعدات" | "جدول التنظيف" | "سجل درجات الحرارة" | "أخرى",
  "extractedText": "full text extracted from document in original language",
  "details": {
    "issuingAuthority": "Ministry of Health" | null,
    "licenseNumber": "BH-12345" | null,
    "issueDate": "2024-01-15" | null,
    "expiryDate": "2025-01-15" | null,
    "isExpired": false,
    "hasStamp": true,
    "hasSignature": true,
    "businessName": "ABC Restaurant" | null,
    "otherFields": {"any": "additional relevant data"}
  },
  "specResults": [
    {
      "specCode": "LIC-01",
      "specId": "spec_id_here",
      "found": true,
      "result": "PASS" | "FAIL" | "NEEDS_REVIEW",
      "confidence": 85,
      "severity": "OK" | "MINOR" | "MAJOR" | "CRITICAL",
      "finding": "Valid business license found, License #BH-12345, expires 2025-01-15",
      "findingAr": "رخصة تجارية صالحة، رقم الترخيص BH-12345، تنتهي 2025-01-15",
      "recommendation": null,
      "recommendationAr": null
    }
  ],
  "imageQuality": "clear" | "slightly_blurry" | "very_blurry" | "too_dark",
  "evidenceValid": true
}

IMPORTANT:
- Only include specs in specResults that are RELEVANT to this document type
- Be very careful with dates - check expiry against today's date (${today})
- If a document is expired, result must be FAIL with severity CRITICAL
- If document is too blurry to read critical information, set evidenceValid: false
- Include specId from the input specs in your results`;

    const genAI = new GoogleGenerativeAI(geminiKey);

    // Use Pro for document OCR - needs accuracy
    let model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    let usedFallback = false;

    const parts: Array<{ inlineData: { data: string; mimeType: string } } | string> = [];

    if (pdf) {
      parts.push({
        inlineData: {
          data: pdf.replace(/^data:application\/pdf;base64,/, ""),
          mimeType: "application/pdf",
        },
      });
    } else if (image) {
      parts.push({
        inlineData: {
          data: image.replace(/^data:image\/\w+;base64,/, ""),
          mimeType: "image/jpeg",
        },
      });
    }

    parts.push(prompt);

    let text: string;
    try {
      const result = await model.generateContent(parts);
      text = result.response.text();
    } catch (proError: unknown) {
      const err = proError as Error & { status?: number };
      // Check for quota error (429) and fall back to Flash
      if (err.message?.includes("429") || err.status === 429) {
        console.log("[AnalyzeDoc API] Pro quota exceeded, falling back to Flash");
        model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        usedFallback = true;

        const result = await model.generateContent(parts);
        text = result.response.text();
      } else {
        throw proError;
      }
    }

    console.log("[AnalyzeDoc API] Model used:", usedFallback ? "Flash (fallback)" : "Pro");

    // Clean and parse response
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const parsed = JSON.parse(clean);

      // Add specId to results if missing
      const resultsWithIds = (parsed.specResults || []).map((r: DocSpecResult) => {
        const spec = specs.find((s) => s.code === r.specCode);
        return {
          ...r,
          specId: r.specId || spec?.id || "",
        };
      });

      console.log(
        "[AnalyzeDoc API] Document type:",
        parsed.documentType,
        "Specs matched:",
        resultsWithIds.length,
        "Valid:",
        parsed.evidenceValid
      );

      return NextResponse.json({
        documentType: parsed.documentType || "unknown",
        documentTypeAr: parsed.documentTypeAr || "غير معروف",
        extractedText: parsed.extractedText || "",
        details: parsed.details || {},
        specResults: resultsWithIds,
        imageQuality: parsed.imageQuality || "clear",
        evidenceValid: parsed.evidenceValid ?? true,
      });
    } catch (parseErr) {
      console.error("[AnalyzeDoc API] Parse error:", parseErr);
      return NextResponse.json(emptyResult);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[AnalyzeDoc API] Error:", err.message);
    return NextResponse.json(emptyResult);
  }
}

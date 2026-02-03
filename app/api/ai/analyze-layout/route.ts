import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // Layout analysis needs time

interface LayoutAnalysisResult {
  rooms: { name: string; nameAr: string; count: number }[];
  windows: number;
  doors: number;
  bathrooms: number;
  kitchens: number;
  exits: number;
  storageRooms: number;
  floors: number;
  ceilings: number;
  walls: number;
  totalArea?: string;
  notes?: string;
  notesAr?: string;
}

const defaultResult: LayoutAnalysisResult = {
  rooms: [],
  windows: 1,
  doors: 1,
  bathrooms: 1,
  kitchens: 1,
  exits: 1,
  storageRooms: 0,
  floors: 1,
  ceilings: 1,
  walls: 4,
};

export async function POST(request: NextRequest) {
  console.log("[AnalyzeLayout API] Request received");

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.error("[AnalyzeLayout API] No file provided");
      return NextResponse.json(defaultResult);
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error("[AnalyzeLayout API] No GEMINI_API_KEY");
      return NextResponse.json(defaultResult);
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const prompt = `You are SAQR layout analyzer. Read this floor plan and extract facility details.

Count ALL of the following that you can identify:
- Rooms (list each with name and count)
- Windows (total count)
- Doors (total count, including internal and external)
- Bathrooms/restrooms (count)
- Kitchens (count)
- Storage rooms (count)
- Emergency exits (count)
- Distinct floor areas (count)
- Distinct ceiling areas (count)
- Wall sections (approximate count of distinct wall segments)

IMPORTANT:
- If you cannot identify an item clearly, use reasonable estimates
- For a typical small commercial space, expect: 5-10 windows, 3-6 doors, 1-2 bathrooms
- Count distinct areas, not repetitions in the plan legend
- Be generous with estimates - it's better to have too many than too few

Return ONLY valid JSON (no markdown):
{
  "rooms": [
    { "name": "Kitchen", "nameAr": "مطبخ", "count": 1 },
    { "name": "Storage", "nameAr": "مخزن", "count": 2 },
    { "name": "Office", "nameAr": "مكتب", "count": 1 }
  ],
  "windows": 5,
  "doors": 4,
  "bathrooms": 2,
  "kitchens": 1,
  "exits": 2,
  "storageRooms": 2,
  "floors": 3,
  "ceilings": 3,
  "walls": 8,
  "totalArea": "approximately 200 sqm",
  "notes": "Two-story building with main entrance facing north",
  "notesAr": "مبنى من طابقين بمدخل رئيسي يواجه الشمال"
}`;

    const genAI = new GoogleGenerativeAI(geminiKey);
    // Use Pro for accurate layout reading
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const filePart = {
      inlineData: {
        data: base64,
        mimeType,
      },
    };

    let text: string;
    try {
      const result = await model.generateContent([prompt, filePart]);
      text = result.response.text();
    } catch (proError: unknown) {
      const err = proError as Error & { status?: number };
      // Fallback to Flash on quota error
      if (err.message?.includes("429") || err.status === 429) {
        console.log("[AnalyzeLayout API] Pro quota exceeded, falling back to Flash");
        const flashModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await flashModel.generateContent([prompt, filePart]);
        text = result.response.text();
      } else {
        throw proError;
      }
    }

    // Clean and parse response
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const parsed = JSON.parse(clean);
      console.log(
        "[AnalyzeLayout API] Parsed:",
        "Windows:", parsed.windows,
        "Doors:", parsed.doors,
        "Bathrooms:", parsed.bathrooms,
        "Kitchens:", parsed.kitchens
      );

      return NextResponse.json({
        rooms: parsed.rooms || [],
        windows: parsed.windows || 1,
        doors: parsed.doors || 1,
        bathrooms: parsed.bathrooms || 1,
        kitchens: parsed.kitchens || 1,
        exits: parsed.exits || 1,
        storageRooms: parsed.storageRooms || 0,
        floors: parsed.floors || 1,
        ceilings: parsed.ceilings || 1,
        walls: parsed.walls || 4,
        totalArea: parsed.totalArea || undefined,
        notes: parsed.notes || undefined,
        notesAr: parsed.notesAr || undefined,
      });
    } catch (parseErr) {
      console.error("[AnalyzeLayout API] Parse error:", parseErr);
      return NextResponse.json(defaultResult);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[AnalyzeLayout API] Error:", err.message);
    return NextResponse.json(defaultResult);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  console.log('[AutoScan API] ========== REQUEST RECEIVED ==========');

  try {
    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error('[AutoScan API] ERROR: Failed to parse request body');
      return NextResponse.json({ specResults: [], imageDescription: 'Invalid request', imageDescriptionAr: 'طلب غير صالح', visibleSurfaces: [] }, { status: 400 });
    }

    const { image, specs, currentZone, sweepDirection } = body;

    if (!image || !specs || specs.length === 0) {
      return NextResponse.json({ specResults: [], imageDescription: 'Missing data', imageDescriptionAr: 'بيانات مفقودة', visibleSurfaces: [] }, { status: 400 });
    }

    console.log('[AutoScan API] Specs:', specs.map((s: any) => s.code).join(', '));
    console.log('[AutoScan API] Current zone:', currentZone || 'not specified');
    console.log('[AutoScan API] Sweep direction:', sweepDirection || 'not specified');

    // Build specs list
    const specsListText = specs.map((s: any) => `${s.code} (ID: ${s.id}): ${s.requirement}`).join('\n');

    // SAQR ROBOT MODE PROMPT - Full AI capabilities
    const prompt = `You are SAQR, an advanced AI regulatory inspector powered by Gemini 2.5 Pro.
You have ROBOT MODE capabilities: zone navigation, OCR, damage detection, and environmental awareness.

${currentZone ? `CURRENT ZONE: ${currentZone}` : ''}
${sweepDirection ? `SWEEP DIRECTION: Inspector is looking ${sweepDirection}` : ''}

=== STEP 1: IMAGE QUALITY ASSESSMENT ===
First, assess the image quality:
- Brightness: Is it well-lit, dark, or overexposed?
- Sharpness: Is it clear, blurry, or has motion blur?
- Distance: Is the subject at appropriate distance, too far, or too close?
- Obstruction: Is the view clear, partially blocked, or significantly blocked?

=== STEP 2: DESCRIBE WHAT YOU SEE ===
- What objects are visible?
- What surfaces are visible? (floor, wall, ceiling, window, etc.)
- What is the camera pointing at?
- What percentage of the image shows each surface?

=== STEP 3: TEXT RECOGNITION (OCR) ===
If the image contains visible text (signs, labels, licenses, thermometers, dates, permits):
1. Read ALL visible text accurately
2. For dates: determine if expired (today is ${new Date().toISOString().split('T')[0]})
3. For temperatures: compare to food safety requirements (cold <5°C, frozen <-18°C, hot >63°C)
4. For licenses/permits: extract key details (number, expiry, business name)
5. For safety signs: verify required content is present

=== STEP 4: DAMAGE & ANOMALY DETECTION ===
Actively scan for problems:
- Cracks in walls, floors, ceiling
- Water stains or moisture damage
- Peeling paint or damaged surfaces
- Broken tiles or missing grout
- Rust or corrosion on equipment
- Mold or mildew signs
- Pest evidence (droppings, nests, gnaw marks)
- Blocked exits or pathways
- Damaged or missing light covers
- Frayed wires or exposed electrical
- Dirty or unsanitary conditions

=== STEP 5: CHECK AGAINST SPECS ===
${specsListText}

MULTI-INSTANCE RULES:
1. Count ALL instances of inspected items visible
2. Analyze EACH instance separately
3. Provide bounding box for each (percentage: top%, left%, width%, height%)
4. A spec PASSES only if ALL visible instances comply
5. If 3/4 windows have screens but 1 doesn't = FAIL

SEVERITY SCORING:
- CRITICAL: Immediate safety/health risk (contamination, no fire exits, structural damage)
- MAJOR: Significant non-compliance (missing screens, damaged ceiling, no ventilation)
- MINOR: Minor issue (small crack, light stain, minor wear)
- OK: Fully compliant

Return JSON only (no markdown, no backticks):
{
  "imageQuality": {
    "brightness": "good" | "dark" | "overexposed",
    "sharpness": "clear" | "blurry" | "motion_blur",
    "distance": "appropriate" | "too_far" | "too_close",
    "obstruction": "none" | "partial" | "significant",
    "qualityScore": 0-100,
    "recommendation": "Move closer and hold steady" | null,
    "recommendationAr": "اقترب وثبّت الهاتف" | null
  },
  "imageDescription": "exactly what the camera is pointing at",
  "imageDescriptionAr": "Arabic translation",
  "visibleSurfaces": ["floor", "wall", "ceiling", "window", "door", "outdoor", "equipment", "signage"],
  "ocrResults": [
    {
      "text": "The exact text found",
      "type": "license" | "permit" | "temperature" | "expiry_date" | "safety_sign" | "label" | "other",
      "location": "where in the image",
      "details": {
        "number": "if applicable",
        "expiry": "YYYY-MM-DD if date found",
        "valid": true | false,
        "temperature": "5°C if thermometer",
        "compliant": true | false
      }
    }
  ],
  "anomalies": [
    {
      "type": "water_damage" | "crack" | "mold" | "pest_evidence" | "rust" | "damage" | "dirty" | "blocked_exit" | "electrical_hazard",
      "location": "ceiling near ventilation duct",
      "locationAr": "السقف بالقرب من مجرى التهوية",
      "severity": "CRITICAL" | "MAJOR" | "MINOR",
      "description": "Brown water stain approximately 30cm diameter",
      "descriptionAr": "بقعة ماء بنية بقطر 30 سم تقريباً",
      "boundingBox": { "top": 10, "left": 40, "width": 20, "height": 15 }
    }
  ],
  "specResults": [
    {
      "specCode": "FL-XX",
      "specId": "the ID from above",
      "result": "PASS" | "FAIL",
      "confidence": 0.6 to 1.0,
      "severity": "CRITICAL" | "MAJOR" | "MINOR" | "OK",
      "totalInstances": 3,
      "instances": [
        {
          "id": 1,
          "label": "Window - left side",
          "labelAr": "نافذة - الجانب الأيسر",
          "boundingBox": { "top": 10, "left": 5, "width": 30, "height": 40 },
          "compliant": true,
          "note": "Has insect screen installed",
          "noteAr": "مزودة بشبكة حشرات"
        }
      ],
      "missingItems": ["fire extinguisher", "exit sign"],
      "missingItemsAr": ["طفاية حريق", "لافتة خروج"],
      "finding": "Found 3 windows. 2 have insect screens, 1 does not.",
      "findingAr": "تم العثور على 3 نوافذ. 2 مزودة بشبكات حشرات، 1 غير مزودة.",
      "evidenceMatch": "what in the image proves this spec",
      "recommendation": "Install insect screen on window near kitchen",
      "recommendationAr": "تركيب شبكة حشرات على النافذة بالقرب من المطبخ"
    }
  ],
  "guidance": "Move camera left to see remaining windows",
  "guidanceAr": "حرك الكاميرا يساراً لرؤية النوافذ المتبقية",
  "nextSweepDirection": "DOWN" | "FORWARD" | "UP" | "AROUND" | "DETAIL" | null,
  "zoneProgress": "3 of 5 specs in this zone checked"
}

MATCHING RULES:
- For FLOOR specs: Floor must occupy at least 30% of image
- For CEILING specs: Ceiling must occupy at least 30% of image
- For WINDOW specs: Windows must be clearly visible with detail
- For SAFETY specs: Look for fire extinguishers, exit signs - report if MISSING
- For TEMPERATURE specs: Read thermometer display via OCR
- For LICENSE specs: Read and validate permit details via OCR

IMPORTANT: Only include specs in specResults where you have evidence.
Always check for anomalies even if no specs match.
If image quality is poor, recommend how to improve it.`;

    // Strip the data:image prefix for Gemini
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // Try Gemini first
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        console.log('[AutoScan API] Using Gemini 2.5 Pro (Robot Mode)');

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

        console.log('[AutoScan API] Gemini response received');
        console.log('[AutoScan API] Raw response length:', text?.length);

        // Clean markdown wrapping
        const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(clean);

        console.log('[AutoScan API] Image quality:', parsed.imageQuality?.qualityScore);
        console.log('[AutoScan API] OCR results:', parsed.ocrResults?.length || 0);
        console.log('[AutoScan API] Anomalies found:', parsed.anomalies?.length || 0);
        console.log('[AutoScan API] Spec results:', parsed.specResults?.length || 0);

        // Log anomalies
        if (parsed.anomalies?.length > 0) {
          parsed.anomalies.forEach((a: any) => {
            console.log(`[AutoScan API] ANOMALY: ${a.type} (${a.severity}) - ${a.description}`);
          });
        }

        // Log OCR results
        if (parsed.ocrResults?.length > 0) {
          parsed.ocrResults.forEach((ocr: any) => {
            console.log(`[AutoScan API] OCR: ${ocr.type} - "${ocr.text}"`);
          });
        }

        // Filter spec results by confidence >= 50%
        const filteredResults = (parsed.specResults || []).filter((sr: any) => (sr.confidence || 0) >= 0.5);

        return NextResponse.json({
          imageQuality: parsed.imageQuality || null,
          specResults: filteredResults,
          imageDescription: parsed.imageDescription || 'Unable to describe',
          imageDescriptionAr: parsed.imageDescriptionAr || 'غير قادر على الوصف',
          visibleSurfaces: parsed.visibleSurfaces || [],
          ocrResults: parsed.ocrResults || [],
          anomalies: parsed.anomalies || [],
          guidance: parsed.guidance || '',
          guidanceAr: parsed.guidanceAr || '',
          nextSweepDirection: parsed.nextSweepDirection || null,
          zoneProgress: parsed.zoneProgress || null,
        });
      } catch (geminiError: any) {
        console.error('[AutoScan API] Gemini failed, trying OpenAI fallback:', geminiError.message);
      }
    }

    // OpenAI fallback
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.error('[AutoScan API] ERROR: No API key configured');
      return NextResponse.json(
        { specResults: [], imageDescription: 'API key not configured', imageDescriptionAr: 'مفتاح API غير مكوّن', visibleSurfaces: [] },
        { status: 500 }
      );
    }

    console.log('[AutoScan API] Using OpenAI GPT-4o (fallback)');

    const openai = new OpenAI({ apiKey: openaiKey });
    let imageUrl = image.startsWith('data:image/') ? image : `data:image/jpeg;base64,${image}`;

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 3000,
      temperature: 0.2,
    });

    let content = openaiResponse.choices[0].message.content;

    console.log('[AutoScan API] OpenAI response received');

    if (!content) {
      return NextResponse.json({ specResults: [], imageDescription: 'No AI response', imageDescriptionAr: 'لا يوجد رد', visibleSurfaces: [] });
    }

    content = content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const result = JSON.parse(content);
      const filteredResults = (result.specResults || []).filter((sr: any) => (sr.confidence || 0) >= 0.5);

      return NextResponse.json({
        imageQuality: result.imageQuality || null,
        specResults: filteredResults,
        imageDescription: result.imageDescription || 'Unable to describe',
        imageDescriptionAr: result.imageDescriptionAr || 'غير قادر على الوصف',
        visibleSurfaces: result.visibleSurfaces || [],
        ocrResults: result.ocrResults || [],
        anomalies: result.anomalies || [],
        guidance: result.guidance || '',
        guidanceAr: result.guidanceAr || '',
        nextSweepDirection: result.nextSweepDirection || null,
        zoneProgress: result.zoneProgress || null,
      });
    } catch (parseError) {
      console.error('[AutoScan API] Parse error:', content?.substring(0, 300));
      return NextResponse.json({
        specResults: [],
        imageDescription: 'Failed to parse AI response',
        imageDescriptionAr: 'فشل في تحليل الرد',
        visibleSurfaces: []
      });
    }
  } catch (error: any) {
    console.error('[AutoScan API] Error:', error.message);
    return NextResponse.json({
      specResults: [],
      imageDescription: 'Analysis error: ' + (error.message || 'Unknown'),
      imageDescriptionAr: 'خطأ في التحليل',
      visibleSurfaces: [],
    });
  }
}

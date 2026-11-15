import { z } from 'zod';

export interface DraftMedication {
  name: string;
  dose: string;
  times: string[];
  notes?: string | null;
}

/**
 * Zod schema for individual medication items extracted by Gemini
 */
export const geminiMedicationItemSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dose: z.string().default(''),
  times: z
    .array(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Times must be in HH:mm format'))
    .default([]),
  notes: z.string().optional().nullable().default(null),
});

/**
 * Strict schema for Gemini response envelope
 */
export const geminiDraftResponseSchema = z.object({
  medications: z.array(geminiMedicationItemSchema),
});

/**
 * Pure function: Strips any markdown code fences (```json ... ```) and surrounding whitespace
 */
export function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  return cleaned.trim();
}

/**
 * Pure function: Parses raw Gemini output, strips fences, and validates with Zod
 */
export function parseGeminiMedicationsResponse(rawText: string): DraftMedication[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  const cleaned = stripMarkdownFences(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_e) {
    throw new Error('Gemini output was not valid JSON');
  }

  const validation = geminiDraftResponseSchema.safeParse(parsed);
  if (!validation.success) {
    const issue = validation.error.errors[0]?.message || 'Schema validation failed';
    throw new Error(`Invalid medication structure from Gemini: ${issue}`);
  }

  return validation.data.medications;
}

const EXTRACTION_PROMPT = `You are a medical document reading assistant specialized in extracting prescribed medications from photos of prescriptions, medicine labels, and pill blister packs for elderly patients.

Extract all distinct medications visible in the image. Return ONLY a valid JSON object matching this exact schema:
{
  "medications": [
    {
      "name": "Full brand or generic medication name",
      "dose": "Dosage strength (e.g. 500mg, 10ml, 1 tablet)",
      "times": ["HH:mm"],
      "notes": "Any special instructions or doctor notes"
    }
  ]
}

CRITICAL RULES:
1. Return ONLY pure JSON. Never include markdown code fences, introductory text, or concluding remarks.
2. NEVER guess or fabricate dosages. If a name or dose is unreadable, blurred, or missing, omit that medication or leave the field empty.
3. Every time in "times" MUST strictly be in 24-hour "HH:mm" format (e.g. "08:00", "14:00", "20:00"). If times cannot be determined from frequency or directions, use an empty array [].
4. If no medications can be identified or the image is illegible, return: { "medications": [] }.`;

/**
 * Scans an image using Gemini Vision API with a strict 25-second timeout,
 * minimal thinking budget for fast response, and elapsed-time logging.
 */
export async function scanPrescriptionImage(
  base64Data: string,
  mimeType: string,
  timeoutMs: number = 25000
): Promise<DraftMedication[]> {
  const startTime = Date.now();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  // 1. Strict timeout promise (Promise.race)
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Gemini API request timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });

  // 2. Generation execution
  const generatePromise = (async (): Promise<string> => {
    let rawText = '';
    let genaiUsed = false;

    // Attempt to use official @google/genai SDK
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              { text: EXTRACTION_PROMPT },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingBudget: 0, // Minimal/zero thinking budget for instant turnaround
          },
        },
      });

      if (typeof response.text === 'function') {
        rawText = response.text();
      } else if (typeof response.text === 'string') {
        rawText = response.text;
      }
      genaiUsed = true;
    } catch (_importOrSdkErr) {
      genaiUsed = false;
    }

    // Direct REST API fallback
    if (!genaiUsed) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: EXTRACTION_PROMPT },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Gemini API returned HTTP ${res.status}: ${errorText}`);
      }

      const json = await res.json();
      rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    return rawText;
  })();

  try {
    const rawText = await Promise.race([generatePromise, timeoutPromise]);
    return parseGeminiMedicationsResponse(rawText);
  } catch (error: unknown) {
    const elapsedMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[scanPrescriptionImage] Failed after ${elapsedMs}ms:`, errorMessage);
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Placeholder for Gemini AI scan and explainer (Phase 4)
 * Strict JSON-only prompt with zod validation and medical disclaimer
 */

export interface ParsedMedicationDraft {
  name: string;
  dose: string;
  times: string[];
  frequency: string;
  instructions?: string;
  confidence: number;
}

export async function scanPrescription(
  _imageBase64: string,
  _mimeType: string
): Promise<ParsedMedicationDraft[]> {
  // To be implemented with @google/genai in Phase 4
  return [];
}

export async function explainMedicine(_medicineName: string): Promise<string> {
  // To be implemented with @google/genai in Phase 4
  return '';
}

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseGeminiMedicationsResponse,
  stripMarkdownFences,
  geminiDraftResponseSchema,
  scanPrescriptionImage,
} from '@/lib/gemini';

describe('gemini.ts prescription scan parser & validator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('stripMarkdownFences()', () => {
    it('strips ```json ... ``` code fences', () => {
      const input = '```json\n{"medications": []}\n```';
      expect(stripMarkdownFences(input)).toBe('{"medications": []}');
    });

    it('strips generic ``` ... ``` code fences', () => {
      const input = '```\n{"medications": []}\n```';
      expect(stripMarkdownFences(input)).toBe('{"medications": []}');
    });

    it('trims leading and trailing whitespace from unfenced text', () => {
      const input = '   {"medications": []}   ';
      expect(stripMarkdownFences(input)).toBe('{"medications": []}');
    });
  });

  describe('parseGeminiMedicationsResponse() with Mocked Gemini Output', () => {
    it('parses valid fenced JSON with multiple medications', () => {
      const mockedGeminiOutput = `\`\`\`json
{
  "medications": [
    {
      "name": "Metformin",
      "dose": "500mg",
      "times": ["08:00", "20:00"],
      "notes": "Take after meals with water"
    },
    {
      "name": "Atorvastatin",
      "dose": "10mg",
      "times": ["21:00"],
      "notes": "Bedtime"
    }
  ]
}
\`\`\``;

      const result = parseGeminiMedicationsResponse(mockedGeminiOutput);
      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Metformin');
      expect(result[0]?.dose).toBe('500mg');
      expect(result[0]?.times).toEqual(['08:00', '20:00']);
      expect(result[0]?.notes).toBe('Take after meals with water');
      expect(result[1]?.name).toBe('Atorvastatin');
    });

    it('parses unfenced clean JSON', () => {
      const mock = JSON.stringify({
        medications: [
          {
            name: 'Amlodipine',
            dose: '5mg',
            times: ['09:00'],
            notes: 'Morning blood pressure pill',
          },
        ],
      });

      const result = parseGeminiMedicationsResponse(mock);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Amlodipine');
    });

    it('handles empty medications array gracefully', () => {
      const mock = '```json\n{"medications": []}\n```';
      const result = parseGeminiMedicationsResponse(mock);
      expect(result).toEqual([]);
    });

    it('handles empty or whitespace-only input gracefully', () => {
      expect(parseGeminiMedicationsResponse('')).toEqual([]);
      expect(parseGeminiMedicationsResponse('   \n  ')).toEqual([]);
    });

    it('throws when Gemini output is completely malformed JSON', () => {
      const invalidJson = '```json\n{ medications: [ { name: "Metformin" missing close bracket\n```';
      expect(() => parseGeminiMedicationsResponse(invalidJson)).toThrow(
        'Gemini output was not valid JSON'
      );
    });

    it('throws validation error when medication is missing required name', () => {
      const missingName = JSON.stringify({
        medications: [
          {
            dose: '500mg',
            times: ['08:00'],
          },
        ],
      });

      expect(() => parseGeminiMedicationsResponse(missingName)).toThrow(
        /Invalid medication structure from Gemini/
      );
    });

    it('throws validation error when time is not in HH:mm 24-hour format', () => {
      const invalidTime = JSON.stringify({
        medications: [
          {
            name: 'Aspirin',
            dose: '75mg',
            times: ['8:00 AM'],
          },
        ],
      });

      expect(() => parseGeminiMedicationsResponse(invalidTime)).toThrow(
        /Invalid medication structure from Gemini/
      );
    });

    it('provides sensible defaults when optional fields are omitted', () => {
      const partialItem = JSON.stringify({
        medications: [
          {
            name: 'Paracetamol',
          },
        ],
      });

      const result = parseGeminiMedicationsResponse(partialItem);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Paracetamol');
      expect(result[0]?.dose).toBe('');
      expect(result[0]?.times).toEqual([]);
      expect(result[0]?.notes).toBeNull();
    });
  });

  describe('geminiDraftResponseSchema direct checks', () => {
    it('validates correct draft structures', () => {
      const valid = {
        medications: [
          {
            name: 'Lisinopril',
            dose: '10mg',
            times: ['08:30'],
            notes: null,
          },
        ],
      };
      expect(geminiDraftResponseSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects objects missing the medications array', () => {
      const invalid = { drugs: [] };
      expect(geminiDraftResponseSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('Timeout Handling in scanPrescriptionImage()', () => {
    it('rejects with clear timeout error when execution exceeds timeout limit', async () => {
      process.env.GEMINI_API_KEY = 'mock_api_key';

      // Mock fetch to simulate an indefinite hanging request
      vi.spyOn(global, 'fetch').mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      // With 10ms timeout, Promise.race triggers timeout
      await expect(scanPrescriptionImage('dummyBase64', 'image/png', 10)).rejects.toThrow(
        /timed out after/
      );
    });
  });
});

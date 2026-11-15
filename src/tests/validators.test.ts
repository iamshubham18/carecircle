import { describe, it, expect } from 'vitest';
import { medicationSchema, createHouseholdSchema } from '@/lib/validators';

describe('validators.ts', () => {
  it('validates correct household creation payload', () => {
    const result = createHouseholdSchema.safeParse({
      householdName: 'Grandma Care',
      elderName: 'Mary Smith',
      elderEmail: 'mary@example.com',
      pin: '1234',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid PIN length', () => {
    const result = createHouseholdSchema.safeParse({
      householdName: 'Grandma Care',
      elderName: 'Mary Smith',
      elderEmail: 'mary@example.com',
      pin: '12',
    });
    expect(result.success).toBe(false);
  });

  it('validates medication times in HH:mm format', () => {
    const result = medicationSchema.safeParse({
      name: 'Metformin',
      dose: '500mg',
      times: ['08:00', '20:00'],
      startDate: '2026-11-15',
    });
    expect(result.success).toBe(true);
  });
});

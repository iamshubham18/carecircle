import { describe, it, expect } from 'vitest';
import { generateDoses, detectMissedDoses } from '@/lib/schedule';

describe('schedule.ts placeholder tests', () => {
  it('generateDoses returns an array', () => {
    const doses = generateDoses(
      {
        id: 'med1',
        householdId: 'h1',
        name: 'Aspirin',
        dose: '75mg',
        times: ['09:00'],
        startDate: '2026-11-15',
        active: true,
        createdBy: 'user1',
      },
      '2026-11-15',
      7
    );
    expect(Array.isArray(doses)).toBe(true);
  });

  it('detectMissedDoses returns an array', () => {
    const missed = detectMissedDoses([], new Date().toISOString());
    expect(Array.isArray(missed)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  generateDoses,
  detectMissedDoses,
  shouldEscalate,
  localTimeToUtc,
  formatUtcToLocalTime,
  DEFAULT_TIMEZONE,
} from '@/lib/schedule';
import type { Medication, DoseLog } from '@/lib/types';

describe('schedule.ts pure domain logic', () => {
  const sampleMed: Medication = {
    id: 'med_metformin',
    householdId: 'house_123',
    name: 'Metformin',
    dose: '500mg',
    times: ['08:00', '20:00'],
    startDate: '2026-11-15',
    active: true,
    createdBy: 'user_elder',
  };

  describe('Timezone and UTC conversion', () => {
    it('converts Asia/Kolkata 08:00 on 2026-11-15 to UTC 02:30:00.000Z (+05:30 offset)', () => {
      const utcIso = localTimeToUtc('2026-11-15', '08:00', 'Asia/Kolkata');
      expect(utcIso).toBe('2026-11-15T02:30:00.000Z');
    });

    it('converts Asia/Kolkata 20:00 on 2026-11-15 to UTC 14:30:00.000Z', () => {
      const utcIso = localTimeToUtc('2026-11-15', '20:00', 'Asia/Kolkata');
      expect(utcIso).toBe('2026-11-15T14:30:00.000Z');
    });

    it('formats UTC ISO back to HH:mm in household timezone', () => {
      const localTime = formatUtcToLocalTime('2026-11-15T02:30:00.000Z', 'Asia/Kolkata');
      expect(localTime).toBe('08:00');
    });
  });

  describe('generateDoses()', () => {
    it('generates 2 doses per day for 7 days (14 total)', () => {
      const doses = generateDoses(sampleMed, '2026-11-15', 7, DEFAULT_TIMEZONE);
      expect(doses).toHaveLength(14);
      expect(doses[0]?.id).toBe('med_metformin_2026-11-15_0800');
      expect(doses[0]?.status).toBe('pending');
      expect(doses[0]?.scheduledAt).toBe('2026-11-15T02:30:00.000Z');
      expect(doses[1]?.id).toBe('med_metformin_2026-11-15_2000');
      expect(doses[1]?.scheduledAt).toBe('2026-11-15T14:30:00.000Z');
    });

    it('respects medication startDate and skips prior days', () => {
      const medWithLaterStart: Medication = {
        ...sampleMed,
        startDate: '2026-11-17',
      };
      // Requesting 7 days starting 2026-11-15 (Nov 15, 16 skipped)
      const doses = generateDoses(medWithLaterStart, '2026-11-15', 7);
      expect(doses).toHaveLength(10); // 5 days * 2 times = 10
      expect(doses[0]?.scheduledAt.startsWith('2026-11-17')).toBe(true);
    });

    it('respects medication endDate and stops scheduling afterwards', () => {
      const medWithEnd: Medication = {
        ...sampleMed,
        startDate: '2026-11-15',
        endDate: '2026-11-16',
      };
      const doses = generateDoses(medWithEnd, '2026-11-15', 7);
      expect(doses).toHaveLength(4); // 2 days * 2 = 4
    });

    it('returns empty array when medication is inactive', () => {
      const inactiveMed = { ...sampleMed, active: false };
      const doses = generateDoses(inactiveMed, '2026-11-15', 7);
      expect(doses).toHaveLength(0);
    });

    it('is idempotent: deterministic IDs match across multiple runs', () => {
      const run1 = generateDoses(sampleMed, '2026-11-15', 3);
      const run2 = generateDoses(sampleMed, '2026-11-15', 3);
      expect(run1.map((d) => d.id)).toEqual(run2.map((d) => d.id));
    });
  });

  describe('detectMissedDoses()', () => {
    it('marks pending dose as missed when current time exceeds 30-minute grace window', () => {
      const doses: DoseLog[] = [
        {
          id: 'd1',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:00:00.000Z',
          status: 'pending',
        },
      ];

      // 45 minutes later -> past 30 min grace -> missed
      const nowUtc = '2026-11-15T08:45:00.000Z';
      const missed = detectMissedDoses(doses, nowUtc, 30);
      expect(missed).toHaveLength(1);
      expect(missed[0]?.status).toBe('missed');
    });

    it('does not mark pending dose as missed if within grace window', () => {
      const doses: DoseLog[] = [
        {
          id: 'd1',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:00:00.000Z',
          status: 'pending',
        },
      ];

      // 20 minutes later -> within 30 min grace -> still pending
      const nowUtc = '2026-11-15T08:20:00.000Z';
      const missed = detectMissedDoses(doses, nowUtc, 30);
      expect(missed).toHaveLength(0);
    });

    it('does not alter already taken doses', () => {
      const doses: DoseLog[] = [
        {
          id: 'd1',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:00:00.000Z',
          status: 'taken',
          takenAt: '2026-11-15T08:05:00.000Z',
        },
      ];

      const nowUtc = '2026-11-15T12:00:00.000Z';
      const missed = detectMissedDoses(doses, nowUtc, 30);
      expect(missed).toHaveLength(0);
    });
  });

  describe('shouldEscalate()', () => {
    const missedDose: DoseLog = {
      id: 'd_missed',
      householdId: 'h1',
      medicationId: 'm1',
      scheduledAt: '2026-11-15T08:00:00.000Z',
      status: 'missed',
    };

    it('escalates to caretaker when past grace (30m) + delay (30m) = 60m', () => {
      // 65 minutes later
      const now = '2026-11-15T09:05:00.000Z';
      expect(shouldEscalate(missedDose, now, 30)).toBe(true);
    });

    it('does not escalate before delay window expires', () => {
      // 40 minutes later (in missed state, but not yet past caretaker delay threshold)
      const now = '2026-11-15T08:40:00.000Z';
      expect(shouldEscalate(missedDose, now, 30)).toBe(false);
    });

    it('does not escalate if already escalated', () => {
      const alreadyEscalated: DoseLog = {
        ...missedDose,
        escalatedAt: '2026-11-15T09:00:00.000Z',
      };
      const now = '2026-11-15T10:00:00.000Z';
      expect(shouldEscalate(alreadyEscalated, now, 30)).toBe(false);
    });
  });
});

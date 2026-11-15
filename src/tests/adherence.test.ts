import { describe, it, expect } from 'vitest';
import {
  calculateAdherence,
  calculateAdherenceSummary,
  filterDosesPastDays,
} from '@/lib/adherence';
import type { DoseLog } from '@/lib/types';

describe('adherence.ts pure logic & summary calculations', () => {
  it('returns 100% adherence when there are no doses (empty data)', () => {
    expect(calculateAdherence([])).toBe(100);
  });

  it('returns 100% adherence when only pending doses exist', () => {
    const pendingDoses: DoseLog[] = [
      {
        id: '1',
        householdId: 'h1',
        medicationId: 'm1',
        scheduledAt: '2026-11-15T08:00:00Z',
        status: 'pending',
      },
    ];
    expect(calculateAdherence(pendingDoses)).toBe(100);
  });

  it('calculates 100% when all completed doses are taken', () => {
    const doses: DoseLog[] = [
      {
        id: '1',
        householdId: 'h1',
        medicationId: 'm1',
        scheduledAt: '2026-11-15T08:00:00Z',
        status: 'taken',
      },
      {
        id: '2',
        householdId: 'h1',
        medicationId: 'm1',
        scheduledAt: '2026-11-15T14:00:00Z',
        status: 'taken',
      },
    ];
    expect(calculateAdherence(doses)).toBe(100);
  });

  it('calculates 75% adherence when 3 out of 4 doses are taken', () => {
    const doses: DoseLog[] = [
      { id: '1', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-11-15T08:00:00Z', status: 'taken' },
      { id: '2', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-11-15T12:00:00Z', status: 'taken' },
      { id: '3', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-11-15T16:00:00Z', status: 'taken' },
      { id: '4', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-11-15T20:00:00Z', status: 'missed' },
    ];
    expect(calculateAdherence(doses)).toBe(75);
  });

  it('ignores pending doses in completed adherence calculation', () => {
    const doses: DoseLog[] = [
      { id: '1', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-11-15T08:00:00Z', status: 'taken' },
      { id: '2', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-11-15T20:00:00Z', status: 'pending' },
    ];
    // 1 taken, 0 missed -> 100%
    expect(calculateAdherence(doses)).toBe(100);
  });

  it('correctly filters doses within past N days', () => {
    const nowUtc = '2026-11-15T12:00:00.000Z';
    const doses: DoseLog[] = [
      // 2 days ago
      { id: '1', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-11-13T12:00:00.000Z', status: 'taken' },
      // 10 days ago
      { id: '2', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-11-05T12:00:00.000Z', status: 'taken' },
      // 40 days ago
      { id: '3', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-10-01T12:00:00.000Z', status: 'taken' },
    ];

    const past7 = filterDosesPastDays(doses, 7, nowUtc);
    expect(past7).toHaveLength(1);
    expect(past7[0]?.id).toBe('1');

    const past30 = filterDosesPastDays(doses, 30, nowUtc);
    expect(past30).toHaveLength(2);
  });

  it('computes complete adherence summary', () => {
    const nowUtc = '2026-11-15T12:00:00.000Z';
    const doses: DoseLog[] = [
      { id: '1', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-11-15T08:00:00.000Z', status: 'taken' },
      { id: '2', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-11-14T08:00:00.000Z', status: 'missed' },
      { id: '3', householdId: 'h1', medicationId: 'm1', scheduledAt: '2026-11-15T20:00:00.000Z', status: 'pending' },
    ];

    const summary = calculateAdherenceSummary(doses, nowUtc);
    expect(summary.today).toBe(100); // 1 taken, 0 missed today
    expect(summary.sevenDay).toBe(50); // 1 taken, 1 missed over past 7 days
    expect(summary.totalTaken).toBe(1);
    expect(summary.totalMissed).toBe(1);
    expect(summary.totalPending).toBe(1);
  });
});

import { describe, it, expect } from 'vitest';
import { calculateAdherence } from '@/lib/adherence';
import type { DoseLog } from '@/lib/types';

describe('calculateAdherence()', () => {
  it('returns 100% when there are no doses', () => {
    expect(calculateAdherence([])).toBe(100);
  });

  it('returns 100% when all completed doses are taken', () => {
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
        scheduledAt: '2026-11-15T12:00:00Z',
        status: 'taken',
      },
    ];
    expect(calculateAdherence(doses)).toBe(100);
  });

  it('returns 50% when half of completed doses are missed', () => {
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
        scheduledAt: '2026-11-15T12:00:00Z',
        status: 'missed',
      },
    ];
    expect(calculateAdherence(doses)).toBe(50);
  });
});

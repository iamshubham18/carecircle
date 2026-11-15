import { describe, it, expect, afterEach } from 'vitest';
import {
  generateDoses,
  
  findUpcomingDoses,
  findOverdueDosesToMarkMissed,
  findMissedDosesToEscalate,
  findAppointmentsNeedingReminder,
  getGraceMinutes,
  getEscalationMinutes,
  getLookaheadMinutes,
  localTimeToUtc,
  formatUtcToLocalTime,
  DEFAULT_TIMEZONE,
} from '@/lib/schedule';
import { escapeHtml } from '@/lib/mailer';
import type { Medication, DoseLog, Appointment } from '@/lib/types';

describe('schedule.ts pure domain logic & reminders', () => {
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

  afterEach(() => {
    delete process.env.GRACE_MINUTES;
    delete process.env.ESCALATION_MINUTES;
    delete process.env.LOOKAHEAD_MINUTES;
  });

  describe('Configurable Timing Environment Variables', () => {
    it('returns default values (30, 30, 15) when env vars are unset', () => {
      delete process.env.GRACE_MINUTES;
      delete process.env.ESCALATION_MINUTES;
      delete process.env.LOOKAHEAD_MINUTES;

      expect(getGraceMinutes()).toBe(30);
      expect(getEscalationMinutes()).toBe(30);
      expect(getLookaheadMinutes()).toBe(15);
    });

    it('respects optional custom environment variables', () => {
      process.env.GRACE_MINUTES = '45';
      process.env.ESCALATION_MINUTES = '20';
      process.env.LOOKAHEAD_MINUTES = '10';

      expect(getGraceMinutes()).toBe(45);
      expect(getEscalationMinutes()).toBe(20);
      expect(getLookaheadMinutes()).toBe(10);
    });
  });

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
      const doses = generateDoses(medWithLaterStart, '2026-11-15', 7);
      expect(doses).toHaveLength(10);
      expect(doses[0]?.scheduledAt.startsWith('2026-11-17')).toBe(true);
    });

    it('respects medication endDate and stops scheduling afterwards', () => {
      const medWithEnd: Medication = {
        ...sampleMed,
        startDate: '2026-11-15',
        endDate: '2026-11-16',
      };
      const doses = generateDoses(medWithEnd, '2026-11-15', 7);
      expect(doses).toHaveLength(4);
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

  describe('Phase 3: findUpcomingDoses() & Idempotency', () => {
    it('finds pending doses due within the next lookahead window', () => {
      const nowUtc = '2026-11-15T08:00:00.000Z';
      const doses: DoseLog[] = [
        {
          id: 'due_soon',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:10:00.000Z', // 10 mins away
          status: 'pending',
        },
        {
          id: 'due_later',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:45:00.000Z', // 45 mins away
          status: 'pending',
        },
      ];

      const upcoming = findUpcomingDoses(doses, nowUtc, 15);
      expect(upcoming).toHaveLength(1);
      expect(upcoming[0]?.id).toBe('due_soon');
    });

    it('is strictly idempotent: skips doses that already have reminderSentAt', () => {
      const nowUtc = '2026-11-15T08:00:00.000Z';
      const doses: DoseLog[] = [
        {
          id: 'already_reminded',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:10:00.000Z',
          status: 'pending',
          reminderSentAt: '2026-11-15T07:55:00.000Z',
        },
      ];

      const upcoming = findUpcomingDoses(doses, nowUtc, 15);
      expect(upcoming).toHaveLength(0);
    });

    it('skips taken or missed doses for upcoming reminders', () => {
      const nowUtc = '2026-11-15T08:00:00.000Z';
      const doses: DoseLog[] = [
        {
          id: 'already_taken',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:05:00.000Z',
          status: 'taken',
        },
        {
          id: 'already_missed',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:05:00.000Z',
          status: 'missed',
        },
      ];

      const upcoming = findUpcomingDoses(doses, nowUtc, 15);
      expect(upcoming).toHaveLength(0);
    });
  });

  describe('Phase 3: findOverdueDosesToMarkMissed()', () => {
    it('detects pending doses exceeding grace window', () => {
      const nowUtc = '2026-11-15T08:45:00.000Z';
      const doses: DoseLog[] = [
        {
          id: 'overdue_dose',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:00:00.000Z', // 45 mins ago (>30m grace)
          status: 'pending',
        },
        {
          id: 'within_grace',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:25:00.000Z', // 20 mins ago (within 30m grace)
          status: 'pending',
        },
      ];

      const overdue = findOverdueDosesToMarkMissed(doses, nowUtc, 30);
      expect(overdue).toHaveLength(1);
      expect(overdue[0]?.id).toBe('overdue_dose');
    });

    it('leaves already completed doses untouched', () => {
      const nowUtc = '2026-11-15T10:00:00.000Z';
      const doses: DoseLog[] = [
        {
          id: 'd_taken',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:00:00.000Z',
          status: 'taken',
        },
      ];

      const overdue = findOverdueDosesToMarkMissed(doses, nowUtc, 30);
      expect(overdue).toHaveLength(0);
    });
  });

  describe('Phase 3: findMissedDosesToEscalate() & Idempotency', () => {
    it('escalates missed doses when total threshold (grace + delay) passes', () => {
      const nowUtc = '2026-11-15T09:10:00.000Z';
      const doses: DoseLog[] = [
        {
          id: 'ready_to_escalate',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:00:00.000Z', // 70m ago (>= 30 grace + 30 delay)
          status: 'missed',
        },
        {
          id: 'too_early_to_escalate',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:30:00.000Z', // 40m ago (< 60m total)
          status: 'missed',
        },
      ];

      const toEscalate = findMissedDosesToEscalate(doses, nowUtc, 30, 30);
      expect(toEscalate).toHaveLength(1);
      expect(toEscalate[0]?.id).toBe('ready_to_escalate');
    });

    it('is strictly idempotent: skips missed doses that already have escalatedAt', () => {
      const nowUtc = '2026-11-15T09:30:00.000Z';
      const doses: DoseLog[] = [
        {
          id: 'already_escalated',
          householdId: 'h1',
          medicationId: 'm1',
          scheduledAt: '2026-11-15T08:00:00.000Z',
          status: 'missed',
          escalatedAt: '2026-11-15T09:05:00.000Z',
        },
      ];

      const toEscalate = findMissedDosesToEscalate(doses, nowUtc, 30, 30);
      expect(toEscalate).toHaveLength(0);
    });
  });

  describe('Phase 3: findAppointmentsNeedingReminder() & Idempotency', () => {
    it('detects appointments needing 24h and 2h reminders', () => {
      const nowUtc = '2026-11-15T10:00:00.000Z';
      const appointments: Appointment[] = [
        {
          id: 'appt_24h',
          householdId: 'h1',
          doctor: 'Dr. Smith',
          datetime: '2026-11-16T10:00:00.000Z',
          location: 'Clinic A',
          createdBy: 'u1',
        },
        {
          id: 'appt_2h',
          householdId: 'h1',
          doctor: 'Dr. Jones',
          datetime: '2026-11-15T11:45:00.000Z',
          location: 'Clinic B',
          createdBy: 'u1',
        },
        {
          id: 'appt_far_away',
          householdId: 'h1',
          doctor: 'Dr. Brown',
          datetime: '2026-11-20T10:00:00.000Z',
          location: 'Clinic C',
          createdBy: 'u1',
        },
      ];

      const reminders = findAppointmentsNeedingReminder(appointments, nowUtc);
      expect(reminders).toHaveLength(2);
      expect(reminders.find((r) => r.appointment.id === 'appt_24h')?.type).toBe('24h');
      expect(reminders.find((r) => r.appointment.id === 'appt_2h')?.type).toBe('2h');
    });

    it('is strictly idempotent: skips already sent appointment reminders', () => {
      const nowUtc = '2026-11-15T10:00:00.000Z';
      const appointments: Appointment[] = [
        {
          id: 'appt_already_24h',
          householdId: 'h1',
          doctor: 'Dr. Smith',
          datetime: '2026-11-16T10:00:00.000Z',
          location: 'Clinic A',
          reminder24hSentAt: '2026-11-15T09:50:00.000Z',
          createdBy: 'u1',
        },
        {
          id: 'appt_already_2h',
          householdId: 'h1',
          doctor: 'Dr. Jones',
          datetime: '2026-11-15T11:45:00.000Z',
          location: 'Clinic B',
          reminder2hSentAt: '2026-11-15T09:55:00.000Z',
          createdBy: 'u1',
        },
      ];

      const reminders = findAppointmentsNeedingReminder(appointments, nowUtc);
      expect(reminders).toHaveLength(0);
    });
  });

  describe('Security: escapeHtml()', () => {
    it('escapes unsafe HTML characters to prevent email injection', () => {
      const dirty = '<script>alert("XSS")</script> & Mary\'s medicine';
      const clean = escapeHtml(dirty);
      expect(clean).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt; &amp; Mary&#039;s medicine'
      );
    });
  });
});

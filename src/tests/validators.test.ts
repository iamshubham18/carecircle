import { describe, it, expect } from 'vitest';
import {
  createHouseholdSchema,
  joinHouseholdSchema,
  loginSchema,
  medicationSchema,
  appointmentSchema,
} from '@/lib/validators';

describe('validators.ts schema coverage', () => {
  describe('createHouseholdSchema', () => {
    it('accepts valid household creation inputs', () => {
      const valid = {
        householdName: 'Grace Care',
        elderName: 'Grace Hopper',
        elderEmail: 'grace@example.com',
        pin: '1234',
      };
      expect(createHouseholdSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects short household name or invalid email', () => {
      expect(
        createHouseholdSchema.safeParse({
          householdName: 'A',
          elderName: 'Grace',
          elderEmail: 'not-an-email',
          pin: '1234',
        }).success
      ).toBe(false);
    });

    it('rejects non-numeric or invalid length PIN', () => {
      expect(
        createHouseholdSchema.safeParse({
          householdName: 'Grace Care',
          elderName: 'Grace Hopper',
          elderEmail: 'grace@example.com',
          pin: 'abc1',
        }).success
      ).toBe(false);

      expect(
        createHouseholdSchema.safeParse({
          householdName: 'Grace Care',
          elderName: 'Grace Hopper',
          elderEmail: 'grace@example.com',
          pin: '1234567', // 7 digits
        }).success
      ).toBe(false);
    });
  });

  describe('joinHouseholdSchema', () => {
    it('accepts valid join inputs for all roles', () => {
      const roles = ['elder', 'caretaker', 'family'] as const;
      for (const role of roles) {
        const res = joinHouseholdSchema.safeParse({
          code: 'ABC12345',
          name: 'Care Giver',
          email: 'care@example.com',
          role,
          pin: '5678',
        });
        expect(res.success).toBe(true);
      }
    });

    it('rejects invalid code length or invalid role', () => {
      expect(
        joinHouseholdSchema.safeParse({
          code: 'SHORT',
          name: 'Care Giver',
          email: 'care@example.com',
          role: 'caretaker',
          pin: '5678',
        }).success
      ).toBe(false);

      expect(
        joinHouseholdSchema.safeParse({
          code: 'ABC12345',
          name: 'Care Giver',
          email: 'care@example.com',
          role: 'admin', // invalid role
          pin: '5678',
        }).success
      ).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts valid login data', () => {
      const res = loginSchema.safeParse({
        code: 'XYZ98765',
        email: 'user@example.com',
        pin: '4321',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('medicationSchema', () => {
    it('accepts valid medication with multiple daily times', () => {
      const res = medicationSchema.safeParse({
        name: 'Atorvastatin',
        dose: '20mg',
        times: ['08:00', '21:30'],
        startDate: '2026-11-15',
        notes: 'Take after dinner',
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid time formats', () => {
      const res = medicationSchema.safeParse({
        name: 'Atorvastatin',
        dose: '20mg',
        times: ['8:00', '25:00'], // invalid format and invalid hour
        startDate: '2026-11-15',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('appointmentSchema', () => {
    it('accepts valid appointment data', () => {
      const res = appointmentSchema.safeParse({
        doctor: 'Dr. Sarah Connor',
        datetime: '2026-11-20T10:30:00.000Z',
        location: 'City Cardiology Clinic',
        notes: 'Annual follow-up review',
      });
      expect(res.success).toBe(true);
    });

    it('rejects non-ISO datetime', () => {
      const res = appointmentSchema.safeParse({
        doctor: 'Dr. Sarah Connor',
        datetime: 'next wednesday at 10am',
        location: 'City Cardiology Clinic',
      });
      expect(res.success).toBe(false);
    });
  });
});

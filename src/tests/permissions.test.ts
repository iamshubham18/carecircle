import { describe, it, expect } from 'vitest';
import { can, DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';

describe('Permissions Matrix can()', () => {
  it('elder always has all permissions', () => {
    expect(can('elder', 'viewMeds')).toBe(true);
    expect(can('elder', 'editMeds')).toBe(true);
    expect(can('elder', 'viewAppointments')).toBe(true);
    expect(can('elder', 'editAppointments')).toBe(true);
    expect(can('elder', 'viewAdherence')).toBe(true);
  });

  it('caretaker can view and edit meds by default', () => {
    expect(can('caretaker', 'viewMeds', DEFAULT_PERMISSIONS_MATRIX)).toBe(true);
    expect(can('caretaker', 'editMeds', DEFAULT_PERMISSIONS_MATRIX)).toBe(true);
  });

  it('family is view-only for appointments and adherence by default', () => {
    expect(can('family', 'viewMeds', DEFAULT_PERMISSIONS_MATRIX)).toBe(false);
    expect(can('family', 'editMeds', DEFAULT_PERMISSIONS_MATRIX)).toBe(false);
    expect(can('family', 'viewAppointments', DEFAULT_PERMISSIONS_MATRIX)).toBe(true);
    expect(can('family', 'editAppointments', DEFAULT_PERMISSIONS_MATRIX)).toBe(false);
    expect(can('family', 'viewAdherence', DEFAULT_PERMISSIONS_MATRIX)).toBe(true);
  });
});

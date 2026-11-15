import { describe, it, expect } from 'vitest';
import { can, DEFAULT_PERMISSIONS_MATRIX, PermissionAction } from '@/lib/permissions';
import type { PermissionsMatrix, Role } from '@/lib/types';

describe('permissions.ts role-based access matrix', () => {
  const actions: PermissionAction[] = [
    'viewMeds',
    'editMeds',
    'viewAppointments',
    'editAppointments',
    'viewAdherence',
  ];

  describe('Default Permissions Matrix', () => {
    it('elder has unrestricted access to all actions', () => {
      for (const action of actions) {
        expect(can('elder', action, DEFAULT_PERMISSIONS_MATRIX)).toBe(true);
      }
    });

    it('elder retains access even if custom matrix attempts to restrict it', () => {
      const restrictiveMatrix: PermissionsMatrix = {
        ...DEFAULT_PERMISSIONS_MATRIX,
        elder: {
          canViewMeds: false,
          canEditMeds: false,
          canViewAppointments: false,
          canEditAppointments: false,
          canViewAdherence: false,
          requireElderApproval: true,
        },
      };

      for (const action of actions) {
        expect(can('elder', action, restrictiveMatrix)).toBe(true);
      }
    });

    it('caretaker has view and edit rights for medications and appointments', () => {
      expect(can('caretaker', 'viewMeds')).toBe(true);
      expect(can('caretaker', 'editMeds')).toBe(true);
      expect(can('caretaker', 'viewAppointments')).toBe(true);
      expect(can('caretaker', 'editAppointments')).toBe(true);
      expect(can('caretaker', 'viewAdherence')).toBe(true);
    });

    it('family is view-only by default (cannot edit medications or appointments)', () => {
      expect(can('family', 'viewMeds')).toBe(true);
      expect(can('family', 'editMeds')).toBe(false);
      expect(can('family', 'viewAppointments')).toBe(true);
      expect(can('family', 'editAppointments')).toBe(false);
      expect(can('family', 'viewAdherence')).toBe(true);
    });
  });

  describe('Custom Matrix Overrides', () => {
    it('allows elder to grant family edit permissions via matrix update', () => {
      const customMatrix: PermissionsMatrix = {
        ...DEFAULT_PERMISSIONS_MATRIX,
        family: {
          ...DEFAULT_PERMISSIONS_MATRIX.family,
          canEditMeds: true,
          canEditAppointments: true,
        },
      };

      expect(can('family', 'editMeds', customMatrix)).toBe(true);
      expect(can('family', 'editAppointments', customMatrix)).toBe(true);
    });

    it('allows elder to revoke caretaker edit permissions via matrix update', () => {
      const revokedMatrix: PermissionsMatrix = {
        ...DEFAULT_PERMISSIONS_MATRIX,
        caretaker: {
          ...DEFAULT_PERMISSIONS_MATRIX.caretaker,
          canEditMeds: false,
          canEditAppointments: false,
        },
      };

      expect(can('caretaker', 'editMeds', revokedMatrix)).toBe(false);
      expect(can('caretaker', 'editAppointments', revokedMatrix)).toBe(false);
      // Still retains view rights
      expect(can('caretaker', 'viewMeds', revokedMatrix)).toBe(true);
    });

    it('handles unexpected or unknown role safely', () => {
      expect(can('guest' as unknown as Role, 'editMeds')).toBe(false);
    });
  });
});

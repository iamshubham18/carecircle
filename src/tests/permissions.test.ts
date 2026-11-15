import { describe, it, expect } from 'vitest';
import { can, DEFAULT_PERMISSIONS_MATRIX, type PermissionAction } from '@/lib/permissions';
import type { PermissionsMatrix, Role } from '@/lib/types';

describe('permissions.ts role-based access matrix', () => {
  const allActions: PermissionAction[] = [
    'viewMeds',
    'editMeds',
    'viewAppointments',
    'editAppointments',
    'viewAdherence',
  ];

  // -------------------------------------------------------------------------
  // Default matrix – elder
  // -------------------------------------------------------------------------
  describe('Elder – default matrix', () => {
    it('elder has unrestricted access to all actions', () => {
      for (const action of allActions) {
        expect(can('elder', action, DEFAULT_PERMISSIONS_MATRIX)).toBe(true);
      }
    });

    it('elder without explicit matrix argument still returns true', () => {
      for (const action of allActions) {
        expect(can('elder', action)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Elder override – can NEVER be locked out
  // -------------------------------------------------------------------------
  describe('Elder override – can never be locked out', () => {
    it('elder retains access even when matrix sets all elder flags to false', () => {
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

      for (const action of allActions) {
        expect(can('elder', action, restrictiveMatrix)).toBe(true);
      }
    });

    it('elder retains access when caretaker and family are both fully restricted', () => {
      const lockedMatrix: PermissionsMatrix = {
        elder: {
          canViewMeds: false,
          canEditMeds: false,
          canViewAppointments: false,
          canEditAppointments: false,
          canViewAdherence: false,
          requireElderApproval: false,
        },
        caretaker: {
          canViewMeds: false,
          canEditMeds: false,
          canViewAppointments: false,
          canEditAppointments: false,
          canViewAdherence: false,
          requireElderApproval: false,
        },
        family: {
          canViewMeds: false,
          canEditMeds: false,
          canViewAppointments: false,
          canEditAppointments: false,
          canViewAdherence: false,
          requireElderApproval: false,
        },
      };

      for (const action of allActions) {
        expect(can('elder', action, lockedMatrix)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Default matrix – caretaker
  // -------------------------------------------------------------------------
  describe('Caretaker – default matrix', () => {
    it('caretaker has view and edit rights for meds and appointments', () => {
      expect(can('caretaker', 'viewMeds')).toBe(true);
      expect(can('caretaker', 'editMeds')).toBe(true);
      expect(can('caretaker', 'viewAppointments')).toBe(true);
      expect(can('caretaker', 'editAppointments')).toBe(true);
      expect(can('caretaker', 'viewAdherence')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Default matrix – family
  // -------------------------------------------------------------------------
  describe('Family – default matrix', () => {
    it('family is view-only by default (cannot edit medications or appointments)', () => {
      expect(can('family', 'viewMeds')).toBe(true);
      expect(can('family', 'editMeds')).toBe(false);
      expect(can('family', 'viewAppointments')).toBe(true);
      expect(can('family', 'editAppointments')).toBe(false);
      expect(can('family', 'viewAdherence')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Custom matrix overrides
  // -------------------------------------------------------------------------
  describe('Custom matrix overrides', () => {
    it('elder can grant family edit permissions via a custom matrix', () => {
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
      // View permissions unaffected
      expect(can('family', 'viewMeds', customMatrix)).toBe(true);
    });

    it('elder can revoke caretaker edit permissions while keeping view rights', () => {
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
      // View rights still intact
      expect(can('caretaker', 'viewMeds', revokedMatrix)).toBe(true);
      expect(can('caretaker', 'viewAppointments', revokedMatrix)).toBe(true);
      expect(can('caretaker', 'viewAdherence', revokedMatrix)).toBe(true);
    });

    it('elder can revoke family adherence view', () => {
      const revokedMatrix: PermissionsMatrix = {
        ...DEFAULT_PERMISSIONS_MATRIX,
        family: {
          ...DEFAULT_PERMISSIONS_MATRIX.family,
          canViewAdherence: false,
        },
      };

      expect(can('family', 'viewAdherence', revokedMatrix)).toBe(false);
    });

    it('fully locked caretaker matrix denies all edit actions', () => {
      const noEditMatrix: PermissionsMatrix = {
        ...DEFAULT_PERMISSIONS_MATRIX,
        caretaker: {
          canViewMeds: true,
          canEditMeds: false,
          canViewAppointments: true,
          canEditAppointments: false,
          canViewAdherence: true,
          requireElderApproval: true,
        },
      };

      expect(can('caretaker', 'editMeds', noEditMatrix)).toBe(false);
      expect(can('caretaker', 'editAppointments', noEditMatrix)).toBe(false);
      expect(can('caretaker', 'viewMeds', noEditMatrix)).toBe(true);
    });

    it('fully open family matrix grants all permissions', () => {
      const openMatrix: PermissionsMatrix = {
        ...DEFAULT_PERMISSIONS_MATRIX,
        family: {
          canViewMeds: true,
          canEditMeds: true,
          canViewAppointments: true,
          canEditAppointments: true,
          canViewAdherence: true,
          requireElderApproval: false,
        },
      };

      for (const action of allActions) {
        expect(can('family', action, openMatrix)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Safety – unknown / unexpected role
  // -------------------------------------------------------------------------
  describe('Safety – unknown roles', () => {
    it('handles an unknown role gracefully by returning false', () => {
      expect(can('guest' as unknown as Role, 'editMeds')).toBe(false);
      expect(can('admin' as unknown as Role, 'viewMeds')).toBe(false);
    });

    it('returns false when role key is undefined', () => {
      expect(can(undefined as unknown as Role, 'editMeds')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // No matrix supplied – uses default
  // -------------------------------------------------------------------------
  describe('Default matrix fallback', () => {
    it('uses default matrix when no matrix is passed for caretaker', () => {
      // Default caretaker has edit rights
      expect(can('caretaker', 'editMeds')).toBe(true);
    });

    it('uses default matrix when no matrix is passed for family', () => {
      // Default family cannot edit
      expect(can('family', 'editMeds')).toBe(false);
    });
  });
});

import type { Role, PermissionsMatrix, RolePermissions } from './types';

export type PermissionAction =
  | 'viewMeds'
  | 'editMeds'
  | 'viewAppointments'
  | 'editAppointments'
  | 'viewAdherence';

export const DEFAULT_PERMISSIONS_MATRIX: PermissionsMatrix = {
  elder: {
    canViewMeds: true,
    canEditMeds: true,
    canViewAppointments: true,
    canEditAppointments: true,
    canViewAdherence: true,
    requireElderApproval: false,
  },
  caretaker: {
    canViewMeds: true,
    canEditMeds: true,
    canViewAppointments: true,
    canEditAppointments: true,
    canViewAdherence: true,
    requireElderApproval: false,
  },
  family: {
    canViewMeds: false,
    canEditMeds: false,
    canViewAppointments: true,
    canEditAppointments: false,
    canViewAdherence: true,
    requireElderApproval: false,
  },
};

/**
 * Pure function to check role permissions against matrix
 */
export function can(
  role: Role,
  action: PermissionAction,
  matrix: PermissionsMatrix = DEFAULT_PERMISSIONS_MATRIX
): boolean {
  if (role === 'elder') {
    return true; // Elder always has full permission
  }

  const rolePerms: RolePermissions = matrix[role];
  if (!rolePerms) return false;

  switch (action) {
    case 'viewMeds':
      return rolePerms.canViewMeds;
    case 'editMeds':
      return rolePerms.canEditMeds;
    case 'viewAppointments':
      return rolePerms.canViewAppointments;
    case 'editAppointments':
      return rolePerms.canEditAppointments;
    case 'viewAdherence':
      return rolePerms.canViewAdherence;
    default:
      return false;
  }
}

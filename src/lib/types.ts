export type Role = 'elder' | 'caretaker' | 'family';

export type DoseStatus = 'pending' | 'taken' | 'missed';

export interface Household {
  id: string;
  name: string;
  code: string; // 8 characters
  elderId: string;
  createdAt: string; // UTC ISO string
}

export interface Member {
  id: string;
  householdId: string;
  name: string;
  email: string;
  role: Role;
  pinHash: string;
  createdAt: string; // UTC ISO string
}

export interface RolePermissions {
  canViewMeds: boolean;
  canEditMeds: boolean;
  canViewAppointments: boolean;
  canEditAppointments: boolean;
  canViewAdherence: boolean;
  requireElderApproval: boolean;
}

export interface PermissionsMatrix {
  id?: string;
  elder: RolePermissions;
  caretaker: RolePermissions;
  family: RolePermissions;
}

export interface Medication {
  id: string;
  householdId: string;
  name: string;
  dose: string;
  times: string[]; // HH:mm format
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  notes?: string;
  active: boolean;
  createdBy: string;
}

export interface DoseLog {
  id: string;
  householdId: string;
  medicationId: string;
  scheduledAt: string; // UTC ISO string
  status: DoseStatus;
  takenAt?: string;
  takenBy?: string;
  reminderSentAt?: string;
  escalatedAt?: string;
}

export interface Appointment {
  id: string;
  householdId: string;
  doctor: string;
  datetime: string; // UTC ISO string
  location: string;
  notes?: string;
  reminderSentAt?: string;
  reminder24hSentAt?: string;
  reminder2hSentAt?: string;
  createdBy: string;
}

export interface AuditEntry {
  id: string;
  householdId: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  at: string; // UTC ISO string
}

export interface SessionData {
  userId: string;
  householdId: string;
  role: Role;
  name: string;
  email: string;
}

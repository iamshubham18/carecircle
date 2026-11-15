import { z } from 'zod';

export const createHouseholdSchema = z.object({
  householdName: z.string().min(2, 'Household name must be at least 2 characters').max(50),
  elderName: z.string().min(2, 'Name must be at least 2 characters').max(50),
  elderEmail: z.string().email('Invalid email address'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
});

export const joinHouseholdSchema = z.object({
  code: z.string().length(8, 'Household code must be 8 characters').toUpperCase(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email address'),
  role: z.enum(['elder', 'caretaker', 'family']),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
});

export const loginSchema = z.object({
  code: z.string().length(8, 'Household code must be 8 characters').toUpperCase(),
  email: z.string().email('Invalid email address'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
});

export const medicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required').max(100),
  dose: z.string().min(1, 'Dose is required').max(50),
  times: z
    .array(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'))
    .min(1, 'At least one scheduled time is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date format (YYYY-MM-DD)').optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateMedicationSchema = medicationSchema.partial().extend({
  active: z.boolean().optional(),
});

export const appointmentSchema = z.object({
  doctor: z.string().min(1, 'Doctor name is required').max(100),
  datetime: z.string().datetime({ message: 'Must be a valid UTC ISO datetime string' }),
  location: z.string().min(1, 'Location is required').max(200),
  notes: z.string().max(500).optional().nullable(),
});

export const updateAppointmentSchema = appointmentSchema.partial();

export const rolePermissionsSchema = z.object({
  canViewMeds: z.boolean(),
  canEditMeds: z.boolean(),
  canViewAppointments: z.boolean(),
  canEditAppointments: z.boolean(),
  canViewAdherence: z.boolean(),
  requireElderApproval: z.boolean().optional().default(false),
});

export const updatePermissionsSchema = z.object({
  caretaker: rolePermissionsSchema,
  family: rolePermissionsSchema,
});

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type JoinHouseholdInput = z.infer<typeof joinHouseholdSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MedicationInput = z.infer<typeof medicationSchema>;
export type UpdateMedicationInput = z.infer<typeof updateMedicationSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;

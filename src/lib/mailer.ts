/**
 * Placeholder for email notification service (Phase 3)
 * Uses Nodemailer with Gmail SMTP and accessible HTML templates
 */

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(_payload: EmailPayload): Promise<{ success: boolean }> {
  // To be implemented in Phase 3
  return { success: true };
}

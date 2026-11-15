import nodemailer from 'nodemailer';

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Escapes user-controlled text to prevent HTML injection in email clients
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Base high-contrast, accessible HTML email template wrapper
 * 18px+ readable typography, dark slate on pure white, high-contrast borders
 */
export function renderEmailWrapper(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 18px; line-height: 1.6; color: #0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 3px solid #1e40af; border-radius: 12px; overflow: hidden;">
    <!-- Header -->
    <tr>
      <td style="padding: 24px; background-color: #1e40af; color: #ffffff; text-align: left;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff;">CareCircle</h1>
        <p style="margin: 4px 0 0 0; font-size: 16px; color: #dbeafe; font-weight: 600;">Elderly Care &amp; Medication Management</p>
      </td>
    </tr>
    <!-- Content Body -->
    <tr>
      <td style="padding: 32px 24px;">
        ${bodyContent}
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding: 20px 24px; background-color: #f1f5f9; border-top: 2px solid #e2e8f0; font-size: 14px; color: #475569; text-align: center;">
        <p style="margin: 0;">CareCircle Platform &bull; Automated Healthcare Reminders</p>
        <p style="margin: 4px 0 0 0;">Please follow your doctor's official advice for all prescription decisions.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Upcoming Dose Reminder Email
 */
export function renderUpcomingDoseEmail(params: {
  elderName: string;
  medicationName: string;
  dose: string;
  scheduledTime: string;
  notes?: string;
}): { subject: string; text: string; html: string } {
  const safeElderName = escapeHtml(params.elderName);
  const safeMedName = escapeHtml(params.medicationName);
  const safeDose = escapeHtml(params.dose);
  const safeTime = escapeHtml(params.scheduledTime);
  const safeNotes = params.notes ? escapeHtml(params.notes) : null;

  const subject = `Medication Reminder: ${params.medicationName} at ${params.scheduledTime}`;

  const text = `Hello ${params.elderName},

This is your friendly CareCircle reminder for your upcoming medication dose:

Medication: ${params.medicationName}
Dose: ${params.dose}
Scheduled Time: ${params.scheduledTime}
${params.notes ? `Instructions: ${params.notes}\n` : ''}
When you have taken your dose, please open CareCircle and tap "I took it" to keep your household updated.`;

  const htmlContent = `
    <h2 style="margin-top: 0; font-size: 22px; font-weight: 800; color: #0f172a;">
      Hello ${safeElderName},
    </h2>
    <p style="font-size: 18px; color: #334155; margin-bottom: 20px;">
      Here is your reminder for your upcoming medication scheduled in the next 15 minutes:
    </p>

    <div style="background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; font-size: 22px; font-weight: 900; color: #1e3a8a;">
        💊 ${safeMedName} &mdash; ${safeDose}
      </p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1e40af;">
        ⏰ Scheduled Time: ${safeTime}
      </p>
      ${
        safeNotes
          ? `<p style="margin: 12px 0 0 0; font-size: 16px; font-style: italic; color: #475569;">Note: ${safeNotes}</p>`
          : ''
      }
    </div>

    <p style="font-size: 18px; color: #0f172a; margin-top: 24px;">
      After taking your dose, please open your CareCircle Today view and tap <strong>"✓ I took it"</strong>.
    </p>
  `;

  return {
    subject,
    text,
    html: renderEmailWrapper(subject, htmlContent),
  };
}

/**
 * 2. Missed Dose Alert Email to Elder
 */
export function renderMissedDoseEmail(params: {
  elderName: string;
  medicationName: string;
  dose: string;
  scheduledTime: string;
}): { subject: string; text: string; html: string } {
  const safeElderName = escapeHtml(params.elderName);
  const safeMedName = escapeHtml(params.medicationName);
  const safeDose = escapeHtml(params.dose);
  const safeTime = escapeHtml(params.scheduledTime);

  const subject = `Attention: Missed Dose - ${params.medicationName}`;

  const text = `Hello ${params.elderName},

We noticed that your scheduled dose of ${params.medicationName} (${params.dose}) at ${params.scheduledTime} has not been marked as taken after the 30-minute grace window.

If you have already taken it, please open CareCircle and tap "I took it" now so your caretakers know you are safe. If not, please take your medication or contact your caretaker.`;

  const htmlContent = `
    <div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 20px; font-weight: 900; color: #991b1b;">
        ⚠️ Overdue Medication Notice
      </p>
    </div>

    <h2 style="margin-top: 0; font-size: 22px; font-weight: 800; color: #0f172a;">
      Hello ${safeElderName},
    </h2>
    <p style="font-size: 18px; color: #334155;">
      Your dose of <strong>${safeMedName}</strong> (${safeDose}) scheduled for <strong>${safeTime}</strong> has passed the 30-minute grace window without confirmation.
    </p>

    <div style="background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #92400e;">
        What should you do?
      </p>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 16px; color: #78350f;">
        <li>If you already took it: Tap <strong>"✓ I took it"</strong> in CareCircle.</li>
        <li>If you forgot: Take it if safe, or consult your doctor or caretaker.</li>
      </ul>
    </div>
  `;

  return {
    subject,
    text,
    html: renderEmailWrapper(subject, htmlContent),
  };
}

/**
 * 3. Caretaker Escalation Alert Email
 */
export function renderCaretakerEscalationEmail(params: {
  caretakerName: string;
  elderName: string;
  medicationName: string;
  dose: string;
  scheduledTime: string;
}): { subject: string; text: string; html: string } {
  const safeCaretakerName = escapeHtml(params.caretakerName);
  const safeElderName = escapeHtml(params.elderName);
  const safeMedName = escapeHtml(params.medicationName);
  const safeDose = escapeHtml(params.dose);
  const safeTime = escapeHtml(params.scheduledTime);

  const subject = `Urgent Escalation: ${params.elderName} missed dose of ${params.medicationName}`;

  const text = `Hello ${params.caretakerName},

This is an automated escalation from CareCircle.
${params.elderName} has not confirmed their dose of ${params.medicationName} (${params.dose}) scheduled for ${params.scheduledTime}.

More than 60 minutes have elapsed since the scheduled time, and previous reminders have gone unconfirmed.
Please check in with ${params.elderName} to ensure they are safe.`;

  const htmlContent = `
    <div style="background-color: #b91c1c; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
      <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff;">
        🚨 Caretaker Escalation Alert
      </p>
    </div>

    <h2 style="margin-top: 0; font-size: 22px; font-weight: 800; color: #0f172a;">
      Hello ${safeCaretakerName},
    </h2>
    <p style="font-size: 18px; color: #334155;">
      <strong>${safeElderName}</strong> has not confirmed their scheduled medication dose:
    </p>

    <div style="background-color: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 6px 0; font-size: 20px; font-weight: 900; color: #991b1b;">
        Medication: ${safeMedName} &mdash; ${safeDose}
      </p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #7f1d1d;">
        Scheduled Time: ${safeTime} (&gt;60 mins overdue)
      </p>
    </div>

    <p style="font-size: 18px; color: #0f172a;">
      The 30-minute grace window and 30-minute reminder delay have elapsed without response.
      <strong>Please check in with ${safeElderName} to verify their wellbeing.</strong>
    </p>
  `;

  return {
    subject,
    text,
    html: renderEmailWrapper(subject, htmlContent),
  };
}

/**
 * 4. Doctor Appointment Reminder Email
 */
export function renderAppointmentReminderEmail(params: {
  recipientName: string;
  doctor: string;
  formattedDatetime: string;
  location: string;
  notes?: string;
  hoursNotice: '24 hours' | '2 hours';
}): { subject: string; text: string; html: string } {
  const safeRecipientName = escapeHtml(params.recipientName);
  const safeDoctor = escapeHtml(params.doctor);
  const safeDatetime = escapeHtml(params.formattedDatetime);
  const safeLocation = escapeHtml(params.location);
  const safeNotes = params.notes ? escapeHtml(params.notes) : null;
  const safeNotice = escapeHtml(params.hoursNotice);

  const subject = `Appointment Reminder (${params.hoursNotice}): ${params.doctor}`;

  const text = `Hello ${params.recipientName},

This is a reminder that you have an upcoming doctor appointment in ${params.hoursNotice}:

Doctor: ${params.doctor}
Date & Time: ${params.formattedDatetime}
Location: ${params.location}
${params.notes ? `Notes: ${params.notes}\n` : ''}
Please ensure all necessary medical files and prescriptions are ready.`;

  const htmlContent = `
    <h2 style="margin-top: 0; font-size: 22px; font-weight: 800; color: #0f172a;">
      Hello ${safeRecipientName},
    </h2>
    <p style="font-size: 18px; color: #334155;">
      You have an appointment coming up in approximately <strong>${safeNotice}</strong>:
    </p>

    <div style="background-color: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 22px; font-weight: 900; color: #14532d;">
        🩺 ${safeDoctor}
      </p>
      <p style="margin: 0 0 6px 0; font-size: 18px; font-weight: 700; color: #166534;">
        🗓️ ${safeDatetime}
      </p>
      <p style="margin: 0; font-size: 18px; color: #15803d;">
        📍 <strong>Location:</strong> ${safeLocation}
      </p>
      ${
        safeNotes
          ? `<p style="margin: 12px 0 0 0; font-size: 16px; font-style: italic; color: #374151;">Note: ${safeNotes}</p>`
          : ''
      }
    </div>

    <p style="font-size: 16px; color: #475569;">
      Remember to carry your health records and list of active medications.
    </p>
  `;

  return {
    subject,
    text,
    html: renderEmailWrapper(subject, htmlContent),
  };
}

/**
 * Creates nodemailer transporter from environment variables
 */
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends an email using Nodemailer.
 * Safe execution: errors are caught and returned gracefully without throwing or crashing cron runs.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      console.warn('[sendEmail] SMTP credentials missing (SMTP_USER or SMTP_PASS not set). Skipping delivery.');
      return { success: false, error: 'SMTP credentials not configured' };
    }

    const from = process.env.MAIL_FROM || `"CareCircle" <${process.env.SMTP_USER}>`;

    await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown mailer error';
    console.error('[sendEmail] Mail delivery error:', message);
    return { success: false, error: message };
  }
}

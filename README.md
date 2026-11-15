# CareCircle

> **A smart, shared care ecosystem where elderly people, caretakers, and family manage medications, routines, and appointments—with the elder always in control.**

[![Live Demo](https://img.shields.io/badge/demo-live%20preview-blue)](https://your-app.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. Live Demo & Screenshots

- **Live Deployed Application**: [https://your-app.vercel.app](https://your-app.vercel.app) *(To be updated after Vercel deployment)*
- **One-Click Demo**: Accessible via "Try demo" on the landing page (preloaded with sample elderly household, medications, and schedule).

### Screenshots
*(Screenshots will be added during Phase 6)*
- **Landing Page**: Large-contrast, accessible entry points.
- **Elder Today View**: High-contrast, large-button interface for one-tap dose marking.
- **Family / Caretaker Dashboard**: Adherence overview and schedule monitoring.
- **Gemini Scan & Explainer**: Prescription draft extraction with physician disclaimers.

---

## 2. Problem Statement & CareCircle Solution

Elderly individuals frequently juggle multiple prescription medications with complex schedules, leading to missed doses, incorrect timing, or accidental double-dosing. Existing digital reminder apps present severe friction:
1. **Paternalistic Design**: Most apps treat seniors as passive subjects monitored by relatives, eroding autonomy and dignity.
2. **Cognitive & Visual Overload**: Small fonts, poor contrast ratios, complex nested navigations, and ambiguous icons make apps unusable for aging eyes and motor tremor.
3. **Communication Gaps**: Missed doses often go unnoticed by family and caretakers until a health crisis occurs.

### How CareCircle Solves It Point-by-Point:
- **Elder at the Centre of Control**: The elder owns the household. They determine permissions, approve medication updates, and mark doses directly.
- **Elder-First Accessibility**: High-contrast tokens, minimum 18px base typography, 48px+ touch targets, skip links, screen-reader semantics, and voice support.
- **Smart Escalation Matrix**: Reminders alert the elder first. If a dose remains unconfirmed past the grace window, the system proactively notifies designated caretakers.
- **Multimodal AI Assistance**: Gemini Vision turns complex pill-strip packaging and prescriptions into structured drafts that the elder or caretaker confirms with doctor guidance.

---

## 3. Features & Architecture

### Must Features (Baseline)
- **Household Passcode Access**: Secure household creation and joining via 8-character code and individual hashed PINs.
- **Role-Based Views**: Distinct capabilities tailored for Elder, Caretaker, and Family members.
- **Medication & Appointment CRUD**: Multiple daily times, start/end dates, doctor notes, and scheduling.
- **Pure Adherence Calculation**: Real-time 7-day and 30-day percentage calculations based on scheduled vs. taken doses.
- **Proactive Email Reminders**: Timezone-aware reminders for upcoming doses, appointments, and missed dose escalations.

### Differentiators (Winning Features)
- **Elder-Controlled Permissions Matrix**: Granular toggles allowing the elder to grant or revoke caretaker and family editing privileges in real time.
- **Immutable Audit Trail**: Log of all medication additions, deletions, dose acknowledgments, and permission changes.
- **Gemini Prescription Scan**: OCR and schedule structuring from photos of prescriptions, strictly requiring user confirmation and doctor disclaimer.
- **Smart Two-Tier Escalation**: Proactive email ping to the elder followed by caretaker alert after a configurable grace period.

---

## 4. Architecture & Repository Structure

CareCircle uses Next.js 14 App Router with pure server-side Firestore operations, strict separation of concerns, and zero client-side database exposure.

### Folder Structure
```
carecircle/
  README.md                   # Problem, features, architecture, setup, env, tests
  .env.example                # Template of all required environment variables
  .gitignore                  # Strictly ignores secrets, credentials, and artifacts
  package.json                # Project scripts and dependencies
  tsconfig.json               # Strict TypeScript configuration
  vitest.config.ts            # Unit testing configuration for pure logic
  tailwind.config.ts          # High-contrast color tokens and elder typography
  src/
    app/
      page.tsx                # Accessible landing page + "Try demo"
      layout.tsx              # Root layout with lang attribute and skip link
      (auth)/
        create/page.tsx       # Household creation
        join/page.tsx         # Household join with code + PIN
      dashboard/page.tsx      # Role-aware dashboard
      elder/page.tsx          # Large-button "Today" view for seniors
      medications/            # Medication management
      appointments/           # Doctor appointment tracking
      settings/permissions/   # Elder-only permissions matrix
      activity/               # Household audit log
      api/
        auth/                 # Create, join, logout, me routes
        medications/          # Medication CRUD routes
        doses/                # Dose take routes
        appointments/         # Appointment routes
        permissions/          # Role permission matrix routes
        audit/                # Activity history routes
        ai/scan/              # Gemini prescription scan
        ai/explain/           # Gemini medication explainer
        cron/reminders/       # Scheduled reminder & escalation engine
        health/               # Health check confirming Firestore connectivity
    lib/
      firebase.ts             # Firebase Admin singleton (server-side only)
      auth.ts                 # PIN hashing (bcryptjs) & JWT tokens (jose)
      permissions.ts          # Pure permission checker: can(role, action, matrix)
      schedule.ts             # Pure dose schedule generator & missed dose detector
      adherence.ts            # Pure adherence percentage calculator
      gemini.ts               # Google GenAI vision & explainer wrappers
      mailer.ts               # Nodemailer Gmail SMTP client + accessible HTML templates
      validators.ts           # Zod validation schemas for all inputs & AI outputs
      rateLimit.ts            # In-memory IP rate limiter
      audit.ts                # Audit logging helper
      seed.ts                 # Demo household seed loader
    components/               # Reusable accessible UI components
    tests/                    # Vitest unit test suites for pure logic
```

---

## 5. Tech Stack & Google Services

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | Next.js 14 (App Router) + TypeScript (Strict) | Single repo for UI and server endpoints |
| **Styling** | Tailwind CSS | 18px+ base font, high-contrast tokens, WCAG AAA targets |
| **Database** | Google Firebase Firestore (`firebase-admin`) | **Server-side only**. Browser never touches Firestore |
| **AI Integration** | Google Gemini API via `@google/genai` | Vision model for prescription scan, text model for explainer |
| **Authentication** | Passcode + Member PIN (`bcryptjs`) + `jose` JWT | `httpOnly`, `SameSite=Lax`, secure cookies |
| **Email Service** | Nodemailer with Gmail SMTP | High-deliverability transactional reminders |
| **Testing** | Vitest | Fast unit tests for pure domain logic |
| **Deployment** | Vercel | Instant global edge delivery and continuous integration |

---

## 6. Setup & Installation Instructions

### Prerequisites
- Node.js 18.x or 20.x or higher
- A Google Cloud / Firebase project with Firestore enabled
- A Google AI Studio Gemini API key
- A Gmail account with an App Password configured

### Installation
```bash
# Clone repository
git clone https://github.com/your-username/carecircle.git
cd carecircle

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
```

### Running Locally
```bash
# Start Next.js development server
npm run dev

# Run TypeScript checks
npm run typecheck

# Run ESLint
npm run lint

# Run unit tests
npm test

# Build for production
npm run build
```

---

## 7. Environment Variables Reference

See `.env.example` for the full schema. Secrets must **only** reside in `.env.local` or Vercel dashboard:

| Variable | Purpose | Example / Format |
| :--- | :--- | :--- |
| `FIREBASE_PROJECT_ID` | Firebase Project identifier | `carecircle-prod` |
| `FIREBASE_CLIENT_EMAIL` | Service Account client email | `firebase-adminsdk@...iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | Service Account private key | `"-----BEGIN PRIVATE KEY-----\n..."` |
| `GEMINI_API_KEY` | Google AI Studio API key | `AIzaSy...` |
| `GEMINI_MODEL` | Gemini Flash model name | `gemini-1.5-flash` |
| `JWT_SECRET` | Secret key for signing session tokens | `32+_random_character_string` |
| `SMTP_HOST` | Gmail SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | Gmail SMTP SSL port | `465` |
| `SMTP_USER` | Gmail address sending reminders | `carecircle.notify@gmail.com` |
| `SMTP_PASS` | Gmail 16-character App Password | `xxxx xxxx xxxx xxxx` |
| `MAIL_FROM` | Sender display name and email | `"CareCircle <carecircle.notify@gmail.com>"` |
| `CRON_SECRET` | Bearer secret for `/api/cron/reminders` | Random hexadecimal string |
| `APP_URL` | Public application URL | `https://your-app.vercel.app` |
| `DEFAULT_TIMEZONE` | Fallback timezone for schedule math | `Asia/Kolkata` |

---

## 8. Security, Accessibility & Testing Notes

### Security Standards
- **Zero Client-Side DB Access**: All Firestore queries and mutations execute strictly in server route handlers.
- **Safe Authentication**: PINs are never stored in plain text (salted and hashed with `bcryptjs`). Sessions use `httpOnly`, `SameSite=Lax`, and `Secure` cookies.
- **No IDOR**: Every route handler validates that the accessed record belongs to the authenticated user's `householdId`.
- **Strict Input Validation**: Zod schemas validate every API request body, query parameter, and Gemini output before processing.

### Accessibility Design
- **Base Typography**: 18px base font size for enhanced legibility.
- **High-Contrast Colors**: Color contrast exceeds WCAG AA (4.5:1), aiming for AAA (7:1).
- **Navigation & Focus**: Skip-to-content link, semantic HTML (`nav`, `main`, `h1`), and visible focus rings.
- **Motion Reduction**: Full support for `prefers-reduced-motion`.

### Automated Testing
- Pure business logic in `src/lib` is covered by automated unit tests (`schedule.test.ts`, `permissions.test.ts`, `adherence.test.ts`, `validators.test.ts`, `auth.test.ts`).

---

## 9. Limitations & Future Roadmap

- **Voice Interaction & Natural Speech**: Real-time bi-directional voice interface for seniors who find touch typing challenging.
- **SMS & WhatsApp Dispatch**: Twilio / WhatsApp Business messaging for households without active email apps on phones.
- **Smart Dispenser & Wearable Integration**: Bluetooth pill dispenser tracking and Apple Health / Fitbit vitals correlation.
- **Multi-Language Localization**: Dynamic translation into vernacular regional languages.

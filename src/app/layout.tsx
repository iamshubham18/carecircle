import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CareCircle - Elderly Care & Medication Management Platform',
  description:
    'A smart, shared care ecosystem where elderly people, caretakers, and family manage medications, routines, and appointments while the elder stays in control.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-blue-200">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

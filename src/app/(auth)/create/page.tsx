'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CreateHouseholdPage() {
  const router = useRouter();

  const [householdName, setHouseholdName] = useState('');
  const [elderName, setElderName] = useState('');
  const [elderEmail, setElderEmail] = useState('');
  const [pin, setPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!householdName.trim() || !elderName.trim() || !elderEmail.trim() || !pin.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4 to 6 numbers.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdName: householdName.trim(),
          elderName: elderName.trim(),
          elderEmail: elderEmail.trim(),
          pin: pin.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create household. Please try again.');
        setLoading(false);
        return;
      }

      // Elder always owns household, redirect to elder view
      router.push('/elder');
    } catch (_err) {
      setError('A network error occurred. Please check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b-2 border-slate-300 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="text-2xl font-black text-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-600 rounded">
            CareCircle
          </Link>
          <Link
            href="/join"
            className="text-lg font-bold text-blue-900 underline hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-600 rounded p-1"
          >
            Have a code? Join here
          </Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10">
        <div className="rounded-2xl border-2 border-slate-300 bg-white p-8 shadow-md sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Create Household
          </h1>
          <p className="mt-3 text-lg font-medium text-slate-700">
            Set up a secure household where the elder remains at the center of their own care decisions.
          </p>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-6 rounded-xl border-2 border-red-600 bg-red-50 p-4 text-lg font-bold text-red-900"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-2xl">⚠️</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6" noValidate>
            <div>
              <label htmlFor="householdName" className="block text-lg font-bold text-slate-900">
                Household Name
              </label>
              <span id="household-hint" className="block text-sm text-slate-600 mb-1">
                e.g. &ldquo;Mom&apos;s Care Circle&rdquo; or &ldquo;Sharma Family&rdquo;
              </span>
              <input
                id="householdName"
                type="text"
                aria-describedby="household-hint"
                required
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="Mom's Care Circle"
                className="mt-1 block min-h-[52px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="elderName" className="block text-lg font-bold text-slate-900">
                Elder&apos;s Full Name
              </label>
              <input
                id="elderName"
                type="text"
                required
                value={elderName}
                onChange={(e) => setElderName(e.target.value)}
                placeholder="Mary Sharma"
                className="mt-1 block min-h-[52px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="elderEmail" className="block text-lg font-bold text-slate-900">
                Elder&apos;s Email Address
              </label>
              <span id="email-hint" className="block text-sm text-slate-600 mb-1">
                Used to receive medication reminders and emergency alerts
              </span>
              <input
                id="elderEmail"
                type="email"
                aria-describedby="email-hint"
                required
                value={elderEmail}
                onChange={(e) => setElderEmail(e.target.value)}
                placeholder="elder@example.com"
                className="mt-1 block min-h-[52px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="pin" className="block text-lg font-bold text-slate-900">
                Elder&apos;s Personal PIN (4 to 6 digits)
              </label>
              <span id="pin-hint" className="block text-sm text-slate-600 mb-1">
                Used for quick, secure sign-in without needing complex passwords
              </span>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                aria-describedby="pin-hint"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="1234"
                className="mt-1 block min-h-[52px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-2xl font-bold tracking-widest text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded-xl bg-blue-900 px-6 py-4 text-xl font-bold text-white shadow-md transition-colors hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? 'Creating Household...' : 'Create Household & Sign In'}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6 text-center">
            <Link
              href="/"
              className="text-lg font-bold text-slate-700 underline hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-blue-600 rounded p-1"
            >
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

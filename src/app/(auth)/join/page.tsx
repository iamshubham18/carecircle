'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Role } from '@/lib/types';

export default function JoinHouseholdPage() {
  const router = useRouter();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('caretaker');
  const [pin, setPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = code.toUpperCase().trim();
    if (!cleanCode || cleanCode.length !== 8) {
      setError('Household code must be exactly 8 characters.');
      return;
    }

    if (!name.trim() || !email.trim() || !pin.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4 to 6 numbers.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          name: name.trim(),
          email: email.trim(),
          role,
          pin: pin.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to join household. Please check your code and PIN.');
        setLoading(false);
        return;
      }

      if (data.member?.role === 'elder') {
        router.push('/elder');
      } else {
        router.push('/dashboard');
      }
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
            href="/create"
            className="text-lg font-bold text-blue-900 underline hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-600 rounded p-1"
          >
            Need a new household? Create one
          </Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10">
        <div className="rounded-2xl border-2 border-slate-300 bg-white p-8 shadow-md sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Join Household
          </h1>
          <p className="mt-3 text-lg font-medium text-slate-700">
            Enter the 8-character household code provided by the elder or primary caretaker.
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
              <label htmlFor="code" className="block text-lg font-bold text-slate-900">
                8-Character Household Code
              </label>
              <span id="code-hint" className="block text-sm text-slate-600 mb-1">
                Found on the elder&apos;s dashboard or invitation
              </span>
              <input
                id="code"
                type="text"
                maxLength={8}
                aria-describedby="code-hint"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7X8K2M9P"
                className="mt-1 block min-h-[52px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-2xl font-black uppercase tracking-widest text-blue-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-lg font-bold text-slate-900">
                Your Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rahul Sharma"
                className="mt-1 block min-h-[52px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-lg font-bold text-slate-900">
                Your Email Address
              </label>
              <span id="email-hint" className="block text-sm text-slate-600 mb-1">
                Used to log in and receive notifications
              </span>
              <input
                id="email"
                type="email"
                aria-describedby="email-hint"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahul@example.com"
                className="mt-1 block min-h-[52px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
              />
            </div>

            <fieldset>
              <legend className="text-lg font-bold text-slate-900">Your Role in Care</legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-xl border-2 p-3 text-center font-bold transition-colors ${
                    role === 'elder'
                      ? 'border-blue-900 bg-blue-50 text-blue-950 ring-2 ring-blue-600'
                      : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="elder"
                    checked={role === 'elder'}
                    onChange={() => setRole('elder')}
                    className="sr-only"
                  />
                  <span>Elder</span>
                </label>

                <label
                  className={`flex cursor-pointer items-center justify-center rounded-xl border-2 p-3 text-center font-bold transition-colors ${
                    role === 'caretaker'
                      ? 'border-blue-900 bg-blue-50 text-blue-950 ring-2 ring-blue-600'
                      : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="caretaker"
                    checked={role === 'caretaker'}
                    onChange={() => setRole('caretaker')}
                    className="sr-only"
                  />
                  <span>Caretaker</span>
                </label>

                <label
                  className={`flex cursor-pointer items-center justify-center rounded-xl border-2 p-3 text-center font-bold transition-colors ${
                    role === 'family'
                      ? 'border-blue-900 bg-blue-50 text-blue-950 ring-2 ring-blue-600'
                      : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="family"
                    checked={role === 'family'}
                    onChange={() => setRole('family')}
                    className="sr-only"
                  />
                  <span>Family</span>
                </label>
              </div>
            </fieldset>

            <div>
              <label htmlFor="pin" className="block text-lg font-bold text-slate-900">
                Your Personal PIN (4 to 6 digits)
              </label>
              <span id="pin-hint" className="block text-sm text-slate-600 mb-1">
                Your private passcode for accessing this household
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
              {loading ? 'Joining Household...' : 'Join Household & Sign In'}
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

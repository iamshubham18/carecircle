'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionData } from '@/lib/types';

export default function ElderPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [householdCode, setHouseholdCode] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/join');
          return;
        }
        const data = await res.json();
        setSession(data.user);
        if (data.household) {
          setHouseholdCode(data.household.code);
        }
      } catch (_e) {
        router.push('/join');
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (loading) {
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center p-6 text-2xl font-bold text-slate-900">
        Loading your care space...
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-950">
      <header className="border-b-4 border-slate-400 bg-white px-6 py-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="text-3xl font-black text-blue-950">CareCircle</span>
          <button
            onClick={handleLogout}
            className="min-h-[52px] rounded-xl border-3 border-slate-600 bg-white px-6 py-2 text-xl font-bold text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <div className="rounded-3xl border-4 border-blue-900 bg-white p-8 shadow-lg sm:p-12">
          <h1 className="text-4xl font-black text-slate-950 sm:text-5xl">
            Hello, {session?.name}!
          </h1>
          <p className="mt-4 text-2xl font-semibold text-slate-800">
            You are the owner of this care circle.
          </p>

          <div className="mt-8 rounded-2xl border-3 border-blue-800 bg-blue-50 p-6 text-center">
            <span className="block text-xl font-bold uppercase tracking-wider text-blue-900">
              Your Household Invite Code
            </span>
            <span className="mt-2 block text-4xl font-black tracking-widest text-blue-950 sm:text-5xl">
              {householdCode || '--------'}
            </span>
            <span className="mt-2 block text-lg font-medium text-slate-700">
              Share this code with your caretakers and family members so they can connect with you.
            </span>
          </div>

          <div className="mt-10 rounded-2xl border-2 border-slate-300 bg-slate-50 p-6">
            <h2 className="text-2xl font-bold text-slate-900">Today&apos;s Medications &amp; Schedule</h2>
            <p className="mt-2 text-xl text-slate-700">
              One-tap dose logging will be ready here in Phase 2.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

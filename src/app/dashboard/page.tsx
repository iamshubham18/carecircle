'use client';

import React, { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';
import type { SessionData } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [householdCode, setHouseholdCode] = useState<string>('');
  const [householdName, setHouseholdName] = useState<string>('');
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
          setHouseholdName(data.household.name);
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
      <main id="main-content" className="flex min-h-screen items-center justify-center p-6 text-xl font-bold text-slate-800">
        Loading dashboard...
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b-2 border-slate-300 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-900 text-xl font-bold text-white">
              CC
            </span>
            <span className="text-2xl font-black text-slate-950">CareCircle</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-base font-semibold text-slate-700">
              Role: <strong className="capitalize text-blue-900">{session?.role}</strong>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border-2 border-slate-400 bg-white px-4 py-2 text-base font-bold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-500"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-950">{householdName || 'Care Household'}</h1>
              <p className="mt-1 text-lg text-slate-700">
                Welcome back, <strong>{session?.name}</strong>
              </p>
            </div>
            <div className="rounded-xl border-2 border-blue-900 bg-blue-50 p-4 text-center">
              <span className="block text-sm font-bold uppercase tracking-wider text-blue-900">
                Household Code
              </span>
              <span className="text-2xl font-black tracking-widest text-blue-950">
                {householdCode || '--------'}
              </span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-6">
              <h2 className="text-xl font-bold text-slate-900">Medications</h2>
              <p className="mt-2 text-base text-slate-600">Phase 2: Manage schedules and track daily doses.</p>
            </div>
            <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-6">
              <h2 className="text-xl font-bold text-slate-900">Appointments</h2>
              <p className="mt-2 text-base text-slate-600">Phase 2: Upcoming clinic visits and doctor notes.</p>
            </div>
            <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-6">
              <h2 className="text-xl font-bold text-slate-900">Adherence Summary</h2>
              <p className="mt-2 text-base text-slate-600">Phase 2: 7-day and 30-day adherence tracking.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

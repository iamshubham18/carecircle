'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Appointment, SessionData } from '@/lib/types';
import type { AdherenceSummary } from '@/lib/adherence';

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [householdCode, setHouseholdCode] = useState<string>('');
  const [householdName, setHouseholdName] = useState<string>('');
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          router.push('/join');
          return;
        }
        const meData = await meRes.json();
        setSession(meData.user);
        if (meData.household) {
          setHouseholdCode(meData.household.code);
          setHouseholdName(meData.household.name);
        }

        // Fetch adherence summary
        const adhRes = await fetch('/api/adherence');
        if (adhRes.ok) {
          const adhData = await adhRes.json();
          setAdherence(adhData.summary);
        }

        // Fetch upcoming appointments
        const apptRes = await fetch('/api/appointments');
        if (apptRes.ok) {
          const apptData = await apptRes.json();
          const upcoming = (apptData.appointments || []).filter(
            (a: Appointment) => new Date(a.datetime).getTime() >= Date.now()
          );
          if (upcoming.length > 0) {
            setNextAppointment(upcoming[0]);
          }
        }
      } catch (_e) {
        router.push('/join');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (loading) {
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center p-6 text-2xl font-bold text-slate-800">
        ⏳ Loading household dashboard...
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      {/* Top Header */}
      <header className="border-b-2 border-slate-300 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-900 text-2xl font-black text-white shadow-sm">
              CC
            </span>
            <span className="text-2xl font-black text-slate-950">CareCircle</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-sm font-extrabold uppercase tracking-wider text-blue-950">
              Role: {session?.role}
            </span>
            <button
              onClick={handleLogout}
              className="min-h-[48px] rounded-xl border-2 border-slate-400 bg-white px-4 py-2 text-base font-bold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-500"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {/* Welcome & Household Banner */}
        <div className="rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-950">
                {householdName || 'Care Household'}
              </h1>
              <p className="mt-1 text-xl font-medium text-slate-700">
                Welcome back, <strong className="text-blue-950 font-bold">{session?.name}</strong>
              </p>
            </div>

            <div className="rounded-xl border-2 border-blue-900 bg-blue-50 p-4 text-center">
              <span className="block text-xs font-bold uppercase tracking-wider text-blue-900">
                Household Invite Code
              </span>
              <span className="text-2xl font-black tracking-widest text-blue-950">
                {householdCode || '--------'}
              </span>
            </div>
          </div>
        </div>

        {/* Highlight Metrics: Adherence & Next Appointment */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Adherence Card */}
          <div className="flex flex-col justify-between rounded-2xl border-3 border-blue-900 bg-white p-6 shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold uppercase tracking-wide text-blue-900">
                  Medication Adherence
                </span>
                <span className="text-2xl" aria-hidden="true">📈</span>
              </div>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-5xl font-black text-slate-950">
                  {adherence !== null ? `${adherence.today}%` : '100%'}
                </span>
                <span className="text-lg font-bold text-slate-700">Today</span>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-base font-bold text-slate-700">
                <span>7-Day Average:</span>
                <span className="text-xl font-black text-blue-950">
                  {adherence !== null ? `${adherence.sevenDay}%` : '100%'}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-base font-bold text-slate-700">
                <span>30-Day Average:</span>
                <span className="text-xl font-black text-blue-950">
                  {adherence !== null ? `${adherence.thirtyDay}%` : '100%'}
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <Link
                href="/elder"
                className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-blue-900 px-6 py-3 text-lg font-bold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600"
              >
                Go to Today&apos;s Doses &rarr;
              </Link>
            </div>
          </div>

          {/* Next Appointment Card */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold uppercase tracking-wide text-slate-700">
                  Next Appointment
                </span>
                <span className="text-2xl" aria-hidden="true">🩺</span>
              </div>

              {nextAppointment ? (
                <div className="mt-4">
                  <span className="inline-block rounded-lg bg-blue-100 border border-blue-300 px-3 py-1 text-base font-bold text-blue-950">
                    🗓️ {new Date(nextAppointment.datetime).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  <h2 className="mt-3 text-2xl font-black text-slate-950">
                    {nextAppointment.doctor}
                  </h2>
                  <p className="mt-1 text-lg font-semibold text-slate-700">
                    📍 {nextAppointment.location}
                  </p>
                  {nextAppointment.notes && (
                    <p className="mt-2 text-base italic text-slate-600">
                      Note: {nextAppointment.notes}
                    </p>
                  )}
                </div>
              ) : (
                <div className="my-8 text-center">
                  <span className="text-3xl" aria-hidden="true">📅</span>
                  <p className="mt-2 text-xl font-bold text-slate-800">No upcoming appointments</p>
                  <p className="mt-1 text-base text-slate-600">
                    Checkups and clinic visits will appear here when scheduled.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <Link
                href="/appointments"
                className="flex min-h-[52px] w-full items-center justify-center rounded-xl border-2 border-blue-900 bg-white px-6 py-3 text-lg font-bold text-blue-900 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-600"
              >
                Manage All Appointments
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Nav Cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/medications"
            className="group rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm transition-all hover:border-blue-900 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl" aria-hidden="true">💊</span>
              <span className="text-xl font-bold text-blue-900 group-hover:translate-x-1 transition-transform">
                &rarr;
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">Medications List</h2>
            <p className="mt-1 text-base font-medium text-slate-600">
              Review medications, dosage rules, and active schedules.
            </p>
          </Link>

          <Link
            href="/elder"
            className="group rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm transition-all hover:border-blue-900 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl" aria-hidden="true">👴</span>
              <span className="text-xl font-bold text-blue-900 group-hover:translate-x-1 transition-transform">
                &rarr;
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">Elder Simple View</h2>
            <p className="mt-1 text-base font-medium text-slate-600">
              High-contrast, large-button view designed specifically for quick one-tap dose logging.
            </p>
          </Link>

          <Link
            href="/activity"
            className="group rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm transition-all hover:border-blue-900 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl" aria-hidden="true">📋</span>
              <span className="text-xl font-bold text-blue-900 group-hover:translate-x-1 transition-transform">
                &rarr;
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">Activity Log</h2>
            <p className="mt-1 text-base font-medium text-slate-600">
              See who added medications, took doses, and made changes.
            </p>
          </Link>

          {session?.role === 'elder' && (
            <Link
              href="/settings/permissions"
              className="group rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm transition-all hover:border-blue-900 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl" aria-hidden="true">🔐</span>
                <span className="text-xl font-bold text-blue-900 group-hover:translate-x-1 transition-transform">
                  &rarr;
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-black text-slate-950">Permission Settings</h2>
              <p className="mt-1 text-base font-medium text-slate-600">
                Control what caretakers and family members can see and do.
              </p>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

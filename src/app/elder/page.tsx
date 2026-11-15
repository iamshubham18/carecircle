'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatUtcToLocalTime, getLocalDateString } from '@/lib/schedule';
import type { DoseLog, SessionData } from '@/lib/types';

interface EnrichedDose extends DoseLog {
  medicationName: string;
  medicationDose: string;
  medicationNotes?: string;
}

export default function ElderTodayPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [doses, setDoses] = useState<EnrichedDose[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [updatingDoseId, setUpdatingDoseId] = useState<string | null>(null);

  const todayStr = getLocalDateString(new Date());

  const fetchDoses = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/doses?date=${todayStr}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/join');
          return;
        }
        throw new Error('Failed to load doses');
      }
      const data = await res.json();
      setDoses(data.doses || []);
    } catch (_err) {
      setError('Unable to load your doses for today. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [todayStr, router]);

  useEffect(() => {
    async function init() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          router.push('/join');
          return;
        }
        const meData = await meRes.json();
        setSession(meData.user);
        await fetchDoses();
      } catch (_e) {
        router.push('/join');
      }
    }
    init();
  }, [fetchDoses, router]);

  const handleTakeDose = async (doseId: string, medName: string) => {
    setUpdatingDoseId(doseId);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/doses/${doseId}/take`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to mark dose as taken');
      }

      // Update state locally
      setDoses((prev) =>
        prev.map((d) =>
          d.id === doseId
            ? { ...d, status: 'taken', takenAt: new Date().toISOString() }
            : d
        )
      );

      setActionMessage(`Great job! You marked ${medName} as taken.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error recording dose';
      setActionMessage(`Notice: ${msg}`);
    } finally {
      setUpdatingDoseId(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-950">
      {/* Header */}
      <header className="border-b-4 border-slate-300 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-900 text-2xl font-black text-white">
              CC
            </span>
            <div>
              <span className="block text-2xl font-black text-slate-950 sm:text-3xl">CareCircle</span>
              <span className="text-base font-bold text-slate-700">Elder View</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/activity"
              className="min-h-[48px] inline-flex items-center rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2 text-base font-bold text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              📋 Activity
            </Link>
            {session?.role === 'elder' && (
              <Link
                href="/settings/permissions"
                className="min-h-[48px] inline-flex items-center rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2 text-base font-bold text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
              >
                🔐 Settings
              </Link>
            )}
            <Link
              href="/dashboard"
              className="min-h-[48px] inline-flex items-center rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2 text-base font-bold text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="min-h-[48px] rounded-xl border-2 border-slate-400 bg-white px-4 py-2 text-base font-bold text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
        <div className="rounded-3xl border-4 border-slate-300 bg-white p-6 shadow-md sm:p-10">
          {/* Elder Greeting */}
          <div className="border-b-2 border-slate-200 pb-6">
            <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">
              Today&apos;s Medications
            </h1>
            <p className="mt-2 text-xl font-semibold text-slate-700">
              Welcome, <span className="text-blue-950 font-black">{session?.name || 'Elder'}</span>! Here is your plan for today ({todayStr}).
            </p>
          </div>

          {/* Accessible Live Feedback Banner */}
          {actionMessage && (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 rounded-2xl border-3 border-green-800 bg-green-50 p-5 text-xl font-bold text-green-950"
            >
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="text-3xl">✅</span>
                <span>{actionMessage}</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-6 rounded-2xl border-3 border-red-700 bg-red-50 p-5 text-xl font-bold text-red-950"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="text-3xl">⚠️</span>
                  <span>{error}</span>
                </div>
                <button
                  onClick={fetchDoses}
                  className="min-h-[48px] rounded-xl bg-red-900 px-5 py-2 text-lg font-bold text-white hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-600"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="py-16 text-center">
              <span className="text-2xl font-bold text-slate-800">
                ⏳ Loading today&apos;s medication schedule...
              </span>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && doses.length === 0 && (
            <div className="my-10 rounded-2xl border-2 border-dashed border-slate-400 bg-slate-50 p-8 text-center">
              <span className="text-4xl" aria-hidden="true">🎉</span>
              <h2 className="mt-4 text-2xl font-bold text-slate-900">No doses scheduled for today!</h2>
              <p className="mt-2 text-lg text-slate-700">
                You have no scheduled doses today. Medications can be added on the medications page.
              </p>
              <div className="mt-6">
                <Link
                  href="/medications"
                  className="inline-flex min-h-[52px] items-center rounded-xl bg-blue-900 px-6 py-3 text-lg font-bold text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600"
                >
                  View Medication List
                </Link>
              </div>
            </div>
          )}

          {/* Doses List */}
          {!loading && doses.length > 0 && (
            <div className="mt-8 flex flex-col gap-6" aria-label="Today's Dose Schedule">
              {doses.map((dose) => {
                const isTaken = dose.status === 'taken';
                const isMissed = dose.status === 'missed';
                const isPending = dose.status === 'pending';
                const localTime = formatUtcToLocalTime(dose.scheduledAt);
                const isUpdating = updatingDoseId === dose.id;

                return (
                  <div
                    key={dose.id}
                    className={`rounded-2xl border-3 p-6 transition-colors ${
                      isTaken
                        ? 'border-green-600 bg-green-50/60'
                        : isMissed
                        ? 'border-amber-600 bg-amber-50/60'
                        : 'border-blue-900 bg-white'
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {/* Dose Information */}
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-lg bg-slate-900 px-3 py-1 text-xl font-black text-white">
                            {localTime}
                          </span>
                          <span className="text-2xl font-extrabold text-slate-950">
                            {dose.medicationName}
                          </span>
                        </div>

                        <p className="mt-2 text-xl font-bold text-slate-800">
                          Dose: <span className="text-blue-950 font-black">{dose.medicationDose}</span>
                        </p>

                        {dose.medicationNotes && (
                          <p className="mt-1 text-lg font-medium text-slate-600">
                            Note: {dose.medicationNotes}
                          </p>
                        )}

                        {/* Status Label (Text + Icon) */}
                        <div className="mt-3 flex items-center gap-2">
                          {isTaken && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-green-700 bg-green-100 px-3 py-1 text-base font-extrabold text-green-900">
                              <span aria-hidden="true">✅</span>
                              <span>Status: Taken</span>
                            </span>
                          )}
                          {isMissed && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-amber-700 bg-amber-100 px-3 py-1 text-base font-extrabold text-amber-950">
                              <span aria-hidden="true">⚠️</span>
                              <span>Status: Missed (Grace period passed)</span>
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-blue-700 bg-blue-100 px-3 py-1 text-base font-extrabold text-blue-950">
                              <span aria-hidden="true">⏳</span>
                              <span>Status: Due / Pending</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* One-Tap Action Button */}
                      <div>
                        {isTaken ? (
                          <div className="rounded-xl border-2 border-green-600 bg-white px-5 py-3 text-center text-lg font-black text-green-900">
                            ✓ Completed
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleTakeDose(dose.id, dose.medicationName)}
                            className="flex min-h-[64px] w-full items-center justify-center rounded-2xl bg-blue-900 px-8 py-4 text-2xl font-black text-white shadow-md transition-all hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
                          >
                            {isUpdating ? 'Saving...' : '✓ I took it'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

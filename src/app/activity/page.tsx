'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatUtcToLocalDateTime } from '@/lib/schedule';
import type { Role, EnrichedAuditEntry } from '@/lib/types';

export default function ActivityPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('family');
  const [auditLogs, setAuditLogs] = useState<EnrichedAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/audit?limit=60');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/join');
          return;
        }
        throw new Error('Failed to load activity log');
      }
      const data = await res.json();
      setAuditLogs(data.auditLogs || []);
    } catch (_err) {
      setError('Unable to load the activity log. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    async function init() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          router.push('/join');
          return;
        }
        const meData = await meRes.json();
        setRole(meData.user.role);
        await fetchAuditLogs();
      } catch (_e) {
        router.push('/join');
      }
    }
    init();
  }, [fetchAuditLogs, router]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      {/* Header */}
      <header className="border-b-2 border-slate-300 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/dashboard"
            className="text-2xl font-black text-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-600 rounded"
          >
            CareCircle
          </Link>
          <div className="flex items-center gap-3">
            {role === 'elder' && (
              <Link
                href="/settings/permissions"
                className="min-h-[48px] inline-flex items-center rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2 text-base font-bold text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
              >
                🔐 Permissions
              </Link>
            )}
            <Link
              href="/dashboard"
              className="min-h-[48px] inline-flex items-center rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2 text-base font-bold text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {/* Page Title */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-950">📋 Activity Log</h1>
            <p className="mt-1 text-lg text-slate-700">
              A record of everything that happened in your household, newest first.
            </p>
          </div>
          <button
            onClick={fetchAuditLogs}
            className="min-h-[48px] rounded-xl border-2 border-slate-400 bg-white px-5 py-2 text-base font-bold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-600"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-6 flex items-center justify-between gap-4 rounded-2xl border-2 border-red-700 bg-red-50 p-5 text-lg font-bold text-red-950"
          >
            <span>⚠️ {error}</span>
            <button
              onClick={fetchAuditLogs}
              className="min-h-[48px] rounded-xl bg-red-900 px-5 py-2 text-base font-bold text-white hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-500"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border-2 border-slate-200 bg-white p-10 text-center text-xl font-bold text-slate-600"
          >
            ⏳ Loading activity...
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && auditLogs.length === 0 && (
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-12 text-center">
            <span className="text-5xl" aria-hidden="true">📋</span>
            <p className="mt-4 text-2xl font-black text-slate-800">No activity yet</p>
            <p className="mt-2 text-lg text-slate-600">
              Actions like adding medications, taking doses, and scheduling appointments will appear
              here.
            </p>
          </div>
        )}

        {/* Activity Timeline */}
        {!loading && auditLogs.length > 0 && (
          <ol aria-label="Activity log" className="space-y-3">
            {auditLogs.map((entry) => (
              <li
                key={entry.id}
                className="flex gap-4 rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm"
              >
                {/* Icon */}
                <span
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl"
                  aria-hidden="true"
                >
                  {entry.icon}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Summary line */}
                  <p className="text-lg font-bold text-slate-950 leading-snug">
                    {entry.summary}
                  </p>

                  {/* Actor badge */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-0.5 text-sm font-extrabold text-blue-950">
                      {entry.actorName}
                    </span>
                    <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-0.5 text-sm font-bold uppercase tracking-wide text-slate-700">
                      {entry.actorRole}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    <time dateTime={entry.at}>
                      {formatUtcToLocalDateTime(entry.at)}
                    </time>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}

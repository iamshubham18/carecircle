'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { can } from '@/lib/permissions';
import { getLocalDateString } from '@/lib/schedule';
import type { Medication, PermissionsMatrix, Role } from '@/lib/types';

export default function MedicationsPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role>('family');
  const [permissions, setPermissions] = useState<PermissionsMatrix | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [times, setTimes] = useState('08:00, 20:00');
  const [startDate, setStartDate] = useState(getLocalDateString(new Date()));
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canEdit = permissions ? can(role, 'editMeds', permissions) : false;

  const fetchMedications = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/medications');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/join');
          return;
        }
        throw new Error('Failed to load medications');
      }
      const data = await res.json();
      setMedications(data.medications || []);
    } catch (_err) {
      setError('Unable to load medications. Please try again.');
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
        setPermissions(meData.permissions);
        await fetchMedications();
      } catch (_e) {
        router.push('/join');
      }
    }
    init();
  }, [fetchMedications, router]);

  const resetForm = () => {
    setName('');
    setDose('');
    setTimes('08:00, 20:00');
    setStartDate(getLocalDateString(new Date()));
    setEndDate('');
    setNotes('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (med: Medication) => {
    setEditingId(med.id);
    setName(med.name);
    setDose(med.dose);
    setTimes(med.times.join(', '));
    setStartDate(med.startDate);
    setEndDate(med.endDate || '');
    setNotes(med.notes || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setError(null);
    setFeedback(null);

    const parsedTimes = times
      .split(',')
      .map((t) => t.trim())
      .filter((t) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(t));

    if (parsedTimes.length === 0) {
      setError('Please provide at least one valid time in HH:mm format (e.g. 08:00, 20:00).');
      return;
    }

    setSubmitting(true);

    try {
      if (editingId) {
        // Edit existing medication
        const res = await fetch(`/api/medications/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            dose: dose.trim(),
            times: parsedTimes,
            startDate,
            endDate: endDate.trim() || null,
            notes: notes.trim() || null,
          }),
        });

        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error || 'Failed to update medication');
        }

        setFeedback(`Updated ${name} successfully.`);
      } else {
        // Add new medication
        const res = await fetch('/api/medications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            dose: dose.trim(),
            times: parsedTimes,
            startDate,
            endDate: endDate.trim() || undefined,
            notes: notes.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error || 'Failed to add medication');
        }

        setFeedback(`Added ${name} with daily dose schedule.`);
      }

      resetForm();
      await fetchMedications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving medication');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, medName: string) => {
    if (!canEdit) return;
    if (!confirm(`Are you sure you want to deactivate ${medName}?`)) return;

    try {
      const res = await fetch(`/api/medications/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete medication');
      setFeedback(`Deactivated ${medName}.`);
      await fetchMedications();
    } catch (_err) {
      setError('Failed to deactivate medication.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <header className="border-b-2 border-slate-300 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-black text-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-600 rounded">
            CareCircle
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="min-h-[48px] inline-flex items-center rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2 text-base font-bold text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              Dashboard
            </Link>
            <Link
              href="/appointments"
              className="min-h-[48px] inline-flex items-center rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2 text-base font-bold text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              Appointments
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950">Medication Management</h1>
            <p className="mt-1 text-lg text-slate-700">
              Active medications and daily dosage timings for this household.
            </p>
          </div>

          {canEdit ? (
            <button
              onClick={handleOpenAdd}
              className="flex min-h-[52px] items-center justify-center rounded-xl bg-blue-900 px-6 py-3 text-lg font-bold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              + Add Medication
            </button>
          ) : (
            <span className="rounded-xl border-2 border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
              View-Only Role ({role})
            </span>
          )}
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 rounded-xl border-2 border-green-700 bg-green-50 p-4 text-lg font-bold text-green-950"
          >
            ✅ {feedback}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-6 rounded-xl border-2 border-red-700 bg-red-50 p-4 text-lg font-bold text-red-950"
          >
            ⚠️ {error}
          </div>
        )}

        {/* Add / Edit Form Modal */}
        {showForm && (
          <section
            aria-label={editingId ? 'Edit Medication' : 'Add Medication'}
            className="mt-8 rounded-2xl border-3 border-blue-900 bg-white p-6 shadow-md sm:p-8"
          >
            <h2 className="text-2xl font-bold text-slate-950">
              {editingId ? 'Edit Medication' : 'Add New Medication'}
            </h2>
            <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="medName" className="block text-lg font-bold text-slate-900">
                  Medication Name *
                </label>
                <input
                  id="medName"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Metformin"
                  className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="medDose" className="block text-lg font-bold text-slate-900">
                  Dose / Strength *
                </label>
                <input
                  id="medDose"
                  type="text"
                  required
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder="e.g. 500mg tablet"
                  className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="medTimes" className="block text-lg font-bold text-slate-900">
                  Daily Times (HH:mm, comma-separated) *
                </label>
                <span id="times-hint" className="block text-xs text-slate-600">
                  e.g. 08:00, 14:00, 20:00 (24-hour format)
                </span>
                <input
                  id="medTimes"
                  type="text"
                  aria-describedby="times-hint"
                  required
                  value={times}
                  onChange={(e) => setTimes(e.target.value)}
                  placeholder="08:00, 20:00"
                  className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="startDate" className="block text-lg font-bold text-slate-900">
                  Start Date *
                </label>
                <input
                  id="startDate"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="endDate" className="block text-lg font-bold text-slate-900">
                  End Date (Optional)
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-lg font-bold text-slate-900">
                  Instructions / Notes (Optional)
                </label>
                <input
                  id="notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Take with warm water after meals"
                  className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
                />
              </div>

              <div className="flex gap-4 sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[52px] rounded-xl bg-blue-900 px-6 py-3 text-lg font-bold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600 disabled:bg-slate-400"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Medication' : 'Save & Generate Schedule'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="min-h-[52px] rounded-xl border-2 border-slate-400 bg-slate-100 px-6 py-3 text-lg font-bold text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center text-xl font-bold text-slate-800">
            ⏳ Loading medications...
          </div>
        )}

        {/* Empty State */}
        {!loading && medications.length === 0 && (
          <div className="my-10 rounded-2xl border-2 border-dashed border-slate-400 bg-white p-12 text-center shadow-sm">
            <span className="text-4xl" aria-hidden="true">💊</span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">No active medications added yet</h2>
            <p className="mt-2 text-lg text-slate-700">
              {canEdit
                ? 'Add your first medication to automatically generate daily schedule slots.'
                : 'No medications currently listed for this household.'}
            </p>
            {canEdit && (
              <button
                onClick={handleOpenAdd}
                className="mt-6 inline-flex min-h-[52px] items-center rounded-xl bg-blue-900 px-6 py-3 text-lg font-bold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600"
              >
                + Add First Medication
              </button>
            )}
          </div>
        )}

        {/* Medication Cards List */}
        {!loading && medications.length > 0 && (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2" aria-label="Medication List">
            {medications.map((med) => (
              <div
                key={med.id}
                className="flex flex-col justify-between rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-slate-950">{med.name}</h2>
                      <p className="text-lg font-bold text-blue-950">Dose: {med.dose}</p>
                    </div>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-black text-green-900 border border-green-300">
                      Active
                    </span>
                  </div>

                  <div className="mt-4">
                    <span className="block text-sm font-bold uppercase tracking-wider text-slate-600">
                      Daily Schedule Times
                    </span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {med.times.map((t) => (
                        <span
                          key={t}
                          className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-base font-bold text-blue-950"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="mt-3 text-base text-slate-700">
                    <strong>Start:</strong> {med.startDate} {med.endDate ? `• End: ${med.endDate}` : ''}
                  </p>

                  {med.notes && (
                    <p className="mt-2 text-base italic text-slate-600">
                      &ldquo;{med.notes}&rdquo;
                    </p>
                  )}
                </div>

                {canEdit && (
                  <div className="mt-6 flex items-center gap-3 border-t border-slate-200 pt-4">
                    <button
                      onClick={() => handleOpenEdit(med)}
                      className="min-h-[48px] flex-1 rounded-xl border-2 border-blue-900 bg-white py-2 text-base font-bold text-blue-900 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(med.id, med.name)}
                      className="min-h-[48px] flex-1 rounded-xl border-2 border-red-700 bg-white py-2 text-base font-bold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-600"
                    >
                      Deactivate
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

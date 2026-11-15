'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { can } from '@/lib/permissions';
import type { Appointment, PermissionsMatrix, Role } from '@/lib/types';

export default function AppointmentsPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role>('family');
  const [permissions, setPermissions] = useState<PermissionsMatrix | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [doctor, setDoctor] = useState('');
  const [datetime, setDatetime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canEdit = permissions ? can(role, 'editAppointments', permissions) : false;

  const fetchAppointments = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/appointments');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/join');
          return;
        }
        throw new Error('Failed to load appointments');
      }
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch (_err) {
      setError('Unable to load appointments. Please try again.');
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
        await fetchAppointments();
      } catch (_e) {
        router.push('/join');
      }
    }
    init();
  }, [fetchAppointments, router]);

  const resetForm = () => {
    setDoctor('');
    setDatetime('');
    setLocation('');
    setNotes('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (appt: Appointment) => {
    setEditingId(appt.id);
    setDoctor(appt.doctor);
    // Convert UTC ISO to local datetime-local format: YYYY-MM-DDTHH:mm
    const dateObj = new Date(appt.datetime);
    const localIso = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDatetime(localIso);
    setLocation(appt.location);
    setNotes(appt.notes || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setError(null);
    setFeedback(null);

    if (!doctor.trim() || !datetime || !location.trim()) {
      setError('Doctor, date & time, and location are required.');
      return;
    }

    setSubmitting(true);

    try {
      // Convert input datetime-local string to standard UTC ISO string
      const utcDatetime = new Date(datetime).toISOString();

      if (editingId) {
        const res = await fetch(`/api/appointments/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctor: doctor.trim(),
            datetime: utcDatetime,
            location: location.trim(),
            notes: notes.trim() || null,
          }),
        });

        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error || 'Failed to update appointment');
        }

        setFeedback(`Updated appointment with ${doctor}.`);
      } else {
        const res = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctor: doctor.trim(),
            datetime: utcDatetime,
            location: location.trim(),
            notes: notes.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error || 'Failed to schedule appointment');
        }

        setFeedback(`Scheduled appointment with ${doctor}.`);
      }

      resetForm();
      await fetchAppointments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, docName: string) => {
    if (!canEdit) return;
    if (!confirm(`Are you sure you want to cancel the appointment with ${docName}?`)) return;

    try {
      const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to cancel appointment');
      setFeedback(`Cancelled appointment with ${docName}.`);
      await fetchAppointments();
    } catch (_err) {
      setError('Failed to cancel appointment.');
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
              href="/medications"
              className="min-h-[48px] inline-flex items-center rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2 text-base font-bold text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              Medications
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950">Doctor Appointments</h1>
            <p className="mt-1 text-lg text-slate-700">
              Upcoming clinical checkups, consultations, and doctor visits.
            </p>
          </div>

          {canEdit ? (
            <button
              onClick={handleOpenAdd}
              className="flex min-h-[52px] items-center justify-center rounded-xl bg-blue-900 px-6 py-3 text-lg font-bold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              + Schedule Appointment
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

        {/* Schedule/Edit Form */}
        {showForm && (
          <section
            aria-label={editingId ? 'Edit Appointment' : 'Schedule Appointment'}
            className="mt-8 rounded-2xl border-3 border-blue-900 bg-white p-6 shadow-md sm:p-8"
          >
            <h2 className="text-2xl font-bold text-slate-950">
              {editingId ? 'Edit Appointment' : 'Schedule New Appointment'}
            </h2>
            <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="doctorName" className="block text-lg font-bold text-slate-900">
                  Doctor / Specialist Name *
                </label>
                <input
                  id="doctorName"
                  type="text"
                  required
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                  placeholder="e.g. Dr. Ramesh Gupta (Cardiologist)"
                  className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="apptDatetime" className="block text-lg font-bold text-slate-900">
                  Date and Time *
                </label>
                <input
                  id="apptDatetime"
                  type="datetime-local"
                  required
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-lg font-bold text-slate-900">
                  Location / Hospital *
                </label>
                <input
                  id="location"
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Apollo Hospital, Room 204"
                  className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="apptNotes" className="block text-lg font-bold text-slate-900">
                  Notes / Symptoms to Discuss (Optional)
                </label>
                <input
                  id="apptNotes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bring recent blood sugar logs and ECG"
                  className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 text-lg font-medium text-slate-950 focus:border-blue-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
                />
              </div>

              <div className="flex gap-4 sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[52px] rounded-xl bg-blue-900 px-6 py-3 text-lg font-bold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600 disabled:bg-slate-400"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Appointment' : 'Save Appointment'}
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
            ⏳ Loading appointments...
          </div>
        )}

        {/* Empty State */}
        {!loading && appointments.length === 0 && (
          <div className="my-10 rounded-2xl border-2 border-dashed border-slate-400 bg-white p-12 text-center shadow-sm">
            <span className="text-4xl" aria-hidden="true">📅</span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">No upcoming appointments scheduled</h2>
            <p className="mt-2 text-lg text-slate-700">
              Keep track of doctor consultations, prescription renewals, and regular checkups.
            </p>
            {canEdit && (
              <button
                onClick={handleOpenAdd}
                className="mt-6 inline-flex min-h-[52px] items-center rounded-xl bg-blue-900 px-6 py-3 text-lg font-bold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600"
              >
                + Schedule First Appointment
              </button>
            )}
          </div>
        )}

        {/* Appointments List */}
        {!loading && appointments.length > 0 && (
          <div className="mt-8 flex flex-col gap-4" aria-label="Upcoming Appointments">
            {appointments.map((appt) => {
              const formattedDate = new Date(appt.datetime).toLocaleString('en-IN', {
                dateStyle: 'full',
                timeStyle: 'short',
              });

              return (
                <div
                  key={appt.id}
                  className="flex flex-col justify-between rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-blue-100 border border-blue-300 px-3 py-1 text-base font-extrabold text-blue-950">
                        🗓️ {formattedDate}
                      </span>
                    </div>

                    <h2 className="mt-2 text-2xl font-black text-slate-950">{appt.doctor}</h2>

                    <p className="mt-1 text-lg font-semibold text-slate-700">
                      📍 <strong>Location:</strong> {appt.location}
                    </p>

                    {appt.notes && (
                      <p className="mt-1 text-base italic text-slate-600">
                        Notes: {appt.notes}
                      </p>
                    )}
                  </div>

                  {canEdit && (
                    <div className="mt-4 flex items-center gap-3 sm:mt-0">
                      <button
                        onClick={() => handleOpenEdit(appt)}
                        className="min-h-[48px] rounded-xl border-2 border-blue-900 bg-white px-5 py-2 text-base font-bold text-blue-900 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(appt.id, appt.doctor)}
                        className="min-h-[48px] rounded-xl border-2 border-red-700 bg-white px-5 py-2 text-base font-bold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

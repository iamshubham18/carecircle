'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { can } from '@/lib/permissions';
import { getLocalDateString } from '@/lib/schedule';
import type { Medication, PermissionsMatrix, Role } from '@/lib/types';
import type { DraftMedication } from '@/lib/gemini';

interface EditableDraftItem extends DraftMedication {
  tempId: string;
  startDate: string;
  timesInput: string;
}

export default function MedicationsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [role, setRole] = useState<Role>('family');
  const [permissions, setPermissions] = useState<PermissionsMatrix | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Manual Add/Edit Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [times, setTimes] = useState('08:00, 20:00');
  const [startDate, setStartDate] = useState(getLocalDateString(new Date()));
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Gemini Scan & Draft state
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanDrafts, setScanDrafts] = useState<EditableDraftItem[]>([]);
  const [scanFallbackNotice, setScanFallbackNotice] = useState<string | null>(null);
  const [savingDrafts, setSavingDrafts] = useState(false);

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
    setShowScanDialog(false);
    setScanDrafts([]);
    setScanFallbackNotice(null);
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
    setShowScanDialog(false);
    setScanDrafts([]);
    setScanFallbackNotice(null);
  };

  // Shared scan engine: takes an image Blob/File and calls /api/ai/scan with a 30s client timeout
  const processImageForScan = async (blob: Blob, filename: string) => {
    setScanning(true);
    setError(null);
    setFeedback(null);
    setScanFallbackNotice(null);
    setShowForm(false);
    setShowScanDialog(false);

    // 30-second client-side timeout controller
    const clientController = new AbortController();
    const clientTimer = setTimeout(() => {
      clientController.abort();
    }, 30000);

    try {
      const formData = new FormData();
      formData.append('image', blob, filename);

      const res = await fetch('/api/ai/scan', {
        method: 'POST',
        body: formData,
        signal: clientController.signal,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || 'Prescription scan failed');
      }

      const extracted: DraftMedication[] = data.draft || [];

      if (extracted.length === 0) {
        setScanFallbackNotice(
          'No clear medications could be detected in this photo. Please try a clearer photo or enter your medications manually.'
        );
        setScanDrafts([]);
      } else {
        const todayStr = getLocalDateString(new Date());
        const draftItems: EditableDraftItem[] = extracted.map((item, idx) => ({
          ...item,
          tempId: `draft_${Date.now()}_${idx}`,
          startDate: todayStr,
          timesInput: item.times.length > 0 ? item.times.join(', ') : '08:00, 20:00',
        }));
        setScanDrafts(draftItems);
        setFeedback(`Successfully detected ${draftItems.length} medication draft(s). Please review below.`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setScanFallbackNotice(
          'The prescription scan timed out after 30 seconds. Please try again or enter your medications manually.'
        );
      } else {
        setScanFallbackNotice(
          'Unable to analyze the prescription photo. Please check your image or enter details manually.'
        );
      }
      setScanDrafts([]);
    } finally {
      clearTimeout(clientTimer);
      // Loading state is always guaranteed to be cleared
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // File chosen from user device camera or storage
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG, or WebP images are supported.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError('Photo exceeds maximum size of 4 MB. Please upload a smaller image.');
      return;
    }

    await processImageForScan(file, file.name);
  };

  // "Try with a sample prescription" handler
  const handleTrySample = async () => {
    try {
      setScanning(true);
      setShowScanDialog(false);
      setError(null);
      setFeedback('Loading sample prescription image...');

      const response = await fetch('/demo/sample-prescription.png');
      if (!response.ok) {
        throw new Error('Could not load sample prescription file');
      }

      const blob = await response.blob();
      await processImageForScan(blob, 'sample-prescription.png');
    } catch (_err) {
      setScanning(false);
      setScanFallbackNotice(
        'Unable to load the sample prescription. Please try again or enter details manually.'
      );
    }
  };

  // Trigger system file picker
  const handleTriggerFileInput = () => {
    setShowScanDialog(false);
    fileInputRef.current?.click();
  };

  // Draft editing helpers
  const handleUpdateDraftItem = (tempId: string, field: keyof EditableDraftItem, value: string) => {
    setScanDrafts((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveDraftItem = (tempId: string) => {
    setScanDrafts((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const handleAddEmptyDraftItem = () => {
    const todayStr = getLocalDateString(new Date());
    setScanDrafts((prev) => [
      ...prev,
      {
        tempId: `draft_${Date.now()}_${prev.length}`,
        name: '',
        dose: '',
        times: ['08:00'],
        timesInput: '08:00, 20:00',
        startDate: todayStr,
        notes: '',
      },
    ]);
  };

  // Explicit confirmation and batch save of drafts
  const handleConfirmAndSaveDrafts = async () => {
    if (scanDrafts.length === 0) return;

    for (const item of scanDrafts) {
      if (!item.name.trim()) {
        setError('Please enter a name for every medication in the draft.');
        return;
      }
    }

    setSavingDrafts(true);
    setError(null);

    let savedCount = 0;
    try {
      for (const item of scanDrafts) {
        const parsedTimes = item.timesInput
          .split(',')
          .map((t) => t.trim())
          .filter((t) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(t));

        const finalTimes = parsedTimes.length > 0 ? parsedTimes : ['08:00'];

        const res = await fetch('/api/medications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name.trim(),
            dose: item.dose.trim() || 'As prescribed',
            times: finalTimes,
            startDate: item.startDate || getLocalDateString(new Date()),
            notes: item.notes?.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error || `Failed to save ${item.name}`);
        }
        savedCount++;
      }

      setFeedback(`Confirmed and saved ${savedCount} medication(s) with daily schedules!`);
      setScanDrafts([]);
      await fetchMedications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving draft medications');
    } finally {
      setSavingDrafts(false);
    }
  };

  // Manual Add/Edit Form submit
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
      {/* Hidden File Input for Prescription Scanning */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        aria-hidden="true"
        onChange={handleFileSelect}
      />

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
              Active medications, dosage rules, and prescription scanning.
            </p>
          </div>

          {canEdit ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowScanDialog(true)}
                disabled={scanning}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-blue-900 bg-white px-5 py-3 text-lg font-bold text-blue-950 shadow-sm hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-600 disabled:bg-slate-200"
              >
                <span>📷</span>
                <span>{scanning ? 'Analyzing Photo...' : 'Scan Prescription'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex min-h-[52px] items-center justify-center rounded-xl bg-blue-900 px-6 py-3 text-lg font-bold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600"
              >
                + Add Manually
              </button>
            </div>
          ) : (
            <span className="rounded-xl border-2 border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
              View-Only Role ({role})
            </span>
          )}
        </div>

        {/* Live status & feedback banners */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 rounded-xl border-2 border-green-700 bg-green-50 p-4 text-lg font-bold text-green-950"
          >
            ✅ {feedback}
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-6 rounded-xl border-2 border-red-700 bg-red-50 p-4 text-lg font-bold text-red-950"
          >
            ⚠️ {error}
          </div>
        )}

        {/* Scanning Loading State */}
        {scanning && (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex items-center justify-center gap-3 rounded-2xl border-3 border-blue-800 bg-blue-50 p-6 text-xl font-black text-blue-950"
          >
            <span className="text-3xl animate-spin">⏳</span>
            <span>Scanning prescription with Gemini AI... Please hold on.</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SCAN PRESCRIPTION DIALOG / MODAL */}
        {/* ------------------------------------------------------------- */}
        {showScanDialog && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-dialog-title"
            className="mt-6 rounded-2xl border-3 border-blue-900 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 id="scan-dialog-title" className="text-2xl font-black text-slate-950">
                  Scan Prescription / Pill Strip
                </h2>
                <p className="mt-1 text-base font-medium text-slate-700">
                  Choose how you want to scan your medical prescription or pill packaging:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowScanDialog(false)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Close scan dialog"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleTriggerFileInput}
                className="flex min-h-[56px] flex-col items-center justify-center rounded-xl border-2 border-blue-900 bg-blue-50 p-4 text-center font-bold text-blue-950 shadow-sm hover:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-600"
              >
                <span className="text-2xl" aria-hidden="true">📸</span>
                <span className="mt-1 text-lg">Take Photo or Choose File</span>
                <span className="text-xs font-normal text-slate-600">JPEG, PNG, or WebP up to 4 MB</span>
              </button>

              <button
                type="button"
                onClick={handleTrySample}
                className="flex min-h-[56px] flex-col items-center justify-center rounded-xl border-2 border-emerald-800 bg-emerald-50 p-4 text-center font-bold text-emerald-950 shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-600"
              >
                <span className="text-2xl" aria-hidden="true">📄</span>
                <span className="mt-1 text-lg">Try with a sample prescription</span>
                <span className="text-xs font-normal text-emerald-800">Pre-loaded demo prescription PNG</span>
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScanDialog(false)}
                className="min-h-[48px] rounded-xl border border-slate-400 bg-slate-100 px-5 py-2 font-bold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Manual Fallback Alert */}
        {scanFallbackNotice && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-6 rounded-2xl border-3 border-amber-600 bg-amber-50 p-6 text-amber-950 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xl font-bold flex items-center gap-2">
                  <span aria-hidden="true" className="text-2xl">💡</span>
                  <span>Prescription Scan Notice</span>
                </p>
                <p className="mt-1 text-lg font-medium text-amber-900">
                  {scanFallbackNotice}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleTrySample}
                  className="min-h-[50px] rounded-xl border-2 border-amber-900 bg-white px-5 py-2.5 text-base font-bold text-amber-950 hover:bg-amber-100 focus:outline-none focus:ring-4 focus:ring-amber-600"
                >
                  📄 Try with sample
                </button>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="min-h-[50px] rounded-xl bg-amber-900 px-6 py-2.5 text-base font-bold text-white hover:bg-amber-800 focus:outline-none focus:ring-4 focus:ring-amber-600"
                >
                  Enter Manually &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PHASE 4: EDITABLE AI DRAFT REVIEW SECTION */}
        {/* ------------------------------------------------------------- */}
        {scanDrafts.length > 0 && (
          <section
            aria-label="AI Prescription Draft Review"
            className="mt-8 rounded-3xl border-4 border-blue-900 bg-white p-6 shadow-xl sm:p-8"
          >
            <div className="border-b-2 border-slate-200 pb-4">
              <span className="inline-block rounded-lg bg-blue-900 px-3 py-1 text-sm font-extrabold uppercase tracking-wider text-white">
                AI Prescription Draft Review
              </span>
              <h2 className="mt-2 text-3xl font-black text-slate-950">
                Review Detected Medications ({scanDrafts.length})
              </h2>

              {/* Mandatory Medical Disclaimer */}
              <div className="mt-4 rounded-xl border-2 border-amber-600 bg-amber-50 p-4 text-amber-950">
                <p className="text-lg font-extrabold flex items-center gap-2">
                  <span aria-hidden="true">⚠️</span>
                  <span>AI-generated draft. Please check against your prescription and confirm with your doctor.</span>
                </p>
                <p className="mt-1 text-base text-amber-900 font-medium">
                  Review or edit dosage and timings before confirming. Nothing is saved until you tap &ldquo;Confirm &amp; Save All&rdquo;.
                </p>
              </div>
            </div>

            {/* List of Editable Draft Items */}
            <div className="mt-6 flex flex-col gap-6">
              {scanDrafts.map((item, index) => (
                <div
                  key={item.tempId}
                  className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="text-lg font-black text-blue-900">
                      Medicine #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDraftItem(item.tempId)}
                      className="min-h-[44px] rounded-lg border border-red-600 bg-white px-3 py-1 text-sm font-bold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-600"
                    >
                      Remove Item
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`draft-name-${item.tempId}`} className="block text-base font-bold text-slate-900">
                        Medication Name *
                      </label>
                      <input
                        id={`draft-name-${item.tempId}`}
                        type="text"
                        required
                        value={item.name}
                        onChange={(e) => handleUpdateDraftItem(item.tempId, 'name', e.target.value)}
                        placeholder="e.g. Amlodipine"
                        className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-white px-3 text-lg font-bold text-slate-950 focus:border-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label htmlFor={`draft-dose-${item.tempId}`} className="block text-base font-bold text-slate-900">
                        Dose / Strength
                      </label>
                      <input
                        id={`draft-dose-${item.tempId}`}
                        type="text"
                        value={item.dose}
                        onChange={(e) => handleUpdateDraftItem(item.tempId, 'dose', e.target.value)}
                        placeholder="e.g. 5mg tablet"
                        className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-white px-3 text-lg font-medium text-slate-950 focus:border-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label htmlFor={`draft-times-${item.tempId}`} className="block text-base font-bold text-slate-900">
                        Daily Times (HH:mm, comma-separated)
                      </label>
                      <input
                        id={`draft-times-${item.tempId}`}
                        type="text"
                        value={item.timesInput}
                        onChange={(e) => handleUpdateDraftItem(item.tempId, 'timesInput', e.target.value)}
                        placeholder="08:00, 20:00"
                        className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-white px-3 text-lg font-medium text-slate-950 focus:border-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label htmlFor={`draft-notes-${item.tempId}`} className="block text-base font-bold text-slate-900">
                        Special Instructions / Notes
                      </label>
                      <input
                        id={`draft-notes-${item.tempId}`}
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => handleUpdateDraftItem(item.tempId, 'notes', e.target.value)}
                        placeholder="e.g. Take with morning meal"
                        className="mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-400 bg-white px-3 text-lg font-medium text-slate-950 focus:border-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Draft Controls */}
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={handleAddEmptyDraftItem}
                className="min-h-[50px] rounded-xl border-2 border-slate-400 bg-white px-5 py-2.5 text-base font-bold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-500"
              >
                + Add Another Medicine to Draft
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setScanDrafts([])}
                  className="min-h-[52px] rounded-xl border-2 border-slate-400 bg-slate-100 px-5 py-3 text-lg font-bold text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-500"
                >
                  Discard Draft
                </button>
                <button
                  type="button"
                  disabled={savingDrafts}
                  onClick={handleConfirmAndSaveDrafts}
                  className="min-h-[52px] rounded-xl bg-blue-900 px-8 py-3 text-xl font-black text-white shadow-lg hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600 disabled:bg-slate-400"
                >
                  {savingDrafts ? 'Saving Medications...' : '✓ Confirm & Save All'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MANUAL ADD / EDIT FORM MODAL */}
        {/* ------------------------------------------------------------- */}
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
        {!loading && medications.length === 0 && scanDrafts.length === 0 && (
          <div className="my-10 rounded-2xl border-2 border-dashed border-slate-400 bg-white p-12 text-center shadow-sm">
            <span className="text-4xl" aria-hidden="true">💊</span>
            <h2 className="mt-4 text-2xl font-bold text-slate-950">No active medications added yet</h2>
            <p className="mt-2 text-lg text-slate-700">
              {canEdit
                ? 'Scan a prescription photo or add medications manually to generate daily schedules.'
                : 'No medications currently listed for this household.'}
            </p>
            {canEdit && (
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => setShowScanDialog(true)}
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-xl border-2 border-blue-900 bg-white px-6 py-3 text-lg font-bold text-blue-950 shadow-sm hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-600"
                >
                  <span>📷</span>
                  <span>Scan Prescription</span>
                </button>
                <button
                  onClick={handleTrySample}
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-xl border-2 border-emerald-800 bg-emerald-50 px-6 py-3 text-lg font-bold text-emerald-950 shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-600"
                >
                  <span>📄</span>
                  <span>Try Sample Prescription</span>
                </button>
                <button
                  onClick={handleOpenAdd}
                  className="inline-flex min-h-[52px] items-center rounded-xl bg-blue-900 px-6 py-3 text-lg font-bold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600"
                >
                  + Add First Medication
                </button>
              </div>
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

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PermissionsMatrix, RolePermissions, Role } from '@/lib/types';

/** One toggle row in the permissions grid */
interface ToggleRowProps {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

function PermissionToggle({ id, label, checked, disabled = false, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-200 last:border-0">
      <label
        htmlFor={id}
        className={`flex-1 text-lg font-semibold leading-snug ${disabled ? 'text-slate-400' : 'text-slate-900'}`}
      >
        {label}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-12 w-24 flex-shrink-0 items-center justify-center rounded-xl border-2 font-bold text-base transition-all
          focus:outline-none focus:ring-4 focus:ring-blue-500
          ${disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            : checked
            ? 'border-green-700 bg-green-600 text-white hover:bg-green-700'
            : 'border-slate-400 bg-white text-slate-600 hover:bg-slate-100'}
        `}
        aria-label={`${label}: ${checked ? 'Allowed' : 'Not allowed'}`}
      >
        {disabled ? 'Always' : checked ? 'Yes' : 'No'}
      </button>
    </div>
  );
}

/** Section card for one role */
interface RoleCardProps {
  roleLabel: string;
  roleIcon: string;
  roleKey: 'caretaker' | 'family';
  perms: RolePermissions;
  onChange: (role: 'caretaker' | 'family', field: keyof RolePermissions, value: boolean) => void;
}

function RoleCard({ roleLabel, roleIcon, roleKey, perms, onChange }: RoleCardProps) {
  return (
    <div className="rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">{roleIcon}</span>
        <h2 className="text-2xl font-black text-slate-950">{roleLabel}</h2>
      </div>

      <PermissionToggle
        id={`${roleKey}-viewMeds`}
        label="Can view medications?"
        checked={perms.canViewMeds}
        onChange={(v) => onChange(roleKey, 'canViewMeds', v)}
      />
      <PermissionToggle
        id={`${roleKey}-editMeds`}
        label="Can add or edit medicines?"
        checked={perms.canEditMeds}
        onChange={(v) => onChange(roleKey, 'canEditMeds', v)}
      />
      <PermissionToggle
        id={`${roleKey}-viewAppointments`}
        label="Can view appointments?"
        checked={perms.canViewAppointments}
        onChange={(v) => onChange(roleKey, 'canViewAppointments', v)}
      />
      <PermissionToggle
        id={`${roleKey}-editAppointments`}
        label="Can schedule or edit appointments?"
        checked={perms.canEditAppointments}
        onChange={(v) => onChange(roleKey, 'canEditAppointments', v)}
      />
      <PermissionToggle
        id={`${roleKey}-viewAdherence`}
        label="Can see adherence reports?"
        checked={perms.canViewAdherence}
        onChange={(v) => onChange(roleKey, 'canViewAdherence', v)}
      />
    </div>
  );
}

export default function PermissionsSettingsPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('family');
  const [permissions, setPermissions] = useState<PermissionsMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/permissions');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/join');
          return;
        }
        throw new Error('Failed to load permissions');
      }
      const data = await res.json();
      setPermissions(data.permissions);
    } catch (_err) {
      setError('Unable to load permission settings. Please try again.');
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
        const userRole: Role = meData.user.role;
        setRole(userRole);

        // Only elder can access this page
        if (userRole !== 'elder') {
          router.push('/dashboard');
          return;
        }

        await fetchPermissions();
      } catch (_e) {
        router.push('/join');
      }
    }
    init();
  }, [fetchPermissions, router]);

  const handleToggle = (
    roleKey: 'caretaker' | 'family',
    field: keyof RolePermissions,
    value: boolean
  ) => {
    if (!permissions) return;
    setSavedMsg(null);
    setPermissions((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [roleKey]: {
          ...prev[roleKey],
          [field]: value,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!permissions || saving) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);

    try {
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caretaker: permissions.caretaker,
          family: permissions.family,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to save permissions');
      }

      const data = await res.json();
      setPermissions(data.permissions);
      setSavedMsg('Saved permissions successfully');

      // Clear success message after 4 seconds
      setTimeout(() => setSavedMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving permissions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main
        id="main-content"
        className="flex min-h-screen items-center justify-center p-6 text-2xl font-bold text-slate-800"
      >
        ⏳ Loading permission settings...
      </main>
    );
  }

  if (role !== 'elder') {
    return null; // redirect in progress
  }

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
            <Link
              href="/activity"
              className="min-h-[48px] inline-flex items-center rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2 text-base font-bold text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              📋 Activity Log
            </Link>
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
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-950">🔐 Permission Settings</h1>
          <p className="mt-2 text-lg text-slate-700">
            Control what each role can see and do in your household. As the elder, you always have
            full access.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-6 rounded-2xl border-2 border-red-700 bg-red-50 p-5 text-lg font-bold text-red-950"
          >
            <span aria-hidden="true">⚠️ </span>
            {error}
          </div>
        )}

        {/* Saved Banner */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`mb-6 rounded-2xl border-2 border-green-700 bg-green-50 p-5 text-lg font-bold text-green-950 transition-opacity duration-300 ${savedMsg ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <span aria-hidden="true">✅ </span>
          {savedMsg ?? 'Saved permissions successfully'}
        </div>

        {/* Elder (always full access — read-only display) */}
        <div className="mb-6 rounded-2xl border-2 border-blue-900 bg-blue-50 p-6">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">👑</span>
            <h2 className="text-2xl font-black text-blue-950">Elder (You)</h2>
          </div>
          <p className="text-base font-semibold text-blue-900">
            The elder always has full access to everything and cannot be restricted.
          </p>
        </div>

        {/* Role grids */}
        {permissions && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RoleCard
              roleLabel="Caretaker"
              roleIcon="🧑‍⚕️"
              roleKey="caretaker"
              perms={permissions.caretaker}
              onChange={handleToggle}
            />
            <RoleCard
              roleLabel="Family"
              roleIcon="👨‍👩‍👧"
              roleKey="family"
              perms={permissions.family}
              onChange={handleToggle}
            />
          </div>
        )}

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !permissions}
            className="flex min-h-[52px] items-center gap-2 rounded-xl bg-blue-900 px-10 py-3 text-xl font-bold text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? '⏳ Saving...' : '💾 Save Permissions'}
          </button>
        </div>
      </main>
    </div>
  );
}

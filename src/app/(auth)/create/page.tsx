import Link from 'next/link';

export default function CreateHouseholdPage() {
  return (
    <main id="main-content" className="mx-auto max-w-lg px-6 py-12 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Create Household</h1>
      <p className="mt-4 text-lg text-slate-700">
        Household creation form will be implemented in Phase 1.
      </p>
      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-blue-900 px-6 py-3 text-lg font-bold text-white hover:bg-blue-800"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}

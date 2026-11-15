import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2 border-slate-300 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-900 text-2xl font-bold text-white shadow-sm"
              aria-hidden="true"
            >
              CC
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-slate-950">
              CareCircle
            </span>
          </div>
          <nav aria-label="Main Navigation">
            <Link
              href="/login"
              className="inline-flex min-h-[48px] items-center rounded-xl border-2 border-slate-400 bg-white px-4 py-2 text-base font-bold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-500"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-12 text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border-2 border-blue-900 bg-blue-50 px-4 py-1.5 text-base font-bold text-blue-950">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-700" aria-hidden="true"></span>
          Elder-Centered Care Platform
        </div>

        <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl md:text-6xl">
          CareCircle
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-xl font-medium leading-relaxed text-slate-800 sm:text-2xl">
          A smart, interconnected care platform where elders, caretakers, and family manage
          medications and appointments &mdash; with the elder always in control.
        </p>

        <section
          aria-label="Household Actions"
          className="mt-10 flex w-full max-w-md flex-col gap-4 sm:max-w-lg"
        >
          <Link
            href="/create"
            className="flex min-h-[56px] w-full items-center justify-center rounded-xl bg-blue-900 px-6 py-3.5 text-xl font-bold text-white shadow-md transition-colors hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600 focus:ring-offset-2"
          >
            Create household
          </Link>

          <Link
            href="/join"
            className="flex min-h-[56px] w-full items-center justify-center rounded-xl border-2 border-blue-900 bg-white px-6 py-3.5 text-xl font-bold text-blue-950 shadow-sm transition-colors hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-600 focus:ring-offset-2"
          >
            Join household
          </Link>
        </section>

        <div className="mt-12 rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Built for accessibility</h2>
          <p className="mt-2 text-base text-slate-700">
            High contrast &bull; Large text &bull; Keyboard accessible &bull; Screen-reader ready
          </p>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm font-medium text-slate-600">
        <p>CareCircle &copy; 2026 &mdash; Catalyst Hackathon Project</p>
      </footer>
    </div>
  );
}
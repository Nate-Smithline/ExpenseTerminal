"use client";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
      <div className="max-w-xl px-6 py-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <h1 className="text-3xl font-semibold tracking-tight mb-3">
          LedgerTerminal
        </h1>
        <p className="text-slate-300 mb-4">
          Day-one infra for your solopreneur budgeting, tax, and expense
          management SaaS is wired up.
        </p>
        <ul className="text-sm text-slate-300 space-y-1 mb-4">
          <li>• Backend: NestJS + GraphQL (MongoDB-ready)</li>
          <li>• Frontend: Next.js on a turborepo with pnpm workspaces</li>
          <li>• Infra targets: Railway, Caddy, MongoDB Atlas, Stripe, SendGrid</li>
        </ul>
        <p className="text-xs text-slate-400">
          Next steps: connect your MongoDB Atlas URI, Stripe keys, and
          SendGrid API key, then deploy backend + frontend to Railway behind
          Caddy.
        </p>
      </div>
    </main>
  );
}


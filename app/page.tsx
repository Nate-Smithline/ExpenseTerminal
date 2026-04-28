import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container" style={{ paddingTop: 56, paddingBottom: 60 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="h1">ExpenseTerminal</h1>
          <p className="p" style={{ marginTop: 10, maxWidth: 640 }}>
            This branch is intentionally minimal. Use <strong>/brand</strong> as a living Dieter Rams + Apple-esque component library.
          </p>
        </div>
        <span className="badge">v2.1</span>
      </div>

      <div style={{ marginTop: 18 }} className="row">
        <Link className="btn btnPrimary" href="/brand">
          Open Brand Library
        </Link>
        <Link className="btn" href="/api/health">
          Health check
        </Link>
      </div>

      <div className="card" style={{ marginTop: 22, padding: 16, background: "var(--surface)" }}>
        <p className="sectionTitle">Next steps</p>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <p className="p">
            Add new components in <span style={{ fontFamily: "var(--mono)" }}>components/</span> and showcase them in{" "}
            <span style={{ fontFamily: "var(--mono)" }}>/brand</span>.
          </p>
          <span className="kbd">Rams: less, but better</span>
        </div>
      </div>
    </main>
  );
}


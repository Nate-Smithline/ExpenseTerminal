import Link from "next/link";
import { BrandShowcase } from "../../components/brand/BrandShowcase";

export default function BrandPage() {
  return (
    <main>
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="container" style={{ paddingTop: 18, paddingBottom: 18 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row">
              <span className="badge">ExpenseTerminal</span>
              <span className="badge">Brand kit</span>
            </div>
            <div className="row">
              <Link className="btn btnGhost" href="/">
                Home
              </Link>
              <Link className="btn btnPrimary" href="/brand">
                Brand
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <BrandShowcase />
      </div>
    </main>
  );
}


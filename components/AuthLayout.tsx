"use client";

import Link from "next/link";

interface AuthLayoutProps {
  children: React.ReactNode;
  isLoading?: boolean;
}

export function AuthLayout({ children, isLoading = false }: AuthLayoutProps) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Spacer — reserves space for the fixed left panel on large screens */}
      <div className="hidden lg:block" style={{ width: "42%", flexShrink: 0 }} />

      {/* Left panel — fixed overlay */}
      <div
        className="hidden lg:flex"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "42%",
          height: "100vh",
          background: "var(--ink)",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
          zIndex: 10,
        }}
      >
        {/* Brand mark */}
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <span style={{
            width: 36, height: 36, background: "var(--forest)", color: "#fff",
            borderRadius: 5, display: "grid", placeItems: "center",
            fontWeight: 800, fontSize: 16, letterSpacing: "-.03em", flexShrink: 0,
          }}>XT</span>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, letterSpacing: "-.02em" }}>
            ExpenseTerminal
          </span>
        </Link>

        {/* Hero copy */}
        <div>
          <p style={{
            color: "#fff", fontSize: 26, fontWeight: 700, lineHeight: 1.2,
            letterSpacing: "-.025em", maxWidth: "22ch", marginBottom: 18, marginTop: 0,
          }}>
            One ledger for your{" "}
            <em style={{ fontStyle: "normal", color: "var(--forest-mid)" }}>life</em>{" "}
            and your{" "}
            <em style={{ fontStyle: "normal", color: "var(--forest-mid)" }}>hustle</em>.
          </p>
          <p style={{ color: "var(--ink-5)", fontSize: 14, lineHeight: 1.6, maxWidth: "38ch", margin: 0 }}>
            Tag every transaction as personal, business, or a split — and watch your Schedule C write itself.
          </p>
        </div>

        {/* Trust badges */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "Connects to 12,000+ banks via Plaid",
            "Live Schedule C as you tag",
            "15-day free trial — no card required",
          ].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--forest-mid)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span style={{ color: "var(--ink-5)", fontSize: 13 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form area */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "48px 24px",
        background: "var(--bone)",
      }}>
        {/* Mobile-only brand mark */}
        <div className="lg:hidden" style={{ marginBottom: 32 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <span style={{
              width: 32, height: 32, background: "var(--forest)", color: "#fff",
              borderRadius: 4, display: "grid", placeItems: "center",
              fontWeight: 800, fontSize: 15, letterSpacing: "-.03em",
            }}>XT</span>
            <span style={{ color: "var(--ink)", fontWeight: 700, fontSize: 15, letterSpacing: "-.02em" }}>
              ExpenseTerminal
            </span>
          </Link>
        </div>

        {/* Loading spinner */}
        {isLoading && (
          <div style={{ marginBottom: 24 }}>
            <svg
              className="animate-spin-slow"
              width="36" height="36" viewBox="0 0 50 50" fill="none"
              style={{ color: "var(--forest)", opacity: 0.7 }}
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = i * 30;
                const opacity = 0.15 + (i / 12) * 0.85;
                const x1 = 25 + 14 * Math.cos((angle * Math.PI) / 180);
                const y1 = 25 + 14 * Math.sin((angle * Math.PI) / 180);
                const x2 = 25 + 20 * Math.cos((angle * Math.PI) / 180);
                const y2 = 25 + 20 * Math.sin((angle * Math.PI) / 180);
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity={opacity} />
                );
              })}
            </svg>
          </div>
        )}

        {/* Form card */}
        <div style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "36px 32px",
          boxShadow: "0 1px 0 rgba(17,24,39,.04), 0 4px 16px rgba(17,24,39,.06)",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

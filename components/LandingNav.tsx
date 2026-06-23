import Link from "next/link";

export function LandingNav() {
  return (
    <div className="lp">
      <nav className="nav">
        <div className="wrap nav__in">
          <Link href="/" className="nav__brand">
            <span className="mark">XT</span>
            ExpenseTerminal
          </Link>
          <div className="nav__links">
            <Link href="/#triage">How it feels</Link>
            <Link href="/#mission">Mission</Link>
            <Link href="/#features">Features</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/#faq">FAQ</Link>
          </div>
          <div className="nav__cta">
            <Link href="/login" className="btn btn--ghost">Sign in</Link>
            <Link href="/#demo" className="btn btn--primary">Get a demo</Link>
          </div>
        </div>
      </nav>
    </div>
  );
}

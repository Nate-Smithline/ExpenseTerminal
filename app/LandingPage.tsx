"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/* ─── Scroll reveal hook ─────────────────────────────────────────────────── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      root.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    root.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ─── SVG icons ──────────────────────────────────────────────────────────── */
const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const CheckLg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const AutoSortArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/* ─── Brand mark ─────────────────────────────────────────────────────────── */
function Mark({ lg }: { lg?: boolean }) {
  return <span className={`lp-mark${lg ? " lp-mark--lg" : ""}`}>XT</span>;
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export function LandingPage() {
  const rootRef = useScrollReveal();

  return (
    <div className="lp" ref={rootRef}>
      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="wrap lp-nav__in">
          <Link href="/" className="lp-nav__brand">
            <Mark /> ExpenseTerminal
          </Link>
          <div className="lp-nav__links">
            <a href="#features">Features</a>
            <a href="#peace">Why it matters</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="lp-nav__cta">
            <Link href="/login" className="lp-btn lp-btn--ghost">Sign in</Link>
            <Link href="/signup" className="lp-btn lp-btn--primary">Start free</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="lp-hero">
        <div className="wrap">
          <h1>Save More on <em>Taxes</em>. Stress Less on <em>Finances</em>.</h1>
          <p className="lp-hero__sub">
            ExpenseTerminal tags every transaction as personal, business, or a split — so the same click that balances your budget also files your taxes. Stop doing the books twice.
          </p>
          <div className="lp-hero__cta">
            <Link href="/signup" className="lp-btn lp-btn--primary lp-btn--lg">
              Start free for 15 days <ArrowRight />
            </Link>
            <a href="#how" className="lp-btn lp-btn--ghost lp-btn--lg">See how it works</a>
          </div>
          <p className="lp-hero__note">
            <Check /> No card required · Bank-level encryption · Connects via Plaid
          </p>

          {/* ── SCENE ── */}
          <div className="lp-scene reveal">
            {/* Activity card */}
            <div className="lp-card lp-card--lift">
              <div className="lp-scene__head">
                <span className="ttl">This week&rsquo;s activity</span>
                <span className="lp-flow"><AutoSortArrow /> Auto-sorted</span>
              </div>
              <div className="lp-txn">
                <div>
                  <div className="lp-txn__v">Adobe Creative Cloud</div>
                  <div className="lp-txn__d">May 26 · Studio expense</div>
                </div>
                <span className="lp-pill lp-pill--biz"><span className="pdot" /> Business</span>
                <span className="lp-txn__amt neg">$59.99</span>
              </div>
              <div className="lp-txn">
                <div>
                  <div className="lp-txn__v">Whole Foods Market</div>
                  <div className="lp-txn__d">May 25 · Groceries</div>
                </div>
                <span className="lp-pill lp-pill--per"><span className="pdot" /> Personal</span>
                <span className="lp-txn__amt neg">$142.10</span>
              </div>
              <div className="lp-txn">
                <div>
                  <div className="lp-txn__v">Verizon Wireless</div>
                  <div className="lp-txn__d">May 24 · Phone · 60% biz</div>
                </div>
                <span className="lp-pill lp-pill--par">
                  <span className="lp-split">
                    <i className="s-per" style={{ width: "40%" }} />
                    <i className="s-biz" style={{ width: "60%" }} />
                  </span>
                  {" "}Partial
                </span>
                <span className="lp-txn__amt neg">$88.00</span>
              </div>
              <div className="lp-txn">
                <div>
                  <div className="lp-txn__v">Client — Northwind Co.</div>
                  <div className="lp-txn__d">May 22 · Invoice #0142</div>
                </div>
                <span className="lp-pill lp-pill--biz"><span className="pdot" /> Business</span>
                <span className="lp-txn__amt pos">+$2,400.00</span>
              </div>
            </div>

            {/* Schedule C card */}
            <div className="lp-card lp-sc">
              <div className="lp-eyebrow" style={{ marginBottom: 4 }}>Schedule C · live</div>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em", marginBottom: 14 }}>Building itself as you go</div>
              <div className="lp-sc__row">
                <span className="lbl"><span className="ln">L8</span>Advertising</span>
                <span className="val">$420</span>
              </div>
              <div className="lp-sc__row">
                <span className="lbl"><span className="ln">L18</span>Office expense</span>
                <span className="val">$1,180</span>
              </div>
              <div className="lp-sc__row">
                <span className="lbl"><span className="ln">L25</span>Utilities · 60%</span>
                <span className="val">$528</span>
              </div>
              <div className="lp-sc__row">
                <span className="lbl"><span className="ln">L27</span>Other — software</span>
                <span className="val">$744</span>
              </div>
              <div className="lp-sc__total">
                <span className="lbl">Net profit · YTD</span>
                <span className="val">$18,640</span>
              </div>
              <div className="lp-sc__cap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, color: "var(--forest)" }}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Every tag flows straight to your return.
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── TRUST STRIP ── */}
      <div className="lp-trust">
        <div className="wrap lp-trust__in">
          <span>Connects to <b>12,000+</b> banks</span>
          <span className="sep" />
          <span>Powered by <b>Plaid</b></span>
          <span className="sep" />
          <span>Built around the <b>IRS Schedule C</b></span>
          <span className="sep" />
          <span><b>Bank-level</b> encryption</span>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section className="lp-sec" id="features">
        <div className="wrap">
          <div className="lp-sec__head reveal">
            <span className="lp-eyebrow">What it does</span>
            <h2>Four jobs. One tag. Zero double-entry.</h2>
            <p>The work you already do to stay organized is the same work that files your taxes. ExpenseTerminal connects them so nothing gets done twice.</p>
          </div>
          <div className="lp-feat">
            <div className="lp-card lp-feat__card reveal">
              <div className="lp-feat__ico ic-forest">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h18" /><circle cx="15" cy="12" r="3.2" fill="white" /><path d="M3 6h18M3 18h18" />
                </svg>
              </div>
              <h3>Personal · Business · Partial</h3>
              <p>Tag any transaction with one tap — or split it down to the percent. That Verizon bill? 60% business. We remember, and apply it everywhere it counts.</p>
            </div>
            <div className="lp-card lp-feat__card reveal">
              <div className="lp-feat__ico ic-clay">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" />
                </svg>
              </div>
              <h3>Zero-based budgeting</h3>
              <p>Give every dollar a job across needs, wants, giving, and your business. Drag an unsorted transaction onto a line and watch the month rebalance.</p>
            </div>
            <div className="lp-card lp-feat__card reveal">
              <div className="lp-feat__ico ic-wheat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h5" />
                </svg>
              </div>
              <h3>A Schedule C that writes itself</h3>
              <p>Every business and partial tag rolls straight into a live Schedule C. Quarterly estimates, net profit, and the exact line numbers — always current.</p>
            </div>
            <div className="lp-card lp-feat__card reveal">
              <div className="lp-feat__ico ic-ember">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v6M12 22v-6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M2 12h6M22 12h-6" />
                </svg>
              </div>
              <h3>Set-aside on autopilot</h3>
              <p>We watch your business income and tell you exactly what to park for taxes — before the bill, not after. No more April surprises.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PEACE OF MIND BAND ── */}
      <section className="lp-sec lp-band" id="peace">
        <div className="wrap">
          <div className="lp-sec__head reveal">
            <span className="lp-eyebrow" style={{ color: "var(--forest-mid)" }}>Why it matters</span>
            <h2>We don&rsquo;t sell a spreadsheet. We sell the feeling of being on top of it.</h2>
            <p>The hardest part of a side hustle isn&rsquo;t the work — it&rsquo;s the quiet dread that you&rsquo;ve missed something. ExpenseTerminal is built to make that dread disappear.</p>
          </div>
          <div className="lp-pom">
            <div className="lp-pom__item reveal">
              <div className="lp-pom__k">
                <span className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
                <h3>Peace of mind</h3>
              </div>
              <p>Open the app and know — not hope — that your books are clean, your taxes are covered, and nothing is hiding. Every transaction has a home.</p>
            </div>
            <div className="lp-pom__item reveal">
              <div className="lp-pom__k">
                <span className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2h6c0-.8.4-1.5 1-2A7 7 0 0012 2z" />
                  </svg>
                </span>
                <h3>Quiet intelligence</h3>
              </div>
              <p>It learns how you sort. Recurring vendors get pre-tagged, splits carry forward, and the to-do list only ever shows what genuinely needs you.</p>
            </div>
            <div className="lp-pom__item reveal">
              <div className="lp-pom__k">
                <span className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                  </svg>
                </span>
                <h3>Hours back</h3>
              </div>
              <p>No more rebuilding the year in a panic each spring. The return is already written. Hand your accountant a clean file in one click.</p>
            </div>
          </div>
          <div className="lp-stats reveal">
            <div>
              <div className="lp-pom__big">~9<span> hrs</span></div>
              <p>saved every tax season</p>
            </div>
            <div>
              <div className="lp-pom__big">$1,300<span>+</span></div>
              <p>in deductions caught by split tagging</p>
            </div>
            <div>
              <div className="lp-pom__big">0<span> surprises</span></div>
              <p>at the quarterly deadline</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp-sec" id="how">
        <div className="wrap">
          <div className="lp-sec__head reveal">
            <span className="lp-eyebrow">How it works</span>
            <h2>Connect once. Tag as you go. Done by April.</h2>
          </div>
          <div className="lp-steps">
            <div className="lp-card lp-step reveal">
              <span className="lp-step__n">STEP 01</span>
              <h3>Link your accounts</h3>
              <p>Securely connect your banks and cards through Plaid. Transactions flow in automatically — personal and business, side by side.</p>
            </div>
            <div className="lp-card lp-step reveal">
              <span className="lp-step__n">STEP 02</span>
              <h3>Tag in seconds</h3>
              <p>Personal, business, or a split. Most are pre-sorted for you; you just confirm. The drag-and-drop budget keeps every dollar accounted for.</p>
            </div>
            <div className="lp-card lp-step reveal">
              <span className="lp-step__n">STEP 03</span>
              <h3>Watch taxes handle themselves</h3>
              <p>Your Schedule C, quarterly estimates, and set-aside fund update in real time. When it&rsquo;s time to file, everything is already there.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="lp-sec lp-pricing-section" id="pricing">
        <div className="wrap">
          <div className="lp-sec__head reveal">
            <span className="lp-eyebrow">Pricing</span>
            <h2>One plan. Less than a single billable hour.</h2>
            <p>No tiers, no add-ons, no per-account fees. Everything ExpenseTerminal does, for one honest price.</p>
          </div>
          <div className="lp-price">
            <div className="lp-card lp-card--lift lp-plan reveal">
              <span className="lp-plan__tag">15 days free</span>
              <h3>ExpenseTerminal</h3>
              <div className="lp-plan__price">
                <span className="amt">$18</span>
                <span className="per">/ month</span>
              </div>
              <p className="lp-plan__sub">Billed monthly. Cancel anytime — your data exports clean.</p>
              <ul>
                <li><CheckLg /> Unlimited bank &amp; card connections</li>
                <li><CheckLg /> Personal / business / partial tagging</li>
                <li><CheckLg /> Live Schedule C &amp; quarterly estimates</li>
                <li><CheckLg /> Zero-based budgeting + cash flow</li>
                <li><CheckLg /> Automatic tax set-aside guidance</li>
                <li><CheckLg /> One-click accountant export</li>
              </ul>
              <Link href="/signup" className="lp-btn lp-btn--primary lp-btn--lg">
                Start your free trial
              </Link>
            </div>
            <div className="lp-card lp-worth reveal">
              <h3>Why it&rsquo;s worth it</h3>
              <p>A freelance bookkeeper runs $200–400 a month. A tax-prep firm charges hundreds to untangle a year of mixed transactions. ExpenseTerminal keeps it clean all year — and usually pays for itself with a single deduction you&rsquo;d have missed.</p>
              <div className="lp-worth__math">
                <div className="r"><span className="l">Bookkeeper, monthly</span><span className="v neg">$250</span></div>
                <div className="r"><span className="l">Year-end tax cleanup</span><span className="v neg">$400</span></div>
                <div className="r"><span className="l">Missed deductions</span><span className="v neg">$1,300</span></div>
                <div className="r tot"><span className="l">ExpenseTerminal</span><span className="v">$18 / mo</span></div>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 16 }}>
                That partial-split phone bill alone — 60% deductible, every month — covers your subscription twice over.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="lp-final">
        <div className="wrap">
          <div className="reveal">
            <h2>Your books, finally caught up — and staying that way.</h2>
            <p>Join the side-hustlers who stopped dreading tax season.</p>
            <div className="lp-hero__cta">
              <Link href="/signup" className="lp-btn lp-btn--primary lp-btn--lg">
                Start free for 15 days <ArrowRight />
              </Link>
              <a href="#how" className="lp-btn lp-btn--ghost lp-btn--lg">See how it works</a>
            </div>
            <p className="lp-hero__note" style={{ justifyContent: "center" }}>
              No card required · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-foot">
        <div className="wrap">
          <div className="lp-foot__in">
            <Link href="/" className="lp-foot__brand">
              <Mark /> ExpenseTerminal
            </Link>
            <div className="lp-foot__links">
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#peace">Security</a>
              <Link href="/request-demo">Support</Link>
            </div>
          </div>
          <p className="lp-foot__copy">
            &copy; 2026 ExpenseTerminal. Bank connections secured by Plaid. Tax figures are estimates — confirm with your CPA.
          </p>
        </div>
      </footer>
    </div>
  );
}

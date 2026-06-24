"use client";

import { useEffect, useRef } from "react";

type DeckItem = {
  vendor: string;
  meta: string;
  amount: number;
  ded: number;
  pct: number;
  biz: boolean;
  partial?: boolean;
};

const landingMarkup = String.raw`
<!-- NAV -->
<nav class="nav">
  <div class="wrap nav__in">
    <a href="/" class="nav__brand"><span class="mark">XT</span> ExpenseTerminal</a>
    <div class="nav__links">
      <a href="#triage">How it feels</a>
      <a href="#mission">Mission</a>
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <a href="#faq">FAQ</a>
    </div>
    <div class="nav__cta">
      <a href="/login" class="btn btn--ghost">Sign in</a>
      <a href="#demo" class="btn btn--primary">Get a demo</a>
    </div>
  </div>
</nav>

<!-- HERO -->
<header class="hero">
  <div class="wrap">
    <div class="hero__grid">
      <div class="hero__copy">
        <span class="wink">
          <b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A3.5 3.5 0 0 0 12 6 3.5 3.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/></svg> Swiping for Savings</b>
        </span>
        <h1>Swipe right on the <em>write-offs</em>. We do the rest.</h1>
        <p class="hero__sub">Swipe transactions personal or business. ExpenseTerminal turns each choice into deductions, budgets, and a Schedule C.</p>
        <div class="hero__cta">
          <a href="#demo" class="btn btn--primary btn--lg">Try it free for 15 days <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          <a href="#triage" class="btn btn--ghost btn--lg">Take it for a swipe</a>
        </div>
        <p class="hero__note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> 15-day free trial · Bank-level encryption · Connects via <a class="text-link" href="https://plaid.com/" target="_blank" rel="noopener noreferrer">Plaid</a></p>
      </div>

      <div class="hero-product reveal" role="img" aria-label="ExpenseTerminal overview showing a transaction, tax savings, and estimated tax set-aside.">
        <div class="hero-product__ring"></div>
        <div class="hero-product__node hero-product__node--top"></div>
        <div class="hero-product__node hero-product__node--left"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a4 4 0 0 0-3 7 3 3 0 0 0 1 5 3 3 0 0 0 5 1V5a3 3 0 0 0-3-1zM15 4a4 4 0 0 1 3 7 3 3 0 0 1-1 5 3 3 0 0 1-5 1" stroke="currentColor" stroke-width="1.35" fill="none"/></svg></div>
        <div class="hero-product__node hero-product__node--right"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19v-8M10 19V6M15 19v-6M20 19V8" stroke="currentColor" stroke-width="1.8"/></svg></div>
        <div class="hero-product__node hero-product__node--bottom"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M18 4v3h-3M6 20v-3h3" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></div>

        <div class="hero-product__card hero-product__card--transaction">
          <div class="hero-product__transaction-head">
            <span class="hero-product__vendor"><span></span>Amazon</span>
            <span class="hero-product__seen">11x seen</span>
          </div>
          <div class="hero-product__amount">+ $94.22</div>
          <div class="hero-product__bank">JPMorgan Chase</div>
          <div class="hero-product__date">May 27</div>
        </div>

        <div class="hero-product__card hero-product__card--impact">
          <div class="hero-product__label">Tax impact</div>
          <div class="hero-product__savings">$6,034</div>
          <div class="hero-product__caption">Lifetime tax savings</div>
          <div class="hero-product__divider"></div>
          <div class="hero-product__progress"><span>0 of 20 sorted</span><span>0%</span></div>
        </div>

        <div class="hero-product__card hero-product__card--tax">
          <div class="hero-product__eyebrow"><b>Tax</b> 2026</div>
          <div class="hero-product__tax-title">Estimated tax to set aside</div>
          <div class="hero-product__tax-amount">$14,283.53</div>
          <div class="hero-product__tax-divider"></div>
          <div class="hero-product__metric"><span>Net profit YTD</span><b>$32,559.63</b></div>
          <div class="hero-product__metric"><span>Paid so far</span><b>$13,796.10</b></div>
        </div>
      </div>
    </div>
  </div>
</header>

<!-- TRUST -->
<div class="trust">
  <div class="wrap trust__in">
    <span>Connects to <b>12,000+</b> banks</span><span class="sep"></span>
    <span>Powered by <a class="text-link" href="https://plaid.com/" target="_blank" rel="noopener noreferrer"><b>Plaid</b></a></span><span class="sep"></span>
    <span>Built around the <b>IRS Schedule C</b></span><span class="sep"></span>
    <span><b>Bank-level</b> encryption</span>
  </div>
</div>

<!-- INTERACTIVE SWIPE DEMO -->
<section class="sec swipe-sec" id="triage">
  <div class="wrap">
    <div class="sec__head reveal">
      <span class="eyebrow">Try the feeling</span>
      <h2>Sorting a year of expenses, in a few satisfying flicks.</h2>
      <p>This is the real thing, with sample data. Swipe each transaction <b style="color:var(--clay-soft);font-weight:600">Personal</b> or <b style="color:var(--forest-soft);font-weight:600">Business</b> — and watch the deductions (and your tax savings) add up.</p>
    </div>

    <div class="swipe reveal">
      <div class="swipe__stage">
        <div class="swipe__deck" id="deck" aria-live="polite"></div>
        <div class="swipe__done" id="swipeDone">
          <div class="big" id="doneSaved">$0</div>
          <div class="lbl">in deductions, sorted by you</div>
          <p>That's roughly <b id="doneTax" style="color:var(--forest-deep);font-weight:600">$0</b> you won't hand to the IRS. Imagine doing a whole year this fast.</p>
          <button class="btn btn--primary" id="restartBtn" style="margin-top:22px" type="button">Swipe again <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4"/></svg></button>
        </div>
      </div>

      <div class="swipe__panel">
        <div class="swipe__tally">
          <div class="k">Deductions found</div>
          <div class="v" id="tallyDed">$<span id="tallyDedNum">0</span></div>
          <div class="sub">≈ <b id="tallyTax">$0</b> in estimated tax saved, at a blended 25% rate.</div>
          <div class="swipe__progress"><i id="progBar"></i></div>
          <div class="swipe__count" id="progCount">0 of 8 sorted</div>
        </div>

        <div class="swipe__controls">
          <button class="swipe__btn swipe__btn--per" id="btnPer" type="button" aria-label="Sort as personal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg> Personal
          </button>
          <button class="swipe__btn swipe__btn--skip" id="btnSkip" type="button" aria-label="Skip this transaction">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/></svg>
          </button>
          <button class="swipe__btn swipe__btn--biz" id="btnBiz" type="button" aria-label="Sort as business">
            Business <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        </div>

        <div class="swipe__hintline">
          Or use your keyboard: <kbd>←</kbd> Personal <kbd>→</kbd> Business <kbd>↓</kbd> Skip
        </div>
      </div>
    </div>
  </div>
</section>

<!-- MISSION + COMMUNITY GOAL -->
<section class="sec" id="mission">
  <div class="wrap">
    <div class="mission">
      <div class="reveal">
        <span class="eyebrow">Our mission</span>
        <h2 style="margin-top:14px">You handle the <em>integrity</em>. We handle the <em>automation</em>.</h2>
        <p>Good records should be the easy part of running your business. ExpenseTerminal handles the tedious, error-prone work automatically, so staying organized takes less effort and tax season feels a lot less uncertain.</p>
        <div class="mission__split">
          <div class="mission__half you">
            <div class="lbl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> You</div>
            <p>Make the calls only you can make — what's business, what's personal, what's true.</p>
          </div>
          <div class="mission__half us">
            <div class="lbl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M5 19l2.5-2.5M16.5 7.5L19 5"/></svg> Us</div>
            <p>The math, the categories, the forms, the deadlines, the reminders. Every single time.</p>
          </div>
        </div>
      </div>

      <figure class="product-shot product-shot--tax reveal" aria-label="Tax 2026 screen preview">
        <img src="/landing/tax-2026.png" alt="" loading="lazy" decoding="async" />
      </figure>
    </div>
  </div>
</section>

<!-- EMAILS WE SEND -->
<section class="sec" id="emails" style="background:var(--surface-2);border-top:1px solid var(--border-soft);border-bottom:1px solid var(--border-soft)">
  <div class="wrap">
    <div class="sec__head reveal">
      <span class="eyebrow">In your inbox</span>
      <h2>We nudge you before the IRS does.</h2>
      <p>You don't have to remember any of this. ExpenseTerminal sends short, friendly emails at exactly the right moments — so nothing sneaks up on you.</p>
    </div>
    <div class="emails">
      <article class="card email reveal">
        <div class="email__head">
          <span class="email__ico ic-em-forest"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 14h4"/></svg></span>
          <div><div class="email__cadence">Monthly</div><div class="email__from">Withholding update</div></div>
        </div>
        <div class="email__body">
          <div class="email__subj">"Set aside $612 for May."</div>
          <p class="email__preview">Your business brought in <b>$4,180</b> last month. Here's the slice to park for taxes — moved to your set-aside automatically if you'd like.</p>
          <span class="email__tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> Sent the 1st</span>
        </div>
      </article>

      <article class="card email reveal">
        <div class="email__head">
          <span class="email__ico ic-em-clay"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M9 14l2 2 4-4"/></svg></span>
          <div><div class="email__cadence">Quarterly</div><div class="email__from">Estimate check-in</div></div>
        </div>
        <div class="email__body">
          <div class="email__subj">"Q3 is 3 weeks out — you're covered."</div>
          <p class="email__preview">Your estimated payment is <b>$2,480</b>, and you've already set aside <b>$2,050</b>. Here's the voucher and a one-tap link to pay.</p>
          <span class="email__tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> Before each deadline</span>
        </div>
      </article>

      <article class="card email reveal">
        <div class="email__head">
          <span class="email__ico ic-em-wheat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4"/></svg></span>
          <div><div class="email__cadence">As needed</div><div class="email__from">Sorting reminder</div></div>
        </div>
        <div class="email__body">
          <div class="email__subj">"7 transactions need a quick look."</div>
          <p class="email__preview">We couldn't confidently auto-sort a handful this week. They're queued in <b>Tax Triage</b> — about <b>90 seconds</b> to clear.</p>
          <span class="email__tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> Only when it matters</span>
        </div>
      </article>

      <article class="card email reveal">
        <div class="email__head">
          <span class="email__ico ic-em-violet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg></span>
          <div><div class="email__cadence">Annual</div><div class="email__from">Year-end review</div></div>
        </div>
        <div class="email__body">
          <div class="email__subj">"Your 2026 is ready for your CPA."</div>
          <p class="email__preview">A clean Schedule C, <b>$14,260</b> in deductions, and every transaction behind it — exported and ready to hand off in one click.</p>
          <span class="email__tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> Every January</span>
        </div>
      </article>
    </div>
  </div>
</section>

<!-- CLIENT QUOTES temporarily hidden
<section class="sec" id="quotes">
  <div class="wrap">
    <div class="sec__head reveal">
      <span class="eyebrow">In their words</span>
      <h2>What creators and small businesses say.</h2>
    </div>
    <div class="quotes">
      <figure class="card qcard reveal">
        <div class="qcard__mark">&ldquo;</div>
        <blockquote class="qcard__slot">Your customer's quote goes here — what changed for them once the books and taxes ran themselves.</blockquote>
        <figcaption class="qcard__who">
          <span class="qcard__av"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span>
          <div class="qcard__lines"><div class="nm"></div><div class="rl"></div></div>
        </figcaption>
        <span class="qcard__note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Add a quote</span>
      </figure>

      <figure class="card qcard reveal">
        <div class="qcard__mark">&ldquo;</div>
        <blockquote class="qcard__slot">A second voice — maybe a creator who finally caught the deductions they'd been missing for years.</blockquote>
        <figcaption class="qcard__who">
          <span class="qcard__av"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span>
          <div class="qcard__lines"><div class="nm"></div><div class="rl"></div></div>
        </figcaption>
        <span class="qcard__note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Add a quote</span>
      </figure>
    </div>
  </div>
</section>
-->

<!-- OTHER FEATURES -->
<section class="sec" id="features" style="background:var(--surface-2);border-top:1px solid var(--border-soft);border-bottom:1px solid var(--border-soft)">
  <div class="wrap">
    <div class="sec__head reveal">
      <span class="eyebrow">More than taxes</span>
      <h2>It's a budget and a cash-flow command center, too.</h2>
      <p>The same tags that file your taxes also run your money. Because personal and business share your accounts, ExpenseTerminal keeps both clear without ever tangling them.</p>
    </div>

    <div class="theme reveal">
      <div class="theme__copy">
        <span class="theme__eyebrow" style="color:var(--clay)"><span class="tnum mono">01</span> Zero-based budgeting</span>
        <h3>Give every dollar a job — across your life and your business.</h3>
        <p class="theme__lede">Plan the month in needs, wants, giving, and business. Drag an unsorted transaction onto a line and the whole month rebalances in front of you.</p>
        <ul class="theme__list">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg><span><b>Drag-to-categorize.</b> Sorting an expense for your budget is the same motion that tags it for taxes.</span></li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg><span><b>Business kept separate.</b> Your hustle's spending never muddies your household budget — and vice versa.</span></li>
        </ul>
      </div>
      <figure class="theme__media theme__media--image">
        <img src="/landing/budget-2026.png" alt="" loading="lazy" decoding="async" />
      </figure>
    </div>

    <div class="theme theme--flip reveal">
      <div class="theme__copy">
        <span class="theme__eyebrow" style="color:var(--wheat-deep)"><span class="tnum mono">02</span> Cash flow &amp; insights</span>
        <h3>See where the money goes — and where it comes from.</h3>
        <p class="theme__lede">Income vs. expenses over time, day-job vs. side-hustle mix, top categories, and plain-language insights that actually mean something.</p>
        <ul class="theme__list">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg><span><b>Income mix.</b> Watch your side hustle grow against your paycheck, month over month.</span></li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg><span><b>Net worth &amp; accounts.</b> Connect unlimited banks and cards via <a class="text-link" href="https://plaid.com/" target="_blank" rel="noopener noreferrer">Plaid</a>; balances and net worth update on their own.</span></li>
        </ul>
      </div>
      <div class="theme__media">
        <div class="eyebrow eyebrow--accent" style="margin-bottom:6px">Cash flow · last 6 months</div>
        <div class="bars">
          <div class="col"><div class="stack"><span class="b inc" style="height:58%"></span><span class="b exp" style="height:46%"></span></div><span class="m">Jan</span></div>
          <div class="col"><div class="stack"><span class="b inc" style="height:64%"></span><span class="b exp" style="height:50%"></span></div><span class="m">Feb</span></div>
          <div class="col"><div class="stack"><span class="b inc" style="height:52%"></span><span class="b exp" style="height:55%"></span></div><span class="m">Mar</span></div>
          <div class="col"><div class="stack"><span class="b inc" style="height:78%"></span><span class="b exp" style="height:48%"></span></div><span class="m">Apr</span></div>
          <div class="col"><div class="stack"><span class="b inc" style="height:70%"></span><span class="b exp" style="height:52%"></span></div><span class="m">May</span></div>
          <div class="col"><div class="stack"><span class="b inc" style="height:92%"></span><span class="b exp" style="height:54%"></span></div><span class="m">Jun</span></div>
        </div>
        <div class="kpi-row" style="margin-top:20px">
          <div class="kpi"><div class="k">Income</div><div class="v" style="color:var(--wheat-deep)">$11,240</div></div>
          <div class="kpi"><div class="k">Net cash</div><div class="v" style="color:var(--forest-deep)">+$4,980</div></div>
          <div class="kpi"><div class="k">Savings rate</div><div class="v">44%</div></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- PRICING -->
<section class="sec" id="pricing">
  <div class="wrap">
    <div class="sec__head reveal">
      <span class="eyebrow">Pricing</span>
      <h2>One plan. Less than a single billable hour.</h2>
      <p>No tiers, no add-ons, no per-account fees. Everything ExpenseTerminal does, for one honest price.</p>
    </div>
    <div class="price">
      <div class="card card--lift plan reveal">
        <span class="plan__tag">15 days free</span>
        <h3>ExpenseTerminal</h3>
        <div class="plan__price"><span class="amt">$18</span><span class="per">/ month</span></div>
        <p class="plan__sub">Billed monthly. Cancel anytime — your data exports clean.</p>
        <ul>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> Unlimited bank &amp; card connections</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> Swipe-to-sort tagging + percentage splits</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> Live Schedule C &amp; quarterly estimates</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> Zero-based budgeting + cash flow</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> Proactive tax emails &amp; set-aside</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> One-click accountant export</li>
        </ul>
        <a href="#demo" class="btn btn--primary btn--lg">Start your free trial</a>
      </div>
      <div class="card worth reveal">
        <h3>Why it's worth it</h3>
        <p>A freelance bookkeeper runs $200–400 a month. A tax-prep firm charges hundreds to untangle a year of mixed transactions. ExpenseTerminal keeps it clean all year — and usually pays for itself with a single deduction you'd have missed.</p>
        <div class="worth__math">
          <div class="r"><span class="l">Bookkeeper, monthly</span><span class="v neg">$250</span></div>
          <div class="r"><span class="l">Year-end tax cleanup</span><span class="v neg">$400</span></div>
          <div class="r"><span class="l">Missed deductions</span><span class="v neg">$1,300</span></div>
          <div class="r tot"><span class="l">ExpenseTerminal</span><span class="v">$18 / mo</span></div>
        </div>
        <p style="font-size:12.5px;color:var(--ink-3);margin-top:16px">Illustrative comparison. That partial-split phone bill alone — 60% deductible, every month — covers your subscription twice over.</p>
      </div>
    </div>
  </div>
</section>

<!-- FAQ -->
<section class="sec" id="faq" style="background:var(--surface-2);border-top:1px solid var(--border-soft);border-bottom:1px solid var(--border-soft)">
  <div class="wrap wrap--narrow">
    <div class="sec__head sec__head--center reveal">
      <span class="eyebrow">FAQ</span>
      <h2>Questions, answered.</h2>
    </div>
    <div class="faq reveal">
      <details class="faq__item" open>
        <summary class="faq__q">What is ExpenseTerminal?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="faq__a"><p>ExpenseTerminal is bookkeeping and tax software for creators, freelancers, and small businesses. You sort each transaction as personal, business, or a percentage split — with a quick swipe — and that single tag builds both your monthly budget and your IRS Schedule C, so you never do tax bookkeeping twice.</p></div>
      </details>
      <details class="faq__item">
        <summary class="faq__q">Who is it for?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="faq__a"><p>Creators, freelancers, contractors, and small business owners — designers, photographers, coaches, consultants, drivers, sellers, and content creators. If your personal and business spending share the same bank accounts and cards, ExpenseTerminal is built for exactly that mix.</p></div>
      </details>
      <details class="faq__item">
        <summary class="faq__q">What does "Swiping for Savings" mean?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="faq__a"><p>Uncategorized transactions stack up like a deck of cards, and you swipe each one personal or business. Most are pre-sorted by AI so you're just confirming — and every business swipe becomes a tracked deduction. It turns the worst chore in self-employment into about ninety seconds a week.</p></div>
      </details>
      <details class="faq__item">
        <summary class="faq__q">How does it handle expenses that are part personal, part business?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="faq__a"><p>That's the "Partial" tag. Set a business percentage — say 60% on your phone bill — and ExpenseTerminal applies that split everywhere it matters: the business share flows to your Schedule C, the personal share stays in your budget. Set it once and it carries forward for that vendor.</p></div>
      </details>
      <details class="faq__item">
        <summary class="faq__q">Does it calculate my quarterly taxes?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="faq__a"><p>Yes. As income and expenses are tagged, ExpenseTerminal maintains a live estimate of self-employment and federal income tax and tells you how much to set aside for each quarter — and emails you before each deadline. These are estimates to guide your set-aside; confirm final figures with your CPA.</p></div>
      </details>
      <details class="faq__item">
        <summary class="faq__q">Is my bank data secure?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="faq__a"><p>Bank and card connections are handled by <a class="text-link" href="https://plaid.com/" target="_blank" rel="noopener noreferrer">Plaid</a>, the same secure layer used by major fintech apps, and your data is protected with bank-level encryption. ExpenseTerminal reads transactions to categorize them — it never moves your money.</p></div>
      </details>
      <details class="faq__item">
        <summary class="faq__q">How much does it cost?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span></summary>
        <div class="faq__a"><p>One plan, $18 per month, with everything included — unlimited connections, the full tagging system, live Schedule C, quarterly estimates, proactive emails, and accountant export. Start with a 15-day free trial. Cancel anytime and your data exports clean.</p></div>
      </details>
    </div>
  </div>
</section>

<!-- REQUEST A DEMO -->
<section class="sec" id="demo">
  <div class="wrap">
    <div class="demo">
      <div class="demo__copy reveal">
        <span class="eyebrow">See it on your own books</span>
        <h2 style="margin-top:14px">Request a demo.</h2>
        <p>Tell us a little about your hustle and we'll walk you through ExpenseTerminal with examples that look like your money — not a generic sales deck.</p>
        <ul class="demo__list">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> A 20-minute personalized walkthrough</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> Your top deduction opportunities, mapped out</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> Honest answers — no pressure</li>
        </ul>
      </div>

      <div class="card card--lift demo__form reveal">
        <form id="demoForm" novalidate>
          <div class="field--row">
            <div class="field">
              <label for="df-name">Name</label>
              <input id="df-name" name="name" type="text" placeholder="Alex Rivera" autocomplete="name" required />
            </div>
            <div class="field">
              <label for="df-email">Work email</label>
              <input id="df-email" name="email" type="email" placeholder="you@studio.com" autocomplete="email" required />
            </div>
          </div>
          <div class="field">
            <label for="df-type">What do you do?</label>
            <select id="df-type" name="type">
              <option value="">Select one…</option>
              <option>Creator / content</option>
              <option>Freelancer / contractor</option>
              <option>Photographer / videographer</option>
              <option>Coach / consultant</option>
              <option>Small business owner</option>
              <option>Something else</option>
            </select>
          </div>
          <div class="field">
            <label for="df-rev">Roughly, annual business income</label>
            <select id="df-rev" name="revenue">
              <option value="">Select a range…</option>
              <option>Under $25k</option>
              <option>$25k – $75k</option>
              <option>$75k – $150k</option>
              <option>$150k+</option>
            </select>
          </div>
          <div class="field">
            <label for="df-note">Anything we should know? <span style="color:var(--ink-4);font-weight:500">(optional)</span></label>
            <textarea id="df-note" name="note" placeholder="The thing about taxes that stresses you out most…"></textarea>
          </div>
          <button class="btn btn--primary btn--lg" type="submit">Request my demo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
          <p class="demo__priv">We'll only use this to set up your demo. No spam, ever.</p>
          <p class="demo__status" id="demoStatus" role="status" aria-live="polite"></p>
        </form>
        <div class="demo__ok" id="demoOk" role="status">
          <span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg></span>
          <h3>You're on the list.</h3>
          <p>Thanks — your details were sent. We'll reach out within a business day to find a time. Keep an eye on your inbox.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer class="foot">
  <div class="wrap">
    <div class="foot__grid">
      <div>
        <div class="foot__brand"><span class="mark">XT</span> ExpenseTerminal</div>
        <p class="foot__about">Bookkeeping and taxes for creators, freelancers, and small businesses. Swipe right on the write-offs.</p>
      </div>
      <div class="foot__col">
        <h4>Product</h4>
        <a href="#triage">How it feels</a>
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="#faq">FAQ</a>
      </div>
      <div class="foot__col">
        <h4>Customers</h4>
        <a href="#quotes">Case studies</a>
        <a href="#quotes">Design freelancers</a>
        <a href="#quotes">Photographers</a>
        <a href="#quotes">Coaches</a>
      </div>
      <div class="foot__col">
        <h4>Company</h4>
        <a href="#mission">Mission</a>
        <a href="#demo">Request a demo</a>
        <a href="/privacy">Privacy</a>
        <a href="/login">Sign in</a>
      </div>
    </div>
    <p class="foot__copy">© 2026 ExpenseTerminal. Bank connections secured by <a class="text-link" href="https://plaid.com/" target="_blank" rel="noopener noreferrer">Plaid</a>. Tax figures are estimates — confirm with your CPA. Community figures, quotes, and comparisons on this page are illustrative.</p>
  </div>
</footer>
`;

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observers: IntersectionObserver[] = [];
    const cleanups: Array<() => void> = [];
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      root.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
    } else {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("in");
            revealObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      root.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));
      observers.push(revealObserver);
    }

    const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
    const countUp = (
      el: Element | null,
      from: number,
      to: number,
      duration: number,
      format: (value: number) => string
    ) => {
      if (!el) return;
      let start: number | null = null;
      const step = (timestamp: number) => {
        if (start === null) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = format(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const deck: DeckItem[] = [
      { vendor: "Figma Inc.", meta: "Jun 02 · Software subscription", amount: 45, ded: 45, pct: 94, biz: true },
      { vendor: "Blue Bottle Coffee", meta: "Jun 02 · Coffee", amount: 5.75, ded: 0, pct: 88, biz: false },
      { vendor: "B&H Photo Video", meta: "Jun 01 · Camera lens", amount: 1240, ded: 1240, pct: 97, biz: true },
      { vendor: "Trader Joe's", meta: "May 31 · Groceries", amount: 96.4, ded: 0, pct: 91, biz: false },
      { vendor: "Squarespace", meta: "May 30 · Website hosting", amount: 23, ded: 23, pct: 92, biz: true },
      { vendor: "Delta Air Lines", meta: "May 29 · Client trip · Austin", amount: 384, ded: 384, pct: 86, biz: true },
      { vendor: "Verizon Wireless", meta: "May 28 · Phone · 60% business", amount: 88, ded: 52.8, pct: 90, biz: true, partial: true },
      { vendor: "Canva Pro", meta: "May 27 · Design tool", amount: 12.99, ded: 12.99, pct: 89, biz: true },
    ];
    const taxRate = 0.25;
    const total = deck.length;

    const deckEl = root.querySelector<HTMLElement>("#deck");
    const doneEl = root.querySelector("#swipeDone");
    const tallyDedNum = root.querySelector("#tallyDedNum");
    const tallyTax = root.querySelector("#tallyTax");
    const progBar = root.querySelector<HTMLElement>("#progBar");
    const progCount = root.querySelector("#progCount");
    const doneSaved = root.querySelector("#doneSaved");
    const doneTax = root.querySelector("#doneTax");

    let idx = 0;
    let deductions = 0;
    let animating = false;
    let demoInView = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const money = (n: number) =>
      `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const cardMarkup = (item: DeckItem, posClass: string) => {
      const hint = item.biz
        ? `<span class="scard__hint biz"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg> Looks like Business · ${item.pct}%</span>`
        : `<span class="scard__hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg> Looks like Personal · ${item.pct}%</span>`;
      const ded = item.biz
        ? `<div class="scard__ded"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> ${item.partial ? `60% deductible · ${money(item.ded)}` : `Deductible · ${money(item.ded)}`}</div>`
        : `<div class="scard__ded" style="color:var(--ink-4)">Not a write-off</div>`;

      return `
        <div class="scard ${posClass}">
          <div class="scard__stamp per">Personal</div>
          <div class="scard__stamp biz">Business</div>
          ${hint}
          <div class="scard__vendor">${item.vendor}</div>
          <div class="scard__meta">${item.meta}</div>
          <div class="scard__amt">${money(item.amount)}</div>
          ${ded}
        </div>`;
    };

    const updateProgressOnly = () => {
      if (progBar) progBar.style.width = `${(idx / total) * 100}%`;
      if (progCount) progCount.textContent = `${idx} of ${total} sorted`;
    };

    const updateStats = () => {
      if (tallyDedNum) tallyDedNum.textContent = Math.round(deductions).toLocaleString("en-US");
      if (tallyTax) tallyTax.textContent = fmt(deductions * taxRate);
      updateProgressOnly();
    };

    const finish = () => {
      if (!deckEl) return;
      deckEl.innerHTML = "";
      doneEl?.classList.add("show");
      countUp(doneSaved, 0, deductions, 900, fmt);
      countUp(doneTax, 0, deductions * taxRate, 900, fmt);
      updateProgressOnly();
    };

    const render = () => {
      if (!deckEl) return;
      deckEl.innerHTML = "";
      for (let depth = 2; depth >= 0; depth -= 1) {
        const item = deck[idx + depth];
        if (!item) continue;
        const posClass = depth === 0 ? "top" : depth === 1 ? "s-2" : "s-3";
        deckEl.insertAdjacentHTML("afterbegin", cardMarkup(item, posClass));
      }
      const top = deckEl.querySelector<HTMLElement>(".scard.top");
      if (top) attachDrag(top);
      updateStats();
    };

    const commit = (asBiz: boolean) => {
      if (!deckEl || animating || idx >= total) return;
      const item = deck[idx];
      const top = deckEl.querySelector<HTMLElement>(".scard.top");
      if (!top) return;
      animating = true;

      if (asBiz && item.biz !== false) deductions += item.ded;

      const dir = asBiz ? 1 : -1;
      top.style.transition = "transform .42s cubic-bezier(.4,0,.2,1), opacity .42s";
      top.style.transform = `translateX(${dir * 520}px) rotate(${dir * 18}deg)`;
      top.style.opacity = "0";
      const stamp = top.querySelector<HTMLElement>(asBiz ? ".scard__stamp.biz" : ".scard__stamp.per");
      if (stamp) stamp.style.opacity = "1";

      idx += 1;
      if (asBiz && item.biz !== false && item.ded > 0) {
        const fromD = deductions - item.ded;
        countUp(tallyDedNum, fromD, deductions, 420, (n) => Math.round(n).toLocaleString("en-US"));
        countUp(tallyTax, fromD * taxRate, deductions * taxRate, 420, fmt);
      }

      timeoutId = setTimeout(() => {
        animating = false;
        if (idx >= total) finish();
        else render();
        updateProgressOnly();
      }, 360);
    };

    const skip = () => {
      if (!deckEl || animating || idx >= total) return;
      const top = deckEl.querySelector<HTMLElement>(".scard.top");
      if (!top) return;
      animating = true;
      top.style.transition = "transform .38s cubic-bezier(.4,0,.2,1), opacity .38s";
      top.style.transform = "translateY(-460px) scale(.9)";
      top.style.opacity = "0";
      idx += 1;
      timeoutId = setTimeout(() => {
        animating = false;
        if (idx >= total) finish();
        else render();
        updateProgressOnly();
      }, 320);
    };

    const restart = () => {
      idx = 0;
      deductions = 0;
      animating = false;
      doneEl?.classList.remove("show");
      render();
    };

    function attachDrag(card: HTMLElement) {
      let startX = 0;
      let startY = 0;
      let dragging = false;
      let dx = 0;
      const stampBiz = card.querySelector<HTMLElement>(".scard__stamp.biz");
      const stampPer = card.querySelector<HTMLElement>(".scard__stamp.per");

      const down = (event: PointerEvent) => {
        if (animating) return;
        dragging = true;
        dx = 0;
        startX = event.clientX;
        startY = event.clientY;
        card.style.transition = "none";
        card.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!dragging) return;
        dx = event.clientX - startX;
        const dy = event.clientY - startY;
        const rotation = dx / 18;
        card.style.transform = `translate(${dx}px,${dy * 0.25}px) rotate(${rotation}deg)`;
        const opacity = Math.min(Math.abs(dx) / 90, 1);
        if (dx > 0) {
          if (stampBiz) stampBiz.style.opacity = `${opacity}`;
          if (stampPer) stampPer.style.opacity = "0";
        } else {
          if (stampPer) stampPer.style.opacity = `${opacity}`;
          if (stampBiz) stampBiz.style.opacity = "0";
        }
      };
      const up = () => {
        if (!dragging) return;
        dragging = false;
        if (dx > 90) commit(true);
        else if (dx < -90) commit(false);
        else {
          card.style.transition = "transform .3s var(--ease)";
          card.style.transform = "";
          if (stampBiz) stampBiz.style.opacity = "0";
          if (stampPer) stampPer.style.opacity = "0";
        }
      };

      card.addEventListener("pointerdown", down);
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerup", up);
      card.addEventListener("pointercancel", up);
    }

    const btnPer = root.querySelector("#btnPer");
    const btnBiz = root.querySelector("#btnBiz");
    const btnSkip = root.querySelector("#btnSkip");
    const restartBtn = root.querySelector("#restartBtn");
    const onPersonalClick = () => commit(false);
    const onBusinessClick = () => commit(true);

    btnPer?.addEventListener("click", onPersonalClick);
    btnBiz?.addEventListener("click", onBusinessClick);
    btnSkip?.addEventListener("click", skip);
    restartBtn?.addEventListener("click", restart);
    if (btnPer) cleanups.push(() => btnPer.removeEventListener("click", onPersonalClick));
    if (btnBiz) cleanups.push(() => btnBiz.removeEventListener("click", onBusinessClick));
    if (btnSkip) cleanups.push(() => btnSkip.removeEventListener("click", skip));
    if (restartBtn) cleanups.push(() => restartBtn.removeEventListener("click", restart));

    const triageSection = root.querySelector("#triage");
    if (triageSection) {
      const keyboardObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            demoInView = entry.isIntersecting;
          });
        },
        { threshold: 0.3 }
      );
      keyboardObserver.observe(triageSection);
      observers.push(keyboardObserver);
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!demoInView || idx >= total) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        commit(false);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        commit(true);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        skip();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    cleanups.push(() => document.removeEventListener("keydown", onKeyDown));

    render();

    const form = root.querySelector<HTMLFormElement>("#demoForm");
    const ok = root.querySelector("#demoOk");
    const status = root.querySelector<HTMLElement>("#demoStatus");
    const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    const setStatus = (message: string, tone: "error" | "info" = "info") => {
      if (!status) return;
      status.textContent = message;
      status.dataset.tone = tone;
    };
    const onSubmit = async (event: SubmitEvent) => {
      event.preventDefault();
      const name = form?.querySelector<HTMLInputElement>("#df-name");
      const email = form?.querySelector<HTMLInputElement>("#df-email");
      const type = form?.querySelector<HTMLSelectElement>("#df-type");
      const revenue = form?.querySelector<HTMLSelectElement>("#df-rev");
      const note = form?.querySelector<HTMLTextAreaElement>("#df-note");
      if (!name?.value.trim() || !email?.value.trim() || !/.+@.+\..+/.test(email.value)) {
        (name?.value.trim() ? email : name)?.focus();
        setStatus("Please enter your name and a valid email.", "error");
        return;
      }
      setStatus("");
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }
      try {
        const res = await fetch("/api/request-demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName: name.value.trim(),
            email: email.value.trim(),
            businessType: type?.value.trim() || undefined,
            revenue: revenue?.value.trim() || undefined,
            message: note?.value.trim() || undefined,
            source: "Landing page demo form",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(data.error ?? "Could not send your request. Please try again.", "error");
          return;
        }
        if (form) form.style.display = "none";
        ok?.classList.add("show");
      } catch {
        setStatus("Could not send your request. Check your connection and try again.", "error");
      } finally {
        if (submitButton && form?.style.display !== "none") {
          submitButton.disabled = false;
          submitButton.textContent = "Request my demo";
        }
      }
    };
    form?.addEventListener("submit", onSubmit);
    if (form) cleanups.push(() => form.removeEventListener("submit", onSubmit));

    return () => {
      observers.forEach((observer) => observer.disconnect());
      cleanups.forEach((cleanup) => cleanup());
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      className="lp"
      ref={rootRef}
      dangerouslySetInnerHTML={{ __html: landingMarkup }}
    />
  );
}

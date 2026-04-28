# ExpenseTerminal (XT) — v1 Specification

**Status:** Specification, ready for build **Target launch:** 6 weeks from kickoff **Team:** 2 builders **Stack:** Next.js + Supabase + Plaid + Claude + Stripe + Resend (full details in Section 10)

This document is the single source of truth for v1. Every feature listed in Section 10's "v1 MUST ship" is in scope; everything else is out of scope for v1 and listed as "Won't build" or "v1.1 / v2." When a build decision is ambiguous during development, this document arbitrates — refer to it before adding scope.

The plan went through several rounds of iteration and devil's-advocate review. The version below reflects the final scope: simplified, opinionated, and tight enough for two builders to ship in 6 weeks.

---

## 1. What XT is, in one paragraph

ExpenseTerminal is your tax assistant — a year-round tracker and advisor for people earning money outside a paycheck. Side-hustlers, 1099 contractors, freelancers, and single-member LLCs (often used by freelancers for liability protection). It connects to your bank and cards, uses Claude to sort every transaction into business, personal, or "ask me," tells you exactly how much to set aside each month, and surfaces every deduction you'd otherwise miss. It does not file your taxes. It hands a clean, exportable record to you or your accountant when it's time to file.

XT is a *year-round tax brain*, not a filing tool. That's the wedge — and the thing every piece of marketing must reinforce. Users who treat XT like TurboTax (open it in March, ignore it the other 11 months) get 10% of the value. Users who let it run quietly all year get every deduction, never miss a quarterly, and forward a clean PDF to their CPA in five minutes.

**Made by two builders with side hustles** — not a company, not a startup with a press kit. Just two people who got tired of side-hustle tax panic and built the tool they wanted. The brand voice, About page, and customer support all reflect this.

---

## 2. The marketing line

**Primary:**

> **Get tax assistance and savings — without the time or hassle.**

This follows the proven "Get {result you want} without {thing you don't want}" formula. The result: tax assistance + savings. The thing they don't want: time spent and hassle. Names both the upside and the friction it removes — which is exactly how a busy side-hustler thinks about taxes.

**Supporting sub-headline:**

> Connect your accounts. We sort every transaction, find every deduction, and tell you what to set aside each month. Hand a clean record to your accountant when it's time to file.

**Two alternates if the primary tests weak:**

- *Your tax assistant. All year, not just April.* (More positioning-led; less benefit-led.)
- *Know what you owe. Keep what you've earned.* (More poetic; loses the "without hassle" angle.)

**Elevator pitch (45 seconds):**

> If you have a side hustle, freelance, or run an LLC, taxes are a quiet panic. You don't know what you owe, you don't know what you can deduct, and TurboTax shows up once a year and asks you to remember twelve months of receipts. ExpenseTerminal is your tax assistant — it watches every transaction in real time, tells you in plain English what to save and what to write off, and reminds you about every deadline. It doesn't file for you. It hands you (or your accountant) a perfectly organized record so filing takes thirty minutes instead of three weekends.

---

## 3. Positioning: what XT is not


| Tool                     | What they do                     | Where XT differs                                                  |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------- |
| TurboTax / H&R Block     | File annual returns              | XT is year-round, not a once-a-year checkout flow                 |
| Keeper Tax               | Deduction-finder via SMS         | XT is a workspace, not a chat thread; built for a CPA hand-off    |
| Found / Lili             | Banking + taxes for solopreneurs | XT doesn't ask you to switch banks                                |
| Collective               | $$$ concierge LLC + CPA service  | XT is software; 10x cheaper                                       |
| QuickBooks Self-Employed | Bookkeeping with tax features    | XT is calmer, less accountant-coded, built for non-finance brains |


**The one-line difference:** XT is the only tool that shows you what you'll save *before* you pay, sorts your transactions automatically with a confidence score, and is designed to be handed to a bookkeeper or CPA like a Notion workspace.

---

## 4. Pricing

**Monthly subscription with discounted annual option.**

- **$18/month** (cancel anytime) — default selection
- **$180/year** (save $36, 2 months free) — for believers who want to lock in

Why this structure:

- $18/month is priced like a real tool — not a cheap utility, not an enterprise gouge. Comparable to Notion ($10), Linear ($8), Superhuman ($30).
- Monthly billing reinforces the year-round positioning. Every month we have to earn the renewal — that's discipline the product needs.
- Annual option exists for power users without forcing a $180 commitment on first-time buyers. ~30% of customers typically pick annual when offered both — solid cash flow without conversion drag.
- Lower friction at signup: $18 feels reversible, $180 feels like a leap of faith to a stranger.

**The math sells itself:** if XT finds even $720 in deductions you'd miss, that's ~$180 in tax savings — the product pays for itself in the first year. Most users find 5–10x that.

**The "show savings before paywall" mechanic — this is the conversion engine:**

1. User signs up free, connects bank/card via Plaid (~30 seconds)
2. XT pulls last 90 days of transactions
3. Claude runs the classifier in the background (~2 minutes)
4. User lands on a results screen:
  > **We found $3,847 in potential deductions.** Estimated tax savings: $923–$1,420 Start tracking forward — pick a plan
  >
  > **● $18/month** (cancel anytime) ○ $180/year — *save $36*
5. They can see *how many* deductions, *categories*, and a blurred preview. To see the itemized list and unlock ongoing tracking → paywall.

**Refund policy:** Monthly users can cancel anytime, no refund needed. Annual users get a 30-day no-questions-asked refund. Confidence move; reduces purchase friction.

**Future tiers (post-v1, do not build now):**

- *XT Pro* ($36/mo or $360/yr): multi-entity support, mileage tracking, state coverage beyond v1.1
- *XT for Accountants*: per-seat pricing for CPAs managing multiple XT clients

---

## 5. Onboarding journey — the 10-minute path to "holy shit"

Onboarding is where most tax SaaS dies. Make it ruthless.

**Step 1 — Welcome (15 sec)** Single screen. One sentence: *"Let's find out what you can save. Takes about 10 minutes."* One button: *Get started.*

**Step 2 — Tell us about your work (60 sec)** Three multi-select questions, no typing:

- *How do you earn money?* [W2 job] [1099 contracts] [LLC / business] [Other]
- *Roughly how much from your side income last year?* [<$10K] [$10–50K] [$50–150K] [$150K+]
- *Do you work with a CPA?* [Yes] [No] [Sometimes]

This data tunes the classifier and the tax estimator. No SSN, no birthday, no friction.

**Step 3 — Connect your accounts (90 sec)** Plaid Link. Encourage connecting *all* personal + business accounts: *"The more we see, the more we find. Your data is read-only and encrypted."*

**Step 4 — Mark which accounts are which (30 sec)** Show the connected accounts as a clean list. Toggle on each: [Personal] [Business] [Mixed]. This is the W2 + side hustle accommodation you asked for.

**Step 5 — Coffee break (2–3 min)** While Claude classifies the last 90 days of transactions, show a calm progress screen with a few rotating educational lines:

- *"Did you know? You can deduct 50% of your self-employment tax."*
- *"Home office deductions average $1,500/yr for our users."*
- *"Quarterly tax deadlines: April 15, June 15, Sept 15, Jan 15."*

**Step 6 — The reveal (the conversion moment)**

> **We found $3,847 in potential deductions.** Across 47 transactions in 8 categories. Estimated tax savings: $923–$1,420.
>
> [See the breakdown — $180/year] [Maybe later]

**Step 7 — Post-payment: the first 5 ambiguous transactions (3 min)** Right after payment, queue up the 5 highest-value ambiguous transactions: *"Help us learn — 5 quick questions and we'll be smarter forever."* This trains the classifier on their preferences immediately and creates an early sense of ownership.

**Step 8 — Set your monthly notification (15 sec)** *"On the 1st of each month, we'll tell you exactly how much to set aside. Email, text, or both?"*

Done. Total time: ~8 minutes. They paid, they're tracked, they're notified.

---

## 6. Pages of the site

Built with Apple + Notion + Dieter Rams in mind. The Rams principles applied directly:

> **Less, but better.** No feature on a page that doesn't earn its place. **Honest.** Never make the product look more capable than it is. **Unobtrusive.** The interface gets out of the way of the user's task. **Long-lasting.** Avoid trends (no glassmorphism, no AI gradients, no 3D blobs). **As little design as possible.** Mostly off-white background, a single accent color, generous whitespace, one typeface (Inter or SF Pro).

### Marketing site (4 pages)

**Home**

- Hero: tagline + sub-headline + one CTA (*Find my deductions →*)
- Three-step "how it works" with a product GIF for each step
- One screenshot of the dashboard (the hero shot)
- Pricing block (monthly + annual options)
- Testimonial row (3 quotes — video testimonials when available)
- Footer

**How it works**

- Long-form scroll. Each step is one section with a single supporting visual (GIF preferred over static screenshot).
- Connect → Classify → Calculate → Hand off
- "Why monthly *and* annual?" expandable
- "What about my data?" expandable

**Pricing**

- Two cards side by side: $18/mo and $180/yr ("save $36"). No "compare plans" table.
- "What you save" calculator: drag a slider for "side hustle income" → shows estimated deductions found and net savings.
- Pricing is also visible on the home page above the fold.

**About**

- One paragraph on why XT exists, written in the voice of two builders with side hustles solving their own problem. Photos of the two founders. Contact email. Done.

### Landing page principles — the home page playbook

These 17 principles guide every decision on the home page. They double as a checklist before launch.

**1. Avoid over-designing.** Off-white background, one accent color, one typeface, generous whitespace. No gradients, glassmorphism, or AI-blob illustrations. If something doesn't earn its place, it gets cut.

**2. Use GIFs of the product.** Three short looping GIFs on the home page: (a) a transaction auto-classifying with confidence score appearing, (b) a user pressing `B` and the rule applying to 11 past charges, (c) the monthly notification email opening to the dashboard. Each GIF is under 2MB, optimized, lazy-loaded.

**3. Increase site speed.** Target Lighthouse score of 95+. Static-rendered Next.js pages, no client-side analytics on landing (server-side only), images served via Vercel's image optimization, GIFs converted to MP4 with `<video>` tags. Sub-1s first contentful paint.

**4. One CTA above the fold.** The hero has exactly one button: *Find my deductions →*. Pricing is visible but not a CTA — it's a reference point. Footer can have a secondary "Talk to us" link.

**5. Make the page interactive.** The "What you save" calculator (drag a slider for income → live update of estimated savings) is the centerpiece interactive element. Cheap to build, high engagement, perfect emotional hook.

**6. Make pricing easily accessible.** Pricing block on the home page (above the fold-and-a-half), a sticky pricing link in the nav, and a dedicated /pricing page. Never hide it behind "contact sales."

**7. Clear language > clever language.** "Find every deduction" beats "Unlock hidden tax alpha." "Tell you what to set aside" beats "Cash flow optimization for 1099 earners." Resist puns. Resist jargon.

**8. Simple above-the-fold.** Hero contains exactly: H1, sub-headline, one CTA, one product GIF. No floating navigation overlays, no hero carousels, no scroll prompts.

**9. Stay focused on the main offer.** Every section must reinforce: *we sort transactions, find deductions, tell you what to save.* Cut anything else, even if it's true. Especially if it's true.

**10. Spend 80% of the time on the H1.** The current H1 — *"Get tax assistance and savings — without the time or hassle"* — is the most important sentence on the entire site. It earns proportional polish. Test variants in early user interviews before launch. If the H1 is wrong, nothing else matters.

**11. Speak about the user, not yourself.** "You'll know exactly what to set aside each month" beats "Our proprietary algorithm calculates monthly tax obligations." Every paragraph passes the "you/we" ratio test — at least 2:1 in favor of "you."

**12. Imagery only when it boosts the story.** No stock photos of smiling people in offices. No abstract illustrations of "AI." The only imagery: the product GIFs, the dashboard screenshot, founder photos on About. Everything else is whitespace.

**13. Value props, not buzzwords.** "Find every deduction across your last 90 days in 2 minutes" beats "AI-powered intelligent tax optimization." Cut: "leverage," "synergy," "seamless," "intelligent," "next-generation," "innovative."

**14. Micro-interactions to delight.** Subtle hover states on buttons, gentle scroll reveals, the savings calculator updating smoothly as you drag, a tiny `→` arrow that slides on the CTA on hover. None of these should call attention to themselves — they reward attention.

**15. Inject social proof throughout.** Testimonial under the hero. Logo bar of "as seen in" *(only after we've actually been seen in things)*. Quote pull-out beside each "how it works" step. Final testimonial above the footer CTA.

**16. Button copy tells you what's next.** *Find my deductions →* (not "Get started"). *See what you'd save →* (not "Learn more"). *Connect my bank →* (not "Continue"). Every button promises a specific next action.

**17. Video social proof when possible.** Goal: 5 short (~30 second) video testimonials by month 3 post-launch. Each from a different persona (W2+side, freelancer, LLC owner, designer, developer). Embedded inline in the home page, autoplay muted on hover.

### Product (web app, 6 surfaces)

**Dashboard / Tax Year Overview** The home of the app. One screen, scannable in 5 seconds:

- Big number top-left: *Set aside this month: $1,240*
- Big number top-right: *Deductions YTD: $4,820*
- Three rows below: *3 transactions need your review*, *Next quarterly deadline*, *Recent activity*
- One sidebar with navigation. No dashboards-within-dashboards.

The "transactions need your review" row is a primary entry point — clicking it opens Transactions filtered to "Needs review."

**Transactions** *(the unified ledger + triage)* The single most important screen after the dashboard. A Linear-style table that doubles as a triage workspace. No separate Inbox page — instead, the table has a *Needs review* filter that's always one click away and shown prominently in the nav with a count badge.

*Default table view:*

- Columns: Date, Merchant (clean name like "Blue Bottle Coffee," not "BLUEBTL #4421 SF CA"), Amount, Category, Schedule C Line, Status
- Status pills: ✓ Auto-sorted | ⚠ Needs review | ◉ Manually set
- Filter bar at top: All / **Needs review (12)** / Business / Personal
- The "Needs review" filter chip is visually distinct (subtle yellow accent) and shows a count
- Sidebar nav also shows the count: *Transactions • 12* — so users know there's work to do without leaving Dashboard

*Triage flow (when in "Needs review" filter):*

- Click any row (or hit `Enter`) → side drawer opens with the focused triage card
- Card layout:

```
┌──────────────────────────────────────────┐
│ Notion · $10.00 · Oct 15                 │
│                                          │
│ ✦ AI suggestion:                         │
│   Line 18 — Office expense               │
│   "Notion is a SaaS tool you've used     │
│    for client work in the past."         │
│                                          │
│ [B] All Notion charges → Business        │
│ [D] Just this one → Deduction            │
│ [P] Personal expense                     │
│                                          │
│ Wrong category? [Pick another]           │
└──────────────────────────────────────────┘

```

The three scope buttons (B/D/P) are the heart of the interaction:

- `B` **— All like this are business** → applies Claude's pre-selected category to *every past and future transaction from this merchant*. Generates a rule. Shows a confirmation toast: *"Applied to 11 past Notion charges. Future ones will auto-sort."*
- `D` **— Just this one is a deduction** → one-time business classification, no rule generated. Useful for the "I bought this iPad case at Apple but it was a gift" scenario.
- `P` **— Personal** → marks this transaction as personal, no deduction.

*Schedule C category — single AI pick, alternatives on demand:* Claude picks one Schedule C line and shows it as the suggestion. If the user disagrees, "Pick another" reveals a dropdown of all Schedule C lines (with the most likely 3–4 ranked at the top). This keeps the default decision a one-keystroke choice and only shows complexity when the user opts in.

*Smart batching:* When XT detects multiple similar transactions ("4 charges from Uber this week"), it groups them into a single card: *"Sort all 4 as Business — Line 24a Travel?"* with one-tap apply-to-all.

*Empty "Needs review" state:* Clean — *"Nothing to review. Every transaction is sorted."* with a tiny ✓ icon.

*Auto-sorted items can still be corrected:* Clicking any auto-sorted row opens the same drawer with the current classification highlighted. Users can override anything, anytime. Every action is reversible.

**Why this works:** One page, one mental model. Users who want to triage hit the filter; users who want to browse the full ledger ignore it. The "needs review" badge in the nav serves the same role as an Inbox count without the cost of a second page.

**Deductions** Itemized view organized by IRS category (Schedule C lines):

- Office expenses
- Software & subscriptions
- Travel
- Meals (50%)
- Home office
- etc.
- Total at top, exportable as CSV / PDF / Notion / share-link with one click

**Tax Calendar** Visual calendar with the four quarterly deadlines and annual deadline marked. Each deadline expands to show: how much you owe (estimated), how to pay (link to IRS Direct Pay + state), what to send.

**Accountant access** *(the Notion-style invite)* A single screen: *Invite your bookkeeper or CPA → enter email → they get view-only or edit access.* Works exactly like sharing a Notion page. They land in a clean, branded view of the user's data with no setup. **This is a major moat — accountants who use XT once will recommend it to other clients.**

**Settings** Account, connected institutions, notification preferences, billing, data export, delete account. Nothing more.

### Keyboard-first interaction model

XT is keyboard-driven end to end. Every action has a shortcut. The mouse is a fallback, not the primary input. This is what makes Linear, Superhuman, and Arc feel premium — and it directly serves the time-saving goal.

**Global shortcuts (work anywhere in the app):**

- `Cmd/Ctrl + K` — Open command palette (search, jump to anything, run any action)
- `?` — Show keyboard shortcut overlay
- `G then D` — Go to Dashboard
- `G then T` — Go to Transactions
- `G then R` — Go to Transactions filtered to "Needs review"
- `G then E` — Go to Deductions (Expenses)
- `G then C` — Go to Calendar
- `G then S` — Go to Settings
- `Cmd/Ctrl + Z` — Undo last action (works for classifications too)

**Transactions shortcuts (work in default view and triage view):**

- `J` / `K` — Next / previous row
- `Enter` — Open triage drawer
- `B` — Mark all from this merchant as Business (with AI's category)
- `D` — Mark just this one as Deduction
- `P` — Mark as Personal
- `Enter` (in drawer) — Confirm AI's pre-selected suggestion
- `C` — Change Schedule C category (opens dropdown)
- `F` — Open filter
- `/` — Search
- `E` — Export selection to CSV

**The command palette is the most important power feature.** Anything a user can do in the app, they can do from `Cmd+K`: "set aside this month," "export deductions," "invite my CPA," "show software expenses YTD," "review pending transactions." This is what turns XT from "an app" into "a tool" for the John persona.

---

## 7. Notifications — what they look like

**Tone:** Calm, factual, single CTA. Never alarmist. Never marketing-y inside the app.

**Channel:** Email primary, in-app secondary. SMS optional (paid add-on later).

**Visual format (email):**

- Plain off-white background
- One headline (the number)
- One paragraph of context
- One button
- Signature: *— ExpenseTerminal*
- No images, no logos beyond the wordmark, no social icons

**The six notification types in v1:**

**1. Monthly set-aside notification** — sent the 1st of each month

> **Set aside $1,240 for taxes this month.** Based on your income through October, this keeps you on track for your Q4 quarterly payment due January 15. [See the breakdown →]

**2. Quarterly deadline reminder** — sent 7 days before each quarterly deadline

> **Your Q3 estimated payment is due September 15.** Estimated amount: $3,420. Pay directly to the IRS — we'll show you exactly how. [Open payment guide →]

**3. Just-in-time review alert** — triggered when 5 new items need review, max once per day

> **5 new transactions ready for a quick sort.** About 30 seconds. We're confident on most of these — just need a thumbs up. [Review now →]

This is the workhorse notification. By alerting at small thresholds, we keep the review queue from ever feeling like a chore. Threshold (3/5/10) is configurable in Settings.

**4. Monthly review roundup** — sent the 5th of each month, catches anything the just-in-time alert missed

> **Your monthly tax check-in: 8 transactions to review.** About 2 minutes. We've sorted everything we're confident about — these ones we'd rather ask. [Review now →]

**5. Big deduction found** — sent when XT detects a high-value deduction the user might not have known about

> **You may be eligible for the home office deduction.** Based on your work-from-home pattern and recent transactions, this could save you ~$1,200 this year. [See if it applies →]

**6. Day-28 monthly recap** *(churn-mitigation, monthly subscribers only)* — sent 28 days into each billing cycle

> **Here's what XT did for you this month.**
>
> 47 transactions sorted automatically $312 in new deductions found $1,240 set aside for Q4 taxes $4,820 in YTD deductions
>
> [See the full breakdown →]

This is the single most important retention email. It makes the value visible right before the next charge — the equivalent of Spotify Wrapped landing right before renewal. For annual subscribers, this email shifts to monthly informational ("here's what we did this month") without renewal pressure.

That's it. Six notification types. Resist the urge to add more.

---

## 8. How XT uses Claude

In v1, Claude has one job: classify transactions. The conversational "Ask XT" feature is deferred to v1.1 — until classification is rock solid, adding a chat layer creates hallucination risk and support load that a 2-person team can't absorb. Customer questions in v1 are handled manually by you (the founders), responding from `support@expenseterminal.com`. This is a feature, not a bug — high-touch founder support is a luxury signal at this price point and gives you direct insight into what users actually struggle with.

### The Transaction Classifier (the workhorse)

For every transaction, XT sends a structured prompt to Claude with:

- Merchant name (cleaned)
- Amount
- MCC code (if available)
- Date and time
- Account type (personal / business / mixed)
- User's work profile (W2+side, freelancer, LLC, industries)
- Prior decisions on similar merchants from this user
- Aggregate patterns from anonymized similar users

Claude returns a single structured recommendation:

```
{
  "schedule_c_line": "Line 18 — Office expense",
  "category": "Software & Subscriptions",
  "is_business": true,
  "confidence": 0.94,
  "reasoning": "AWS is developer infrastructure. Given your freelance dev profile and prior classification of similar SaaS, this is high-confidence business.",
  "deductible_percentage": 100
}

```

If the user disagrees with the Schedule C line, the UI shows a dropdown of all 30+ Schedule C lines (with the most likely 3–4 ranked at top by Claude's secondary scoring). This keeps the AI's main response simple and fast while letting power users override anything.

**Confidence thresholds:**

- ≥ 0.85 → auto-sort silently
- 0.60–0.85 → auto-sort but flag in monthly review email
- < 0.60 → tagged "Needs review" in Transactions, surfaced via badge + just-in-time notification

**Cost control (critical for a 2-person team's runway):**

- Cache merchant decisions per user — only call Claude on *new* merchants
- Batch low-confidence transactions into single API calls
- Use Haiku for first-pass classification, Sonnet only for genuinely ambiguous edge cases
- Estimated: ~$0.20–$0.60 per user per month in API costs (lower than v1 of the plan because no conversational layer)

### What Claude does NOT do

- Predict audits
- Auto-classify with 100% certainty (always shows confidence)
- Answer free-form questions (deferred to v1.1)
- Touch the actual filing process

---

## 9. Tax education in v1 — embedded contextually, no blog

No blog at launch. No comprehensive "How to Tax" page. Tax education appears in the app exactly where it's needed:

- **Tax Calendar** shows payment instructions inline when a user clicks a deadline (which IRS portal to use, what to enter, what to send)
- **Dashboard** explains the set-aside number when clicked — "Why $1,240? Here's how we calculated it"
- **Deductions view** has a one-line plain-English description for each Schedule C category
- **Onboarding** includes a 3-question "do I owe quarterly taxes?" test as one of the welcome screens

This keeps the marketing site focused on conversion (4 pages, one job: get someone to connect their bank) and keeps education in service of action (right next to the decision the user is making).

**v1.1 deliverable:** comprehensive "How to Tax" page on the marketing site, written once we know what users actually ask via support. Becomes the SEO anchor and social-share centerpiece — but only after we've earned the right to write it through real customer questions.

---

## 10. v1 build plan (6 weeks, 2 people)

### Ruthless scope cuts (do NOT build in v1)

- ❌ Mobile app (web-first, mobile-responsive only)
- ❌ Receipt OCR / photo upload
- ❌ Receipt forwarding via email
- ❌ Real-time mileage tracking
- ❌ Multi-entity / multiple businesses
- ❌ Crypto or investment tax handling
- ❌ Voice input
- ❌ Browser extension
- ❌ Slack/Discord integrations
- ❌ Subscription detection
- ❌ "Ask XT" conversational layer (deferred to v1.1)
- ❌ Comprehensive "How to Tax" page (embedded contextual education only in v1)
- ❌ Blog (deferred to v1.1)
- ❌ State quarterly tax estimates (federal-only in v1; CA/NY/NJ/TX/FL in v1.1)

### v1 MUST ship

- ✅ Marketing site (4 pages) following the 17 landing page principles
- ✅ Plaid bank connection
- ✅ Claude transaction classifier (single recommendation + alternatives on demand)
- ✅ Dashboard with monthly set-aside number + "needs review" count
- ✅ Transactions table — unified ledger and triage with "Needs review" filter
- ✅ Three-button triage drawer (B/D/P) with keyboard shortcuts
- ✅ Deductions view (Schedule C-organized)
- ✅ Tax Calendar with quarterly + annual federal deadlines
- ✅ Quarterly tax estimator (federal only)
- ✅ 6 email notification types (set-aside, quarterly deadline, just-in-time review, monthly review, big deduction found, day-28 recap)
- ✅ Stripe billing — monthly ($18/mo) + annual ($180/yr) with annual selected as save-money option
- ✅ Show-savings-before-paywall conversion flow
- ✅ Accountant invite (Notion-style share)
- ✅ CSV / PDF export
- ✅ Cmd+K command palette + keyboard-first navigation

### Honest timeline assessment

**With federal-only scope and Ask XT deferred, 6 weeks is realistic for 2 people.**

What got cut from earlier iterations: the standalone Inbox page (saved ~3–4 days), Ask XT conversational layer (saved ~5–7 days), the comprehensive How to Tax page (saved ~10 days of writing/screenshots), 2-alternative AI output (saved ~1–2 days of UX), and all-50-states quarterly estimation (saved ~7–10 days).

What stayed: keyboard-first command palette (~~3–5 days), full notification system (~~3 days), monthly + annual billing (~1 extra day).

**Net: 6 weeks for 2 people, with state coverage as the v1.1 launch the following month.**

### Recommended stack (boring, fast, scales to 10K users)

- **Frontend:** Next.js 15 + Tailwind + shadcn/ui (gets you the Apple/Notion aesthetic for free)
- **Backend:** Next.js API routes → Supabase (Postgres + Auth + Row-Level Security)
- **Bank data:** Plaid (Production tier — ~$0.30 per connection)
- **AI:** Claude Haiku 4.5 for classification, Claude Sonnet 4.6 for ambiguous edge cases
- **Payments:** Stripe (subscription product with monthly + annual options)
- **Email:** Resend (better DX than SendGrid; matches the aesthetic)
- **Hosting:** Vercel
- **Analytics:** PostHog
- **Error monitoring:** Sentry

### Week-by-week milestone plan (6 weeks)

**Week 1 — Foundation**

- Auth, database schema, Plaid sandbox integration, marketing site shell, Stripe checkout (monthly + annual)

**Week 2 — Classification engine**

- Claude classifier prompt + caching + confidence logic
- Transactions table UI with "Needs review" filter
- Triage drawer with B/D/P shortcuts and Schedule C dropdown

**Week 3 — Insights & deductions**

- Dashboard with set-aside calculation
- Federal quarterly tax estimator
- Deductions view + CSV/PDF export

**Week 4 — Notifications + accountant flow**

- Email notification system (5 types)
- Accountant invite + view-only role
- Tax Calendar
- Settings page

**Week 5 — Marketing + polish**

- Marketing site (4 pages) following the 17 landing page principles
- Embedded education content (Tax Calendar, Dashboard tooltips, onboarding "do I owe quarterly?" test)
- Cmd+K command palette
- Show-savings-before-paywall conversion flow
- Onboarding polish

**Week 6 — Beta + buffer**

- Closed beta with 25 users from your network
- Fix the 10 things that break
- Record initial video testimonials
- Prep launch

### v1.1 launch — ~6 weeks after v1

- 5-state quarterly estimation: CA, NY, NJ, TX, FL (~40% of US side hustlers)
- W2 paystub upload for withholding integration
- Year-end CPA package auto-generation
- Comprehensive "How to Tax" page
- Predictive set-aside trajectory

### What to charge in beta

Free for the first 25 users in exchange for testimonials (especially video testimonials — see Principle 17). Then $18/month or $180/year for everyone after.

---

## 11. The Dieter Rams gut-check

Before shipping any feature, ask:

1. **Is it innovative?** Does it solve a problem that wasn't solved before? *(Auto-classification with confidence + accountant hand-off — yes.)*
2. **Does it make the product useful?** Not just possible — useful. *(Cut anything that's "nice to have" and not "I'd pay for this.")*
3. **Is it aesthetic?** *(Off-white, one accent color, one typeface, generous whitespace, no gradients.)*
4. **Does it make the product understandable?** *(A user should know what every screen does in 5 seconds.)*
5. **Is it unobtrusive?** *(The interface is invisible until needed.)*
6. **Is it honest?** *(Never claim "AI tax expert." Always show confidence. Always point to "confirm with CPA.")*
7. **Is it long-lasting?** *(No trends. Build something that looks good in 5 years.)*
8. **Is it thorough down to the last detail?** *(Empty states, error states, edge cases.)*
9. **Is it environmentally friendly?** *(Don't ship features you don't need to maintain.)*
10. **Is it as little design as possible?** *(If you can remove an element and the screen still works, remove it.)*

---

## 12. Risks & open questions

**Build risks:**

- Plaid coverage of small banks is imperfect — some users won't be able to connect
- Claude classification accuracy on edge cases (cash, Venmo, weird MCCs) will need ongoing tuning
- Manual founder-led support (in lieu of Ask XT) scales linearly with users — fine for the first 200, painful at 1,000
- Federal-only positioning may frustrate users in high-tax states (CA, NY, NJ) who expected state coverage — manage expectations clearly in onboarding

**Business risks:**

- "Show savings before paywall" requires the classifier to be *good* on day one — bad first impression kills conversion
- Monthly + annual pricing creates more churn surface — every month is a chance for users to leave. Product must earn the renewal continuously.
- CPA hand-off is positioned as a moat but only matters if CPAs actually like the export format — get 5 CPAs to review before launch
- Without all-50-states, value perception in non-covered states is lower. The math: federal deductions are still ~85% of the win, but users won't always perceive it that way.

**Resolved decisions for v1:**

- **No referral program in v1.** Revisit in v1.1 once we have organic word-of-mouth signal.
- **XT is positioned as a product built by two builders with side hustles** — not a company. The About page, founder photos, and tone reflect this. "Hi, we're two builders who got tired of side-hustle tax panic, so we built the tool we wanted."
- **CPA advisor — in progress.** Finding one is a launch-blocker for credibility. Goal: signed advisor before public launch (Week 6).
- **Show-savings-before-paywall — confirmed.** Higher emotional impact than free trial; better conversion for our specific value prop (finding deductions you didn't know about).
- **Day-28 churn-mitigation email — confirmed for v1.** Sent to monthly subscribers 28 days into their cycle: "Here's what XT did for you this month — X transactions sorted, Y deductions found ($Z), W set aside for taxes." This is the single most important retention mechanic.

---

## 13. More opportunities to save the user time

The unified Transactions page + scope buttons + keyboard-first flow is the foundation. Here are additional time-savers, prioritized by build effort vs. value.

### Ship in v1 (small additions, big payoff)

**Ask-once-per-account permissions.** When a user connects a new bank/card, ask one question: *"Are all transactions from this account business, personal, or mixed?"* If they say "all business," every future transaction auto-classifies and skips review entirely. Eliminates the most painful per-transaction decisions for users with a dedicated business card.

**Auto-rules from decisions.** Every time a user hits `B` (apply to all from this merchant), XT silently creates a rule. Show these in Settings → Rules where users can review or remove them. Over 60 days, the review queue shrinks dramatically as the user trains the system.

**Apply-to-past on reclassification.** When a user re-categorizes a transaction, surface a one-tap toast: *"Apply to your 11 previous Notion charges?"* Confirmed as v1.

### Ship in v1.1 (high-value, slightly more work)

**W2 paystub upload.** One PDF → XT extracts YTD federal withholding and uses it in the tax estimate. Means W2+side users never have to manually tell us their withholding. Big quality-of-life win for the John persona.

**Year-end CPA package, auto-generated.** Every January 15, XT generates a clean PDF: total income, categorized deductions, supporting transaction list, mileage summary, prior-year comparison. One-click email to your CPA. Turns "tax season" into "forwarding an email."

**Predictive set-aside trajectory.** Instead of just "set aside $1,240 this month," show: *"At your current pace, you'll owe ~$8,400 in Q4. You've set aside $5,200 so far. Recommended: $1,240/mo through December."* Early warning system, no surprises.

### Ship in v2 (power features, defer)

**Voice triage on mobile.** Hold the mic on a transaction card, say "business" → done. Especially valuable for sorting 20 transactions while on the subway.

**Cohort-based smart defaults.** "Most freelance designers in your income bracket categorize Adobe as Software & Subscriptions, Line 18." Pre-fills Claude's classifier with cohort priors, dramatically improving day-one accuracy.

**Auto-detect IRS payments.** When a user pays via IRS Direct Pay, detect the transaction and update their tax-paid balance automatically. Eliminates manual entry.

**Mileage tracking via monthly prompt.** Once a month: *"Did you drive for work this month? About how many miles?"* Pulls from Plaid gas station / parking patterns to estimate. One question vs. a battery-eating background app.

**"Ask XT" conversational layer.** Originally planned for v1, deferred. Once classification is rock-solid (3+ months of production data), revisit. Will be the "wow" feature for v1.1 launch.

**Comprehensive How to Tax page + blog.** Both deferred to v1.1, written once we know what users actually ask via support. Becomes the SEO anchor and social-share centerpiece.

### What I would NOT build

- **Real-time GPS mileage tracking** (battery hog, surveillance vibes, low ROI)
- **Receipt OCR via photo upload** (people take 3 photos then stop)
- **Receipt forwarding via email** (drift from the wedge)
- **Audit defense** (legal exposure, marketing nightmare; partner with a service if needed)
- **Crypto tax** (whole different product; refer out to CoinTracker)
- **Investment / capital gains** (out of scope for the side-hustle wedge)
- **Subscription detection** (drift from the wedge)

---

## v1 spec at a glance

- **Get tax assistance and savings — without the time or hassle.**
- A tracker + advisor, not a filer
- For W2+side, freelancers, 1099, single-member LLCs
- Priced **$18/month or $180/year** — monthly default, annual saves $36
- **Federal-only** in v1; CA/NY/NJ/TX/FL added in v1.1 ~6 weeks later
- Built around a **unified Transactions page** with a "Needs review" filter — no separate Inbox
- Driven by **one-keystroke decisions**: B/D/P scope buttons + Schedule C dropdown for overrides
- Single AI recommendation per transaction; alternatives revealed only when needed
- Notified **just-in-time** so review piles never build up
- **Keyboard-first** end to end with a `Cmd+K` command palette
- **No conversational AI in v1** — you handle support manually as XT
- **Embedded contextual education** in the app, no blog or comprehensive education page in v1 (both deferred to v1.1)
- Designed in the **Apple + Notion + Rams aesthetic** with the 17 landing page principles
- Buildable in **6 weeks with 2 people**

The hardest discipline going forward is *resisting feature additions*. Every "what if we also..." is a tax on the simplicity that's the whole product. When in doubt: less, but better.

---

## v1 spec — build readiness checklist

Before kicking off Week 1, confirm:

**Decisions locked:**

- Pricing: $18/mo + $180/yr (annual saves $36)
- Personas: W2+side, freelancer, 1099, single-member LLC
- Geographic scope: US Federal only in v1
- Conversion mechanic: show savings before paywall
- Brand positioning: two builders with side hustles, not a company
- No referral program in v1
- No "Ask XT" conversational layer in v1
- No blog or "How to Tax" page in v1 (embedded contextual education only)
- Inbox merged into Transactions with "Needs review" filter
- Three scope buttons (B/D/P) on transaction triage card — no snooze, no skip
- Single AI Schedule C recommendation, alternatives on demand only
- 6 notification types including the day-28 churn-mitigation recap
- Keyboard-first interaction with `Cmd+K` command palette

**External dependencies to secure before/during Week 1:**

- Plaid Production tier account
- Anthropic API account with sufficient credits
- Stripe account with subscription products configured
- Resend account for transactional email
- Domain registered (expenseterminal.com)
- CPA advisor identified and signed (target: Week 4)
- 25 beta users committed from personal network

**Quality bars for launch:**

- Lighthouse score ≥ 95 on marketing site
- Classification confidence ≥ 0.85 on the top 50 most common merchants (test corpus)
- First-time user goes from signup to "savings reveal" in under 10 minutes (timed with 5 test users)
- All 6 notification emails reviewed for tone and accuracy
- CSV/PDF export reviewed by 5 CPAs
- Keyboard shortcuts documented in `?` overlay

**Out of scope for v1 (do not build):**

- Mobile app, receipt OCR, receipt forwarding, mileage tracking, multi-entity, crypto, voice input, browser extension, Slack/Discord, subscription detection, Ask XT, blog, comprehensive How to Tax page, state quarterly estimates

---

*Built less. Built better.*

# ExpenseTerminal (XT) — v1 Specification

**Status:** Specification, ready for build **Target launch:** 6 weeks from kickoff **Team:** 2 builders **Stack:** Next.js + Supabase + Plaid + Claude + Stripe + Resend (full details in Section 10)

This document is the single source of truth for v1. Every feature listed in Section 10's "v1 MUST ship" is in scope; everything else is out of scope for v1 and listed as "Won't build" or "v1.1 / v2." When a build decision is ambiguous during development, this document arbitrates — refer to it before adding scope.

The plan went through several rounds of iteration and devil's-advocate review. The version below reflects the final scope: simplified, opinionated, and tight enough for two builders to ship in 6 weeks.

---

## 1. What XT is, in one paragraph

ExpenseTerminal is your tax assistant — a year-round tracker and advisor for people earning money outside a paycheck. Side-hustlers, 1099 contractors, freelancers, and single-member LLCs (often used by freelancers for liability protection). It connects to your bank and cards, uses Claude to sort every transaction into business, personal, or "ask me," tells you exactly how much to set aside each month, and surfaces every deduction you'd otherwise miss. It does not file your taxes. It hands a clean, exportable record to you or your accountant when it's time to file.

XT is a *year-round tax brain*, not a filing tool. That's the wedge — and the thing every piece of marketing must reinforce. Users who treat XT like TurboTax (open it in March, ignore it the other 11 months) get 10% of the value. Users who let it run quietly all year get every deduction, never miss a quarterly, and forward a clean PDF to their CPA in five minutes.

**Made by two builders with side hustles** — not a company, not a startup with a press kit. Just two people who got tired of side-hustle tax panic and built the tool they wanted. The brand voice, About page, and customer support all reflect this.

---

## 2. The marketing line

**Primary:**

> **Get tax assistance and savings — without the time or hassle.**

This follows the proven "Get {result you want} without {thing you don't want}" formula. The result: tax assistance + savings. The thing they don't want: time spent and hassle. Names both the upside and the friction it removes — which is exactly how a busy side-hustler thinks about taxes.

**Supporting sub-headline:**

> Connect your accounts. We sort every transaction, find every deduction, and tell you what to set aside each month. Hand a clean record to your accountant when it's time to file.

**Two alternates if the primary tests weak:**

- *Your tax assistant. All year, not just April.* (More positioning-led; less benefit-led.)
- *Know what you owe. Keep what you've earned.* (More poetic; loses the "without hassle" angle.)

**Elevator pitch (45 seconds):**

> If you have a side hustle, freelance, or run an LLC, taxes are a quiet panic. You don't know what you owe, you don't know what you can deduct, and TurboTax shows up once a year and asks you to remember twelve months of receipts. ExpenseTerminal is your tax assistant — it watches every transaction in real time, tells you in plain English what to save and what to write off, and reminds you about every deadline. It doesn't file for you. It hands you (or your accountant) a perfectly organized record so filing takes thirty minutes instead of three weekends.

---

## 3. Positioning: what XT is not


| Tool                     | What they do                     | Where XT differs                                                  |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------- |
| TurboTax / H&R Block     | File annual returns              | XT is year-round, not a once-a-year checkout flow                 |
| Keeper Tax               | Deduction-finder via SMS         | XT is a workspace, not a chat thread; built for a CPA hand-off    |
| Found / Lili             | Banking + taxes for solopreneurs | XT doesn't ask you to switch banks                                |
| Collective               | $$$ concierge LLC + CPA service  | XT is software; 10x cheaper                                       |
| QuickBooks Self-Employed | Bookkeeping with tax features    | XT is calmer, less accountant-coded, built for non-finance brains |


**The one-line difference:** XT is the only tool that shows you what you'll save *before* you pay, sorts your transactions automatically with a confidence score, and is designed to be handed to a bookkeeper or CPA like a Notion workspace.

---

## 4. Pricing

**Monthly subscription with discounted annual option.**

- **$18/month** (cancel anytime) — default selection
- **$180/year** (save $36, 2 months free) — for believers who want to lock in

Why this structure:

- $18/month is priced like a real tool — not a cheap utility, not an enterprise gouge. Comparable to Notion ($10), Linear ($8), Superhuman ($30).
- Monthly billing reinforces the year-round positioning. Every month we have to earn the renewal — that's discipline the product needs.
- Annual option exists for power users without forcing a $180 commitment on first-time buyers. ~30% of customers typically pick annual when offered both — solid cash flow without conversion drag.
- Lower friction at signup: $18 feels reversible, $180 feels like a leap of faith to a stranger.

**The math sells itself:** if XT finds even $720 in deductions you'd miss, that's ~$180 in tax savings — the product pays for itself in the first year. Most users find 5–10x that.

**The "show savings before paywall" mechanic — this is the conversion engine:**

1. User signs up free, connects bank/card via Plaid (~30 seconds)
2. XT pulls last 90 days of transactions
3. Claude runs the classifier in the background (~2 minutes)
4. User lands on a results screen:
  > **We found $3,847 in potential deductions.** Estimated tax savings: $923–$1,420 Start tracking forward — pick a plan
  >
  > **● $18/month** (cancel anytime) ○ $180/year — *save $36*
5. They can see *how many* deductions, *categories*, and a blurred preview. To see the itemized list and unlock ongoing tracking → paywall.

**Refund policy:** Monthly users can cancel anytime, no refund needed. Annual users get a 30-day no-questions-asked refund. Confidence move; reduces purchase friction.

**Future tiers (post-v1, do not build now):**

- *XT Pro* ($36/mo or $360/yr): multi-entity support, mileage tracking, state coverage beyond v1.1
- *XT for Accountants*: per-seat pricing for CPAs managing multiple XT clients

---

## 5. Onboarding journey — the 10-minute path to "holy shit"

Onboarding is where most tax SaaS dies. Make it ruthless.

**Step 1 — Welcome (15 sec)** Single screen. One sentence: *"Let's find out what you can save. Takes about 10 minutes."* One button: *Get started.*

**Step 2 — Tell us about your work (60 sec)** Three multi-select questions, no typing:

- *How do you earn money?* [W2 job] [1099 contracts] [LLC / business] [Other]
- *Roughly how much from your side income last year?* [<$10K] [$10–50K] [$50–150K] [$150K+]
- *Do you work with a CPA?* [Yes] [No] [Sometimes]

This data tunes the classifier and the tax estimator. No SSN, no birthday, no friction.

**Step 3 — Connect your accounts (90 sec)** Plaid Link. Encourage connecting *all* personal + business accounts: *"The more we see, the more we find. Your data is read-only and encrypted."*

**Step 4 — Mark which accounts are which (30 sec)** Show the connected accounts as a clean list. Toggle on each: [Personal] [Business] [Mixed]. This is the W2 + side hustle accommodation you asked for.

**Step 5 — Coffee break (2–3 min)** While Claude classifies the last 90 days of transactions, show a calm progress screen with a few rotating educational lines:

- *"Did you know? You can deduct 50% of your self-employment tax."*
- *"Home office deductions average $1,500/yr for our users."*
- *"Quarterly tax deadlines: April 15, June 15, Sept 15, Jan 15."*

**Step 6 — The reveal (the conversion moment)**

> **We found $3,847 in potential deductions.** Across 47 transactions in 8 categories. Estimated tax savings: $923–$1,420.
>
> [See the breakdown — $180/year] [Maybe later]

**Step 7 — Post-payment: the first 5 ambiguous transactions (3 min)** Right after payment, queue up the 5 highest-value ambiguous transactions: *"Help us learn — 5 quick questions and we'll be smarter forever."* This trains the classifier on their preferences immediately and creates an early sense of ownership.

**Step 8 — Set your monthly notification (15 sec)** *"On the 1st of each month, we'll tell you exactly how much to set aside. Email, text, or both?"*

Done. Total time: ~8 minutes. They paid, they're tracked, they're notified.

---

## 6. Pages of the site

Built with Apple + Notion + Dieter Rams in mind. The Rams principles applied directly:

> **Less, but better.** No feature on a page that doesn't earn its place. **Honest.** Never make the product look more capable than it is. **Unobtrusive.** The interface gets out of the way of the user's task. **Long-lasting.** Avoid trends (no glassmorphism, no AI gradients, no 3D blobs). **As little design as possible.** Mostly off-white background, a single accent color, generous whitespace, one typeface (Inter or SF Pro).

### Marketing site (4 pages)

**Home**

- Hero: tagline + sub-headline + one CTA (*Find my deductions →*)
- Three-step "how it works" with a product GIF for each step
- One screenshot of the dashboard (the hero shot)
- Pricing block (monthly + annual options)
- Testimonial row (3 quotes — video testimonials when available)
- Footer

**How it works**

- Long-form scroll. Each step is one section with a single supporting visual (GIF preferred over static screenshot).
- Connect → Classify → Calculate → Hand off
- "Why monthly *and* annual?" expandable
- "What about my data?" expandable

**Pricing**

- Two cards side by side: $18/mo and $180/yr ("save $36"). No "compare plans" table.
- "What you save" calculator: drag a slider for "side hustle income" → shows estimated deductions found and net savings.
- Pricing is also visible on the home page above the fold.

**About**

- One paragraph on why XT exists, written in the voice of two builders with side hustles solving their own problem. Photos of the two founders. Contact email. Done.

### Landing page principles — the home page playbook

These 17 principles guide every decision on the home page. They double as a checklist before launch.

**1. Avoid over-designing.** Off-white background, one accent color, one typeface, generous whitespace. No gradients, glassmorphism, or AI-blob illustrations. If something doesn't earn its place, it gets cut.

**2. Use GIFs of the product.** Three short looping GIFs on the home page: (a) a transaction auto-classifying with confidence score appearing, (b) a user pressing `B` and the rule applying to 11 past charges, (c) the monthly notification email opening to the dashboard. Each GIF is under 2MB, optimized, lazy-loaded.

**3. Increase site speed.** Target Lighthouse score of 95+. Static-rendered Next.js pages, no client-side analytics on landing (server-side only), images served via Vercel's image optimization, GIFs converted to MP4 with `<video>` tags. Sub-1s first contentful paint.

**4. One CTA above the fold.** The hero has exactly one button: *Find my deductions →*. Pricing is visible but not a CTA — it's a reference point. Footer can have a secondary "Talk to us" link.

**5. Make the page interactive.** The "What you save" calculator (drag a slider for income → live update of estimated savings) is the centerpiece interactive element. Cheap to build, high engagement, perfect emotional hook.

**6. Make pricing easily accessible.** Pricing block on the home page (above the fold-and-a-half), a sticky pricing link in the nav, and a dedicated /pricing page. Never hide it behind "contact sales."

**7. Clear language > clever language.** "Find every deduction" beats "Unlock hidden tax alpha." "Tell you what to set aside" beats "Cash flow optimization for 1099 earners." Resist puns. Resist jargon.

**8. Simple above-the-fold.** Hero contains exactly: H1, sub-headline, one CTA, one product GIF. No floating navigation overlays, no hero carousels, no scroll prompts.

**9. Stay focused on the main offer.** Every section must reinforce: *we sort transactions, find deductions, tell you what to save.* Cut anything else, even if it's true. Especially if it's true.

**10. Spend 80% of the time on the H1.** The current H1 — *"Get tax assistance and savings — without the time or hassle"* — is the most important sentence on the entire site. It earns proportional polish. Test variants in early user interviews before launch. If the H1 is wrong, nothing else matters.

**11. Speak about the user, not yourself.** "You'll know exactly what to set aside each month" beats "Our proprietary algorithm calculates monthly tax obligations." Every paragraph passes the "you/we" ratio test — at least 2:1 in favor of "you."

**12. Imagery only when it boosts the story.** No stock photos of smiling people in offices. No abstract illustrations of "AI." The only imagery: the product GIFs, the dashboard screenshot, founder photos on About. Everything else is whitespace.

**13. Value props, not buzzwords.** "Find every deduction across your last 90 days in 2 minutes" beats "AI-powered intelligent tax optimization." Cut: "leverage," "synergy," "seamless," "intelligent," "next-generation," "innovative."

**14. Micro-interactions to delight.** Subtle hover states on buttons, gentle scroll reveals, the savings calculator updating smoothly as you drag, a tiny `→` arrow that slides on the CTA on hover. None of these should call attention to themselves — they reward attention.

**15. Inject social proof throughout.** Testimonial under the hero. Logo bar of "as seen in" *(only after we've actually been seen in things)*. Quote pull-out beside each "how it works" step. Final testimonial above the footer CTA.

**16. Button copy tells you what's next.** *Find my deductions →* (not "Get started"). *See what you'd save →* (not "Learn more"). *Connect my bank →* (not "Continue"). Every button promises a specific next action.

**17. Video social proof when possible.** Goal: 5 short (~30 second) video testimonials by month 3 post-launch. Each from a different persona (W2+side, freelancer, LLC owner, designer, developer). Embedded inline in the home page, autoplay muted on hover.

### Product (web app, 6 surfaces)

**Dashboard / Tax Year Overview** The home of the app. One screen, scannable in 5 seconds:

- Big number top-left: *Set aside this month: $1,240*
- Big number top-right: *Deductions YTD: $4,820*
- Three rows below: *3 transactions need your review*, *Next quarterly deadline*, *Recent activity*
- One sidebar with navigation. No dashboards-within-dashboards.

The "transactions need your review" row is a primary entry point — clicking it opens Transactions filtered to "Needs review."

**Transactions** *(the unified ledger + triage)* The single most important screen after the dashboard. A Linear-style table that doubles as a triage workspace. No separate Inbox page — instead, the table has a *Needs review* filter that's always one click away and shown prominently in the nav with a count badge.

*Default table view:*

- Columns: Date, Merchant (clean name like "Blue Bottle Coffee," not "BLUEBTL #4421 SF CA"), Amount, Category, Schedule C Line, Status
- Status pills: ✓ Auto-sorted | ⚠ Needs review | ◉ Manually set
- Filter bar at top: All / **Needs review (12)** / Business / Personal
- The "Needs review" filter chip is visually distinct (subtle yellow accent) and shows a count
- Sidebar nav also shows the count: *Transactions • 12* — so users know there's work to do without leaving Dashboard

*Triage flow (when in "Needs review" filter):*

- Click any row (or hit `Enter`) → side drawer opens with the focused triage card
- Card layout:

```
┌──────────────────────────────────────────┐
│ Notion · $10.00 · Oct 15                 │
│                                          │
│ ✦ AI suggestion:                         │
│   Line 18 — Office expense               │
│   "Notion is a SaaS tool you've used     │
│    for client work in the past."         │
│                                          │
│ [B] All Notion charges → Business        │
│ [D] Just this one → Deduction            │
│ [P] Personal expense                     │
│                                          │
│ Wrong category? [Pick another]           │
└──────────────────────────────────────────┘

```

The three scope buttons (B/D/P) are the heart of the interaction:

- `B` **— All like this are business** → applies Claude's pre-selected category to *every past and future transaction from this merchant*. Generates a rule. Shows a confirmation toast: *"Applied to 11 past Notion charges. Future ones will auto-sort."*
- `D` **— Just this one is a deduction** → one-time business classification, no rule generated. Useful for the "I bought this iPad case at Apple but it was a gift" scenario.
- `P` **— Personal** → marks this transaction as personal, no deduction.

*Schedule C category — single AI pick, alternatives on demand:* Claude picks one Schedule C line and shows it as the suggestion. If the user disagrees, "Pick another" reveals a dropdown of all Schedule C lines (with the most likely 3–4 ranked at the top). This keeps the default decision a one-keystroke choice and only shows complexity when the user opts in.

*Smart batching:* When XT detects multiple similar transactions ("4 charges from Uber this week"), it groups them into a single card: *"Sort all 4 as Business — Line 24a Travel?"* with one-tap apply-to-all.

*Empty "Needs review" state:* Clean — *"Nothing to review. Every transaction is sorted."* with a tiny ✓ icon.

*Auto-sorted items can still be corrected:* Clicking any auto-sorted row opens the same drawer with the current classification highlighted. Users can override anything, anytime. Every action is reversible.

**Why this works:** One page, one mental model. Users who want to triage hit the filter; users who want to browse the full ledger ignore it. The "needs review" badge in the nav serves the same role as an Inbox count without the cost of a second page.

**Deductions** Itemized view organized by IRS category (Schedule C lines):

- Office expenses
- Software & subscriptions
- Travel
- Meals (50%)
- Home office
- etc.
- Total at top, exportable as CSV / PDF / Notion / share-link with one click

**Tax Calendar** Visual calendar with the four quarterly deadlines and annual deadline marked. Each deadline expands to show: how much you owe (estimated), how to pay (link to IRS Direct Pay + state), what to send.

**Accountant access** *(the Notion-style invite)* A single screen: *Invite your bookkeeper or CPA → enter email → they get view-only or edit access.* Works exactly like sharing a Notion page. They land in a clean, branded view of the user's data with no setup. **This is a major moat — accountants who use XT once will recommend it to other clients.**

**Settings** Account, connected institutions, notification preferences, billing, data export, delete account. Nothing more.

### Keyboard-first interaction model

XT is keyboard-driven end to end. Every action has a shortcut. The mouse is a fallback, not the primary input. This is what makes Linear, Superhuman, and Arc feel premium — and it directly serves the time-saving goal.

**Global shortcuts (work anywhere in the app):**

- `Cmd/Ctrl + K` — Open command palette (search, jump to anything, run any action)
- `?` — Show keyboard shortcut overlay
- `G then D` — Go to Dashboard
- `G then T` — Go to Transactions
- `G then R` — Go to Transactions filtered to "Needs review"
- `G then E` — Go to Deductions (Expenses)
- `G then C` — Go to Calendar
- `G then S` — Go to Settings
- `Cmd/Ctrl + Z` — Undo last action (works for classifications too)

**Transactions shortcuts (work in default view and triage view):**

- `J` / `K` — Next / previous row
- `Enter` — Open triage drawer
- `B` — Mark all from this merchant as Business (with AI's category)
- `D` — Mark just this one as Deduction
- `P` — Mark as Personal
- `Enter` (in drawer) — Confirm AI's pre-selected suggestion
- `C` — Change Schedule C category (opens dropdown)
- `F` — Open filter
- `/` — Search
- `E` — Export selection to CSV

**The command palette is the most important power feature.** Anything a user can do in the app, they can do from `Cmd+K`: "set aside this month," "export deductions," "invite my CPA," "show software expenses YTD," "review pending transactions." This is what turns XT from "an app" into "a tool" for the John persona.

---

## 7. Notifications — what they look like

**Tone:** Calm, factual, single CTA. Never alarmist. Never marketing-y inside the app.

**Channel:** Email primary, in-app secondary. SMS optional (paid add-on later).

**Visual format (email):**

- Plain off-white background
- One headline (the number)
- One paragraph of context
- One button
- Signature: *— ExpenseTerminal*
- No images, no logos beyond the wordmark, no social icons

**The six notification types in v1:**

**1. Monthly set-aside notification** — sent the 1st of each month

> **Set aside $1,240 for taxes this month.** Based on your income through October, this keeps you on track for your Q4 quarterly payment due January 15. [See the breakdown →]

**2. Quarterly deadline reminder** — sent 7 days before each quarterly deadline

> **Your Q3 estimated payment is due September 15.** Estimated amount: $3,420. Pay directly to the IRS — we'll show you exactly how. [Open payment guide →]

**3. Just-in-time review alert** — triggered when 5 new items need review, max once per day

> **5 new transactions ready for a quick sort.** About 30 seconds. We're confident on most of these — just need a thumbs up. [Review now →]

This is the workhorse notification. By alerting at small thresholds, we keep the review queue from ever feeling like a chore. Threshold (3/5/10) is configurable in Settings.

**4. Monthly review roundup** — sent the 5th of each month, catches anything the just-in-time alert missed

> **Your monthly tax check-in: 8 transactions to review.** About 2 minutes. We've sorted everything we're confident about — these ones we'd rather ask. [Review now →]

**5. Big deduction found** — sent when XT detects a high-value deduction the user might not have known about

> **You may be eligible for the home office deduction.** Based on your work-from-home pattern and recent transactions, this could save you ~$1,200 this year. [See if it applies →]

**6. Day-28 monthly recap** *(churn-mitigation, monthly subscribers only)* — sent 28 days into each billing cycle

> **Here's what XT did for you this month.**
>
> 47 transactions sorted automatically $312 in new deductions found $1,240 set aside for Q4 taxes $4,820 in YTD deductions
>
> [See the full breakdown →]

This is the single most important retention email. It makes the value visible right before the next charge — the equivalent of Spotify Wrapped landing right before renewal. For annual subscribers, this email shifts to monthly informational ("here's what we did this month") without renewal pressure.

That's it. Six notification types. Resist the urge to add more.

---

## 8. How XT uses Claude

In v1, Claude has one job: classify transactions. The conversational "Ask XT" feature is deferred to v1.1 — until classification is rock solid, adding a chat layer creates hallucination risk and support load that a 2-person team can't absorb. Customer questions in v1 are handled manually by you (the founders), responding from `support@expenseterminal.com`. This is a feature, not a bug — high-touch founder support is a luxury signal at this price point and gives you direct insight into what users actually struggle with.

### The Transaction Classifier (the workhorse)

For every transaction, XT sends a structured prompt to Claude with:

- Merchant name (cleaned)
- Amount
- MCC code (if available)
- Date and time
- Account type (personal / business / mixed)
- User's work profile (W2+side, freelancer, LLC, industries)
- Prior decisions on similar merchants from this user
- Aggregate patterns from anonymized similar users

Claude returns a single structured recommendation:

```
{
  "schedule_c_line": "Line 18 — Office expense",
  "category": "Software & Subscriptions",
  "is_business": true,
  "confidence": 0.94,
  "reasoning": "AWS is developer infrastructure. Given your freelance dev profile and prior classification of similar SaaS, this is high-confidence business.",
  "deductible_percentage": 100
}

```

If the user disagrees with the Schedule C line, the UI shows a dropdown of all 30+ Schedule C lines (with the most likely 3–4 ranked at top by Claude's secondary scoring). This keeps the AI's main response simple and fast while letting power users override anything.

**Confidence thresholds:**

- ≥ 0.85 → auto-sort silently
- 0.60–0.85 → auto-sort but flag in monthly review email
- < 0.60 → tagged "Needs review" in Transactions, surfaced via badge + just-in-time notification

**Cost control (critical for a 2-person team's runway):**

- Cache merchant decisions per user — only call Claude on *new* merchants
- Batch low-confidence transactions into single API calls
- Use Haiku for first-pass classification, Sonnet only for genuinely ambiguous edge cases
- Estimated: ~$0.20–$0.60 per user per month in API costs (lower than v1 of the plan because no conversational layer)

### What Claude does NOT do

- Predict audits
- Auto-classify with 100% certainty (always shows confidence)
- Answer free-form questions (deferred to v1.1)
- Touch the actual filing process

---

## 9. Tax education in v1 — embedded contextually, no blog

No blog at launch. No comprehensive "How to Tax" page. Tax education appears in the app exactly where it's needed:

- **Tax Calendar** shows payment instructions inline when a user clicks a deadline (which IRS portal to use, what to enter, what to send)
- **Dashboard** explains the set-aside number when clicked — "Why $1,240? Here's how we calculated it"
- **Deductions view** has a one-line plain-English description for each Schedule C category
- **Onboarding** includes a 3-question "do I owe quarterly taxes?" test as one of the welcome screens

This keeps the marketing site focused on conversion (4 pages, one job: get someone to connect their bank) and keeps education in service of action (right next to the decision the user is making).

**v1.1 deliverable:** comprehensive "How to Tax" page on the marketing site, written once we know what users actually ask via support. Becomes the SEO anchor and social-share centerpiece — but only after we've earned the right to write it through real customer questions.

---

## 10. v1 build plan (6 weeks, 2 people)

### Ruthless scope cuts (do NOT build in v1)

- ❌ Mobile app (web-first, mobile-responsive only)
- ❌ Receipt OCR / photo upload
- ❌ Receipt forwarding via email
- ❌ Real-time mileage tracking
- ❌ Multi-entity / multiple businesses
- ❌ Crypto or investment tax handling
- ❌ Voice input
- ❌ Browser extension
- ❌ Slack/Discord integrations
- ❌ Subscription detection
- ❌ "Ask XT" conversational layer (deferred to v1.1)
- ❌ Comprehensive "How to Tax" page (embedded contextual education only in v1)
- ❌ Blog (deferred to v1.1)
- ❌ State quarterly tax estimates (federal-only in v1; CA/NY/NJ/TX/FL in v1.1)

### v1 MUST ship

- ✅ Marketing site (4 pages) following the 17 landing page principles
- ✅ Plaid bank connection
- ✅ Claude transaction classifier (single recommendation + alternatives on demand)
- ✅ Dashboard with monthly set-aside number + "needs review" count
- ✅ Transactions table — unified ledger and triage with "Needs review" filter
- ✅ Three-button triage drawer (B/D/P) with keyboard shortcuts
- ✅ Deductions view (Schedule C-organized)
- ✅ Tax Calendar with quarterly + annual federal deadlines
- ✅ Quarterly tax estimator (federal only)
- ✅ 6 email notification types (set-aside, quarterly deadline, just-in-time review, monthly review, big deduction found, day-28 recap)
- ✅ Stripe billing — monthly ($18/mo) + annual ($180/yr) with annual selected as save-money option
- ✅ Show-savings-before-paywall conversion flow
- ✅ Accountant invite (Notion-style share)
- ✅ CSV / PDF export
- ✅ Cmd+K command palette + keyboard-first navigation

### Honest timeline assessment

**With federal-only scope and Ask XT deferred, 6 weeks is realistic for 2 people.**

What got cut from earlier iterations: the standalone Inbox page (saved ~3–4 days), Ask XT conversational layer (saved ~5–7 days), the comprehensive How to Tax page (saved ~10 days of writing/screenshots), 2-alternative AI output (saved ~1–2 days of UX), and all-50-states quarterly estimation (saved ~7–10 days).

What stayed: keyboard-first command palette (~~3–5 days), full notification system (~~3 days), monthly + annual billing (~1 extra day).

**Net: 6 weeks for 2 people, with state coverage as the v1.1 launch the following month.**

### Recommended stack (boring, fast, scales to 10K users)

- **Frontend:** Next.js 15 + Tailwind + shadcn/ui (gets you the Apple/Notion aesthetic for free)
- **Backend:** Next.js API routes → Supabase (Postgres + Auth + Row-Level Security)
- **Bank data:** Plaid (Production tier — ~$0.30 per connection)
- **AI:** Claude Haiku 4.5 for classification, Claude Sonnet 4.6 for ambiguous edge cases
- **Payments:** Stripe (subscription product with monthly + annual options)
- **Email:** Resend (better DX than SendGrid; matches the aesthetic)
- **Hosting:** Vercel
- **Analytics:** PostHog
- **Error monitoring:** Sentry

### Week-by-week milestone plan (6 weeks)

**Week 1 — Foundation**

- Auth, database schema, Plaid sandbox integration, marketing site shell, Stripe checkout (monthly + annual)

**Week 2 — Classification engine**

- Claude classifier prompt + caching + confidence logic
- Transactions table UI with "Needs review" filter
- Triage drawer with B/D/P shortcuts and Schedule C dropdown

**Week 3 — Insights & deductions**

- Dashboard with set-aside calculation
- Federal quarterly tax estimator
- Deductions view + CSV/PDF export

**Week 4 — Notifications + accountant flow**

- Email notification system (5 types)
- Accountant invite + view-only role
- Tax Calendar
- Settings page

**Week 5 — Marketing + polish**

- Marketing site (4 pages) following the 17 landing page principles
- Embedded education content (Tax Calendar, Dashboard tooltips, onboarding "do I owe quarterly?" test)
- Cmd+K command palette
- Show-savings-before-paywall conversion flow
- Onboarding polish

**Week 6 — Beta + buffer**

- Closed beta with 25 users from your network
- Fix the 10 things that break
- Record initial video testimonials
- Prep launch

### v1.1 launch — ~6 weeks after v1

- 5-state quarterly estimation: CA, NY, NJ, TX, FL (~40% of US side hustlers)
- W2 paystub upload for withholding integration
- Year-end CPA package auto-generation
- Comprehensive "How to Tax" page
- Predictive set-aside trajectory

### What to charge in beta

Free for the first 25 users in exchange for testimonials (especially video testimonials — see Principle 17). Then $18/month or $180/year for everyone after.

---

## 11. The Dieter Rams gut-check

Before shipping any feature, ask:

1. **Is it innovative?** Does it solve a problem that wasn't solved before? *(Auto-classification with confidence + accountant hand-off — yes.)*
2. **Does it make the product useful?** Not just possible — useful. *(Cut anything that's "nice to have" and not "I'd pay for this.")*
3. **Is it aesthetic?** *(Off-white, one accent color, one typeface, generous whitespace, no gradients.)*
4. **Does it make the product understandable?** *(A user should know what every screen does in 5 seconds.)*
5. **Is it unobtrusive?** *(The interface is invisible until needed.)*
6. **Is it honest?** *(Never claim "AI tax expert." Always show confidence. Always point to "confirm with CPA.")*
7. **Is it long-lasting?** *(No trends. Build something that looks good in 5 years.)*
8. **Is it thorough down to the last detail?** *(Empty states, error states, edge cases.)*
9. **Is it environmentally friendly?** *(Don't ship features you don't need to maintain.)*
10. **Is it as little design as possible?** *(If you can remove an element and the screen still works, remove it.)*

---

## 12. Risks & open questions

**Build risks:**

- Plaid coverage of small banks is imperfect — some users won't be able to connect
- Claude classification accuracy on edge cases (cash, Venmo, weird MCCs) will need ongoing tuning
- Manual founder-led support (in lieu of Ask XT) scales linearly with users — fine for the first 200, painful at 1,000
- Federal-only positioning may frustrate users in high-tax states (CA, NY, NJ) who expected state coverage — manage expectations clearly in onboarding

**Business risks:**

- "Show savings before paywall" requires the classifier to be *good* on day one — bad first impression kills conversion
- Monthly + annual pricing creates more churn surface — every month is a chance for users to leave. Product must earn the renewal continuously.
- CPA hand-off is positioned as a moat but only matters if CPAs actually like the export format — get 5 CPAs to review before launch
- Without all-50-states, value perception in non-covered states is lower. The math: federal deductions are still ~85% of the win, but users won't always perceive it that way.

**Resolved decisions for v1:**

- **No referral program in v1.** Revisit in v1.1 once we have organic word-of-mouth signal.
- **XT is positioned as a product built by two builders with side hustles** — not a company. The About page, founder photos, and tone reflect this. "Hi, we're two builders who got tired of side-hustle tax panic, so we built the tool we wanted."
- **CPA advisor — in progress.** Finding one is a launch-blocker for credibility. Goal: signed advisor before public launch (Week 6).
- **Show-savings-before-paywall — confirmed.** Higher emotional impact than free trial; better conversion for our specific value prop (finding deductions you didn't know about).
- **Day-28 churn-mitigation email — confirmed for v1.** Sent to monthly subscribers 28 days into their cycle: "Here's what XT did for you this month — X transactions sorted, Y deductions found ($Z), W set aside for taxes." This is the single most important retention mechanic.

---

## 13. More opportunities to save the user time

The unified Transactions page + scope buttons + keyboard-first flow is the foundation. Here are additional time-savers, prioritized by build effort vs. value.

### Ship in v1 (small additions, big payoff)

**Ask-once-per-account permissions.** When a user connects a new bank/card, ask one question: *"Are all transactions from this account business, personal, or mixed?"* If they say "all business," every future transaction auto-classifies and skips review entirely. Eliminates the most painful per-transaction decisions for users with a dedicated business card.

**Auto-rules from decisions.** Every time a user hits `B` (apply to all from this merchant), XT silently creates a rule. Show these in Settings → Rules where users can review or remove them. Over 60 days, the review queue shrinks dramatically as the user trains the system.

**Apply-to-past on reclassification.** When a user re-categorizes a transaction, surface a one-tap toast: *"Apply to your 11 previous Notion charges?"* Confirmed as v1.

### Ship in v1.1 (high-value, slightly more work)

**W2 paystub upload.** One PDF → XT extracts YTD federal withholding and uses it in the tax estimate. Means W2+side users never have to manually tell us their withholding. Big quality-of-life win for the John persona.

**Year-end CPA package, auto-generated.** Every January 15, XT generates a clean PDF: total income, categorized deductions, supporting transaction list, mileage summary, prior-year comparison. One-click email to your CPA. Turns "tax season" into "forwarding an email."

**Predictive set-aside trajectory.** Instead of just "set aside $1,240 this month," show: *"At your current pace, you'll owe ~$8,400 in Q4. You've set aside $5,200 so far. Recommended: $1,240/mo through December."* Early warning system, no surprises.

### Ship in v2 (power features, defer)

**Voice triage on mobile.** Hold the mic on a transaction card, say "business" → done. Especially valuable for sorting 20 transactions while on the subway.

**Cohort-based smart defaults.** "Most freelance designers in your income bracket categorize Adobe as Software & Subscriptions, Line 18." Pre-fills Claude's classifier with cohort priors, dramatically improving day-one accuracy.

**Auto-detect IRS payments.** When a user pays via IRS Direct Pay, detect the transaction and update their tax-paid balance automatically. Eliminates manual entry.

**Mileage tracking via monthly prompt.** Once a month: *"Did you drive for work this month? About how many miles?"* Pulls from Plaid gas station / parking patterns to estimate. One question vs. a battery-eating background app.

**"Ask XT" conversational layer.** Originally planned for v1, deferred. Once classification is rock-solid (3+ months of production data), revisit. Will be the "wow" feature for v1.1 launch.

**Comprehensive How to Tax page + blog.** Both deferred to v1.1, written once we know what users actually ask via support. Becomes the SEO anchor and social-share centerpiece.

### What I would NOT build

- **Real-time GPS mileage tracking** (battery hog, surveillance vibes, low ROI)
- **Receipt OCR via photo upload** (people take 3 photos then stop)
- **Receipt forwarding via email** (drift from the wedge)
- **Audit defense** (legal exposure, marketing nightmare; partner with a service if needed)
- **Crypto tax** (whole different product; refer out to CoinTracker)
- **Investment / capital gains** (out of scope for the side-hustle wedge)
- **Subscription detection** (drift from the wedge)

---

## v1 spec at a glance

- **Get tax assistance and savings — without the time or hassle.**
- A tracker + advisor, not a filer
- For W2+side, freelancers, 1099, single-member LLCs
- Priced **$18/month or $180/year** — monthly default, annual saves $36
- **Federal-only** in v1; CA/NY/NJ/TX/FL added in v1.1 ~6 weeks later
- Built around a **unified Transactions page** with a "Needs review" filter — no separate Inbox
- Driven by **one-keystroke decisions**: B/D/P scope buttons + Schedule C dropdown for overrides
- Single AI recommendation per transaction; alternatives revealed only when needed
- Notified **just-in-time** so review piles never build up
- **Keyboard-first** end to end with a `Cmd+K` command palette
- **No conversational AI in v1** — you handle support manually as XT
- **Embedded contextual education** in the app, no blog or comprehensive education page in v1 (both deferred to v1.1)
- Designed in the **Apple + Notion + Rams aesthetic** with the 17 landing page principles
- Buildable in **6 weeks with 2 people**

The hardest discipline going forward is *resisting feature additions*. Every "what if we also..." is a tax on the simplicity that's the whole product. When in doubt: less, but better.

---

## v1 spec — build readiness checklist

Before kicking off Week 1, confirm:

**Decisions locked:**

- Pricing: $18/mo + $180/yr (annual saves $36)
- Personas: W2+side, freelancer, 1099, single-member LLC
- Geographic scope: US Federal only in v1
- Conversion mechanic: show savings before paywall
- Brand positioning: two builders with side hustles, not a company
- No referral program in v1
- No "Ask XT" conversational layer in v1
- No blog or "How to Tax" page in v1 (embedded contextual education only)
- Inbox merged into Transactions with "Needs review" filter
- Three scope buttons (B/D/P) on transaction triage card — no snooze, no skip
- Single AI Schedule C recommendation, alternatives on demand only
- 6 notification types including the day-28 churn-mitigation recap
- Keyboard-first interaction with `Cmd+K` command palette

**External dependencies to secure before/during Week 1:**

- Plaid Production tier account
- Anthropic API account with sufficient credits
- Stripe account with subscription products configured
- Resend account for transactional email
- Domain registered (expenseterminal.com)
- CPA advisor identified and signed (target: Week 4)
- 25 beta users committed from personal network

**Quality bars for launch:**

- Lighthouse score ≥ 95 on marketing site
- Classification confidence ≥ 0.85 on the top 50 most common merchants (test corpus)
- First-time user goes from signup to "savings reveal" in under 10 minutes (timed with 5 test users)
- All 6 notification emails reviewed for tone and accuracy
- CSV/PDF export reviewed by 5 CPAs
- Keyboard shortcuts documented in `?` overlay

**Out of scope for v1 (do not build):**

- Mobile app, receipt OCR, receipt forwarding, mileage tracking, multi-entity, crypto, voice input, browser extension, Slack/Discord, subscription detection, Ask XT, blog, comprehensive How to Tax page, state quarterly estimates

---

*Built less. Built better.*
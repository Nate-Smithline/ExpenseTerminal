# Handoff: In-App Checklist Onboarding

## Overview

A **getting-started checklist** onboarding for ExpenseTerminal (a budgeting + bookkeeping + tax app for people with both a W-2 job and self-employment income). Instead of a blocking full-screen wizard, the new user is dropped **straight into the app** with a guarded, lightweight checklist that walks them through the 5 setup steps. Each step opens a small modal "task sheet" with a simulated version of the real action; completing it checks the item off, advances a progress ring, and (optionally) awards XP. A ghosted skeleton of the real dashboard sits underneath so the user can see what fills in as they finish setup.

This is the direction the team chose over a pre-flow wizard. The whole point is **momentum without a wall**: the user can poke at the product immediately, and the checklist nudges rather than blocks.

The 5 setup tasks:
1. **Connect your first account** (pre-completed on load, to show momentum)
2. **Tag your first transaction** (teaches the Personal / Business / Partial tag — the core product concept)
3. **Set up your tax profile** (filing status + automatic quarterly set-aside)
4. **Build your first budget** (zero-based starter budget)
5. **Activate your membership / Subscribe** (trial start or direct subscribe)

---

## About the design files

The files in `/design/` are **design references built in HTML / CSS / React-via-Babel** — an interactive prototype showing intended look, layout, and behavior. They are **not production code to ship verbatim.** Recreate them in the target codebase using its established patterns. If no codebase exists yet, the parent ExpenseTerminal handoff recommends **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**; this onboarding maps cleanly onto that.

The prototype uses:
- React 18 + Babel Standalone from CDN (in-browser JSX, no build step)
- Plain CSS with `:root` custom properties (no preprocessor / no Tailwind)
- Local `useState` for all state; mock data hard-coded inside the components

**To preview:** open `design/Onboarding-Checklist.html` in a browser. The dark bar at the top is a **preview-only** variant switcher (Gamification: playful/subtle, Billing: trial/direct) — it is NOT part of the design; it just lets you see all four states. The real app mounts `<InApp>` inside its own shell.

---

## Fidelity

**High-fidelity.** Final colors, type, spacing, copy, and interactions. Carry hex codes, font sizes, weights, radii, and easing over exactly. Copy is final unless product says otherwise.

---

## Design tokens

All tokens are defined in `design/onb.css` under `:root` and are shared with the rest of ExpenseTerminal — use the same token names already in the codebase if they exist.

### Neutral surfaces & ink
| Token | Hex | Use |
|---|---|---|
| `--bone` | `#F9FAFB` | Page canvas |
| `--bone-2` | `#F3F4F6` | Sidebar / soft panels / muted bars |
| `--bone-3` | `#E5E7EB` | Dividers / track backgrounds |
| `--surface` | `#FFFFFF` | Cards |
| `--surface-2` | `#FAFAFA` | Hover / footer surface |
| `--ink` | `#202020` | Primary text + the active-nav / dark banner fill |
| `--ink-2` | `#374151` | Secondary text |
| `--ink-3` | `#6B7280` | Tertiary / metadata |
| `--ink-4` | `#9CA3AF` | Hint |
| `--ink-5` | `#D1D5DB` | Decorative (strike-through color) |
| `--border` | `#E5E7EB` | Default border |
| `--border-soft` | `#F3F4F6` | Subtle separators |
| `--border-firm` | `#D1D5DB` | Emphasized border |

### Brand families (semantic — never decorative)
Each family means something specific across the whole app.

| Family | Meaning | Key tokens |
|---|---|---|
| `forest` (PRIMARY) | Business / positive / done / growth | `--forest-deep #065F46`, `--forest #047857`, `--forest-mid #10B981`, `--forest-soft #A7F3D0`, `--forest-tint #D1FAE5`, `--forest-wash #ECFDF5` |
| `clay` | Personal / institutional | `--clay-deep #1E3A8A`, `--clay #1E40AF`, `--clay-soft #BFDBFE`, `--clay-tint #DBEAFE` |
| `wheat` | Income / inflow / informational / XP | `--wheat-deep #0369A1`, `--wheat #0EA5E9`, `--wheat-soft #BAE6FD`, `--wheat-tint #E0F2FE` |
| `ember` | Alert / negative / over-budget / badge counts | `--ember-deep #991B1B`, `--ember #DC2626`, `--ember-soft #FECACA`, `--ember-tint #FEE2E2` |

The icon "chips" beside each checklist task cycle these families purely for visual rhythm via helper classes: `.ic-forest`, `.ic-clay`, `.ic-wheat`, `.ic-ember`, `.ic-ink` (each = `{family}-tint` background + `{family}-deep` text).

### Typography
- **Sans:** `"Hanken Grotesk", -apple-system, BlinkMacSystemFont, sans-serif` — weights 400/500/600/700/800 (Google Fonts)
- **Mono:** `"JetBrains Mono", ui-monospace, monospace` — weights 400/500 (used for the `XP` count meter only)
- Global: `font-variant-numeric: tabular-nums`, body 15px / 1.45, `-webkit-font-smoothing: antialiased`

| Role | Size | Weight | Letter-spacing |
|---|---|---|---|
| Page title (`.pagehead h1`) | 30px | 600 | -0.025em (em inside = `--ink-3`, weight 400) |
| Checklist hero `h2` | 18px | 600 | -0.01em |
| Task title (`.cli__t`) | 15px | 600 | -0.01em |
| Task desc (`.cli__d`) | 12.5px | 400 | normal, `--ink-3` |
| Nav item | 14px | 500 | -0.005em |
| Button | 14px | 600 | -0.005em |
| Sheet title (`h3`) | 17px | 600 | -0.01em |
| XP / badge pills | 10.5px | 700 | 0.02em, UPPERCASE-ish |

### Radii
`--r-1 6px` · `--r-2 10px` (buttons, nav, sheets-inner) · `--r-3 14px` (cards, banners) · `--r-4 20px` (checklist container, modal sheet) · `--r-5 28px`. Pills/dots/rings use `999px`. Brand mark uses `4px`.

### Shadows
- `--shadow-card`: `0 1px 0 rgba(17,24,39,.04), 0 1px 2px rgba(17,24,39,.04)` (default card)
- `--shadow-pop`: `0 10px 30px -12px rgba(17,24,39,.18), 0 2px 6px rgba(17,24,39,.06)` (modal sheet)
- `--shadow-lift`: `0 24px 60px -24px rgba(6,95,70,.30), 0 6px 16px rgba(17,24,39,.06)` (selected plan)

### Motion
- `--ease`: `cubic-bezier(.2,.8,.2,1)` — hover / state
- `--ease-out`: `cubic-bezier(.16,1,.3,1)` — entrances
- Modal/sheet entry: `sheetIn` — 16px translateY + scale .98 → 1, opacity 0→1, 0.3s `--ease-out`
- Modal backdrop: fade 0.2s
- Checkbox fill: `checkPop` — scale .3 → 1, 0.3s `--ease-out`
- Progress ring fill: `stroke-dashoffset` 0.7s `--ease-out`
- Progress bars: `width` 0.6s `--ease-out`
- Confetti: `fall` — translateY 108vh + rotate 720deg, per-piece duration 2.2–4.0s

### Layout
Desktop-first, **min-width 1280px**. Two-column grid: **244px** sidebar + `1fr` main. Main content scrolls; sidebar is fixed. Mobile is out of scope for v1.

---

## Screen: the checklist app view

### Overall structure
`.app` = CSS grid `grid-template-columns: 244px 1fr`, full height, `--bone` background.

```
┌─────────────┬───────────────────────────────────────────┐
│  SIDEBAR    │  MAIN (scrolls)                            │
│  244px      │   • Trial / subscribe banner              │
│             │   • Page header (welcome)                 │
│  • brand    │   • Checklist card (ring + 5 task rows)   │
│  • nav (5)  │   • Ghost dashboard skeleton              │
│  • GS widget│                                           │
│  • profile  │   (Task sheet modal overlays MAIN)        │
└─────────────┴───────────────────────────────────────────┘
```

### Sidebar (`.side`)
- **Brand** (`.side__brand`): 30×30 `--forest` square, white "XT", 4px radius, weight 800 + "ExpenseTerminal" wordmark (15px / 700 / -0.02em).
- **Nav** (`.nav`): 5 items — Budget, Cash Flow, Tax, Review (with ember `3` badge), Accounts. Item = 18px icon + label, padding 9px/12px, radius 10px, gap 11px. Inactive: `--ink-2` on transparent; hover `--bone-3` bg + `--ink`. **Active = dark pill** (`--ink` bg, `--bone` text). In this onboarding the **first nav item is rendered active** for display only — production keeps the user's real route active. Badge pill: `--ember-tint` bg / `--ember-deep` text, 10.5px / 700.
- **Getting-started widget** (`.gswidget`): a card pinned under the nav — small 42px progress **Ring** + "Getting started" / "N of 5 complete" text, and a thin progress bar (`--forest` fill). When all done → "All set!" / "You finished setup". This widget is the **persistent re-entry point** to the checklist once the user scrolls into the real app.
- **Profile chip** (`.side__profile`, `margin-top:auto`): 32px `--forest` avatar circle ("NS") + name "Nathan Smith" + "Profile & settings" sub.

### Trial / subscribe banner (`.trialbar`)
Full-width banner at the top of MAIN. Two visual states:
- **Not subscribed** — dark gradient (`linear-gradient(100deg, var(--ink), #2b3a36)`), white text. 38px rounded icon tile (clock), title + sub, and a right-aligned primary button. Copy depends on the **billing** variant:
  - `trial`: *"You're on a free trial — 30 days left"* · button "Choose your plan"
  - `direct`: *"Free preview — subscribe to unlock everything"* · button "Subscribe — $18/mo"
- **Subscribed** (`.is-sub`) — `--forest-wash` bg, `--forest-soft` border, `--forest-deep` text, check icon, no button. Copy: trial → "Membership active — welcome aboard"; direct → "You're subscribed".

The button opens the **Subscribe task sheet** (same as task #5).

### Page header (`.pagehead`)
- `h1`: *"Welcome, Nathan."* + muted em *"Let's get you set up."* (30px / 600).
- `p`: *"Finish these 5 steps to unlock the full picture — it takes about three minutes."*

### Checklist card (`.cl`)
Rounded-20px `--surface` card, `--shadow-card`.

**Header (`.cl__hd`)** — subtle radial `--forest-wash` glow top-left:
- 56px progress **Ring** showing percent label (e.g. "40%").
- Title: "Your setup checklist" → "Setup complete" when done. Sub: "N steps left to a clean, tax-ready ledger".
- **(playful only)** right-aligned reward readout (`.cl__reward`): "Next reward" + the next task's reward in `--forest-deep` bold; when complete shows "70 XP earned / Setup master unlocked".

**Task rows (`.cli`)** — one per task, separated by `--border-soft`:
- **Checkbox** (`.cli__check`): 28px circle, 2px `--border-firm`. When done → `--forest` fill + white check (`checkPop` animation).
- **Icon tile** (`.cli__ic`): 38px rounded-10, colored per `.ic-*` helper.
- **Text**: title row (`.cli__t`) + description (`.cli__d`). **(playful)** an `XP` pill (`+10`/`+15`/`+25`, `--wheat-tint`/`--wheat-deep`) sits next to the title while incomplete.
- **Action** (`.cli__act`): incomplete → primary "Start →" button (task #5 says "Choose plan" or "Subscribe"); complete → green "✓ Done" label. Completed rows get `--bone` bg + strike-through title (`--ink-5` strike color) + muted text.

**Tasks** (id · title · description · icon · reward · XP):
| id | Title | Desc | reward shown next | XP |
|---|---|---|---|---|
| `connect` | Connect your first account | Link a bank or card — transactions flow in automatically. | Unlocks live transactions | +10 |
| `tag` | Tag your first transaction | Learn the one-tap Personal / Business / Partial split. | Starts your Schedule C | +15 |
| `tax` | Set up your tax profile | Filing status + automatic quarterly set-aside. | Tax autopilot on | +10 |
| `budget` | Build your first budget | Give every dollar a job for the month. | Zero-based budget ready | +10 |
| `sub` | *trial:* Activate your membership / *direct:* Subscribe to keep going | *trial:* Your free trial is live — lock in your plan anytime. / *direct:* Unlock everything for $18/mo. | Full access, forever | +25 |

`connect` starts **pre-completed** on load (1 of 5) to show momentum.

### Ghost dashboard skeleton (`.ghost`)
Below the checklist: 3 skeleton cards at 0.55 opacity (gray bars) + centered caption *"Your dashboard fills in as you complete setup."* Pure affordance — hints that the real product is right there.

---

## Task sheets (the per-step modals)

Clicking **Start** opens `TaskSheet` — a centered modal (`.modal` backdrop with blur, `.sheet` 460px max-width card). Header = colored icon tile + task title + description + ✕ close. Footer = "Maybe later" (soft) + "✓ Mark complete" (primary). Each sheet body is a **lightweight simulation** of the real action (no real integration in the prototype):

1. **Connect (`ConnectBody`)** — "Choose an institution to link securely via Plaid." 2×2 grid of bank buttons (Chase / Ally / Amex / Capital One), each a colored letter tile + name; selecting one shows a check. *(Production: launch real Plaid Link.)*
2. **Tag (`TagBody`)** — one transaction card ("Verizon Wireless · $88.00") with an AI hint row ("Often a partial split for freelancers") and the **MarkerPicker** (Personal / Partial / Business segmented control — the core product control). *(Production: this is the real tag control from the Budget/Review screens.)*
3. **Tax (`TaxBody`)** — filing-status segmented control (Single / Married / HoH) + a `.setaside` panel showing the auto quarterly set-aside ($1,070) with a toggle.
4. **Budget (`BudgetBody`)** — "We drafted a starter budget from your activity." 4 rows (Needs / Wants / Business / Tax set-aside) each = color dot + label + proportional bar + dollar amount.
5. **Subscribe (`SubBody`)** — two plan options (`.planopt`): Monthly **$18/mo**, Annual **$15/mo** (`$180/yr`, "SAVE 17%" pill). Radio-style selection; trust line: "Free for 30 days, then … · cancel anytime" (trial) or just the price (direct). *(Production: Stripe checkout.)*

On **Mark complete**, the task is checked, ring/bars advance, sheet closes. Completing **all 5** (playful only) fires **confetti** for 4s.

---

## Interactions & behavior

- **Open a task:** `Start` → set `openTask = taskId` → render `TaskSheet`. Backdrop click or ✕ closes (`openTask = null`). "Maybe later" also closes without completing.
- **Complete a task:** `complete(id)` adds `id` to the `done` map, closes the sheet. Progress (`doneCount`, `pct`), the ring, the sidebar widget bar, and the reward readout all derive from `done` and update reactively.
- **Subscribe banner button** opens the same `sub` sheet; completing it flips the banner to its subscribed state.
- **All-complete celebration (playful):** when `doneCount === 5`, set `burst = true` for 4s → `<Confetti>` (64 falling pieces, colors `#047857 #10B981 #0EA5E9 #1E40AF #A7F3D0 #BAE6FD`). Subtle variant: no confetti, no XP pills, no reward readout.
- **MarkerPicker** (in the tag sheet): 3-button segmented control; selecting sets `data-on` and recolors to the marker's family (Personal=clay, Business=forest, Partial=split). This is the same primitive used elsewhere in the app.
- **Hover:** buttons + nav transition `background`/`color` 0.15s on `--ease`. Cards don't lift.
- **Progress ring** (`Ring` in `shared.jsx`): SVG, two circles (track `--bone-3`, fill `--accent` with `stroke-dasharray`/`stroke-dashoffset`), rotated -90°, centered numeric/percent label.

---

## The two design variants (`tweaks`)

`<InApp tweaks={{ gamify, billing }} />` takes two flags. In the prototype they're driven by the preview bar; in production they map to product/experiment config (or could be removed once a direction is locked).

| Flag | Values | Effect |
|---|---|---|
| `gamify` | `"playful"` (default) / `"subtle"` | playful = XP pills on tasks, the reward readout, and the completion confetti. subtle = none of those (same flow, calmer). |
| `billing` | `"trial"` (default) / `"direct"` | trial = "free trial / 30 days" framing, task #5 = "Activate your membership". direct = "subscribe to unlock" framing, task #5 = "Subscribe to keep going". |

(The prototype also accepts `annualDefault: boolean`; not used by the checklist directly.)

---

## State management

All local `useState` in the prototype. For production:

**Persist (server / per-user onboarding record):**
- `completed_steps` — which of the 5 tasks are done (so the checklist survives reload / appears in the sidebar widget until finished)
- `subscription` — plan + trial status (drives the banner and task #5; likely Stripe)
- The **actual side effects** of each step are real product writes: Plaid connection (`connect`), a tagged transaction (`tag`), tax profile (`tax`), the first budget (`budget`).

**Client / UI:**
- `openTask` — which sheet is open
- transient celebration (`burst`) flag
- the `gamify` / `billing` variant (from config, not user-editable)

**Derived on render:** `doneCount`, `pct`, `allDone`, "N steps left", next reward, whether the banner shows subscribed state.

**Suggested completion logic:** a step counts as done when its real underlying state exists (≥1 connected account, ≥1 tagged txn, a saved tax profile, ≥1 budget, an active sub/trial) — not just because the user clicked "Mark complete." The prototype fakes this with the `done` map; wire it to real data so the checklist reflects reality even if the user did the action elsewhere in the app.

---

## Components (where to look)

| Component | File | Notes |
|---|---|---|
| `InApp` | `design/checklist.jsx` | The whole screen: sidebar + main + checklist + ghost. Top-level. |
| `TaskSheet` + `ConnectBody` / `TagBody` / `TaxBody` / `BudgetBody` / `SubBody` | `design/checklist.jsx` | The 5 modal task bodies. |
| `Icon`, `Mark`, `Ring`, `MarkerPicker`, `Confetti`, `USD` | `design/shared.jsx` | Shared primitives. `Icon` is an inline-SVG set keyed by name; `Ring` is the progress ring; `MarkerPicker` is the Personal/Business/Partial control. |
| Styles | `design/onb.css` | Tokens in `:root`; the checklist lives under the **"DIRECTION B — IN-APP CHECKLIST"** section. The task-sheet body styles (`.bank`, `.tagcard`, `.mpick`, `.opt`, `.setaside`, `.toggle`, `.planopt`, …) are shared with the wizard and sit higher in the file. |

> Note: `onb.css` also contains a second onboarding direction (a pre-flow wizard, prefixed `.pf`) that this handoff does **not** use — you can ignore those rules, or strip them when porting.

## Assets
None beyond the two Google Fonts. The brand mark is drawn in CSS (`.mark` — a forest square with "XT"), not an image. Icons are inline SVG (`shared.jsx`), so map them to your codebase's icon set (or paste the paths).

## Files in this bundle
```
design/
  Onboarding-Checklist.html   — entry; preview-only variant bar + mounts <InApp>
  onb.css                     — tokens + all checklist + task-sheet styles
  shared.jsx                  — Icon / Mark / Ring / MarkerPicker / Confetti / USD
  checklist.jsx               — InApp + TaskSheet + the 5 task bodies
```
Open `design/Onboarding-Checklist.html` directly in a browser to preview (React + Babel load from CDN; no build step).

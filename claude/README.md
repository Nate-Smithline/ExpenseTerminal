# Handoff: ExpenseTerminal — Marketing Landing Page

A single-page marketing site for **ExpenseTerminal**, the budgeting + bookkeeping + tax app for side-hustlers with both a W-2 day job and self-employment income. The page's job: communicate the product's primary features and benefits, sell the *feeling* (peace of mind, quiet intelligence, hours back), and justify the $18/mo price.

The reference design lives at `/design/Landing.html` — a **fully working, self-contained HTML file** (no build step, no dependencies except Google Fonts). Open it in a browser to see the final intended result. **It is high-fidelity: recreate it pixel-for-pixel.** Every color, size, and spacing value below is intentional.

---

## About the reference file

- Plain HTML + a single inline `<style>` block. No framework, no preprocessor.
- One small inline `<script>` at the bottom — an `IntersectionObserver` that adds the `.in` class to `.reveal` elements as they scroll into view (fade + 14px rise).
- Google Fonts: **Hanken Grotesk** (400–800) and **JetBrains Mono** (400/500).
- The reference is the source of truth for exact markup. This doc explains *intent* and *structure* so you can rebuild it in your target stack.

## Recommended target stack

If building fresh: **Next.js (App Router) + TypeScript + Tailwind CSS**. The token table below maps cleanly onto `tailwind.config` `theme.extend.colors`. Each section is a natural React component. The scroll-reveal is a 10-line `useEffect` + `IntersectionObserver`, or use `framer-motion`'s `whileInView`. Keep it static/SSG — there's no dynamic data.

This is a marketing page — match the **main app's** design system (the app handoff covers it), since this page deliberately reuses its tokens, brand mark, and the Personal/Business/Partial marker pills.

---

## Design tokens

All defined in `:root` in the reference. Carry forward verbatim.

### Neutrals
| Token | Hex | Use |
|---|---|---|
| `--bone` | `#F9FAFB` | Page background |
| `--bone-2` | `#F3F4F6` | Soft panels / partial pill bg |
| `--bone-3` | `#E5E7EB` | Dividers |
| `--surface` | `#FFFFFF` | Cards |
| `--surface-2` | `#FAFAFA` | Pricing section bg |

### Ink (text)
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#202020` | Primary text + dark band bg |
| `--ink-2` | `#374151` | Body text |
| `--ink-3` | `#6B7280` | Secondary / captions |
| `--ink-4` | `#9CA3AF` | Hints / strikethrough |
| `--ink-5` | `#D1D5DB` | Decorative / text on dark |

### Borders
`--border #E5E7EB` · `--border-soft #F3F4F6` · `--border-firm #D1D5DB`

### Brand (semantic — same as the app)
| Family | Meaning | Key values |
|---|---|---|
| **forest** (PRIMARY) | business / positive / brand | `--forest-deep #065F46`, `--forest #047857`, `--forest-mid #10B981`, `--forest-soft #A7F3D0`, `--forest-tint #D1FAE5`, `--forest-wash #ECFDF5` |
| **clay** | personal | `--clay-deep #1E3A8A`, `--clay #1E40AF`, `--clay-soft #BFDBFE`, `--clay-tint #DBEAFE` |
| **wheat** | income / informational | `--wheat-deep #0369A1`, `--wheat #0EA5E9`, `--wheat-soft #BAE6FD`, `--wheat-tint #E0F2FE` |
| **ember** | alert / cost / negative | `--ember-deep #991B1B`, `--ember #DC2626`, `--ember-soft #FECACA`, `--ember-tint #FEE2E2` |

### Radii
`--r-1 6px` · `--r-2 10px` (buttons) · `--r-3 14px` (cards) · `--r-4 20px` · `--r-5 28px`. Brand mark uses **4px**.

### Shadows
- `--shadow-card`: `0 1px 0 rgba(17,24,39,.04), 0 1px 2px rgba(17,24,39,.04)` — default card
- `--shadow-pop`: `0 10px 30px -12px rgba(17,24,39,.18), 0 2px 6px rgba(17,24,39,.06)`
- `--shadow-lift`: `0 24px 60px -24px rgba(6,95,70,.28), 0 6px 16px rgba(17,24,39,.06)` — hero mockup + pricing card (note the **forest-tinted** ambient shadow)

### Motion
- `--ease`: `cubic-bezier(.2,.8,.2,1)` — hovers
- `--ease-out`: `cubic-bezier(.16,1,.3,1)` — scroll reveals
- Hover transitions: `.15s`. Reveal: opacity + 14px translateY over `.7s`.

### Type
- **Sans:** Hanken Grotesk. **Mono:** JetBrains Mono (used for step numbers, Schedule C line numbers).
- Global `font-variant-numeric: tabular-nums` so all dollar figures align.
- `text-wrap: balance` on big headings.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Hero H1 | 60px (40px mobile) | 700 | -.035em |
| Section H2 | 40px (30px mobile) | 700 | -.03em |
| Final CTA H2 | 46px (32px mobile) | 700 | -.03em |
| Hero sub | 19px | 400 | — |
| Section sub | 18px | 400 | — |
| Eyebrow | 11px | 600 | .18em, UPPERCASE, `--ink-3` |
| Card H3 | 17–18px | 600 | -.01em |
| Body | 14–14.5px | 400 | — |
| Button | 14–15px | 600 | -.005em |
| Pill | 11.5px | 600 | — |

### Layout
- `.wrap`: `max-width 1160px`, `padding 0 32px`, centered.
- Section vertical padding: `96px` (64px mobile); final CTA `104px`; hero `80px 0 64px`.
- Responsive breakpoints used: **880px** (grids → 1 col, hide nav links) and **760px** (type shrinks).
- Fully responsive down to mobile — unlike the app, this page must work on phones.

### Buttons
- `.btn--primary`: `--forest` bg, white text → hover `--forest-deep`.
- `.btn--ghost`: transparent, `--ink-2` text, `--border-firm` border → hover white bg, `--ink` text.
- `.btn--lg`: `14px 24px` padding, 15px. Radius `--r-2`. Inline 16px arrow/check SVGs.

### Brand mark
32×32 (40 large) square, `--forest` bg, white **"XT"**, weight 800, **4px** radius, -.03em tracking.

---

## Page structure (top → bottom)

### 1. Nav (sticky)
Sticky top bar, `rgba(249,250,251,.82)` + `backdrop-filter: blur(12px)`, bottom hairline. Left: brand mark + "ExpenseTerminal". Center: anchor links (Features / Why it matters / How it works / Pricing) — **hidden below 880px**. Right: "Sign in" (ghost) + "Start free" (primary).

### 2. Hero
- Forest "pill" badge: *Built for the W-2 + side-hustle life* (forest-wash bg, forest-soft border, pulsey dot).
- H1: **"One ledger for your *life* and your *hustle*."** — the two italicized words use `<em>` styled non-italic in `--forest`.
- Sub paragraph, then two CTAs (primary "Start free for 30 days" with arrow + ghost "See how it works"), then a reassurance note with a checkmark (*No card required · Bank-level encryption · Connects via Plaid*).
- **Hero scene** (`.scene`, 2-col `1.15fr / .85fr`, stacks at 880px):
  - **Left card** (`--shadow-lift`): "This week's activity" + an "Auto-sorted" flow chip. Four transaction rows, each a 3-col grid (vendor+date | marker pill | amount). The four rows demo all marker states: Business, Personal, **Partial** (with the split-bar pill), and a positive Business inflow (forest amount, `+$2,400.00`).
  - **Right card**: "Schedule C · live" — mono line numbers (L8/L18/L25/L27), values, a bold "Net profit · YTD $18,640" total row (1.5px `--ink-5` top border), and a forest checkmark caption.

### 3. Trust strip
Thin bordered band, centered row: *Connects to 12,000+ banks · Powered by Plaid · Built around the IRS Schedule C · Bank-level encryption*, separated by tiny dots. Bold spans in `--ink-2`.

### 4. Features `#features`
Head: *"Four jobs. One tag. Zero double-entry."* Then a 2×2 card grid (`.feat`, 1 col below 760px). Four cards, each = a colored icon tile (forest / clay / wheat / ember tints) + H3 + paragraph:
1. **Personal · Business · Partial** (forest)
2. **Zero-based budgeting** (clay)
3. **A Schedule C that writes itself** (wheat)
4. **Set-aside on autopilot** (ember)

### 5. Peace-of-mind band `#peace` (DARK)
`--ink` background, light text. Head in white with a `--forest-mid` eyebrow: *"We don't sell a spreadsheet. We sell the feeling of being on top of it."* Then a 3-col grid (`.pom`, 1 col mobile):
- **Peace of mind** (shield icon) · **Quiet intelligence** (lightbulb) · **Hours back** (clock). Icons sit in translucent-white tiles, forest-mid colored.
Below, separated by a faint rule: three big stats — **~9 hrs** saved · **$1,300+** deductions caught · **0 surprises** — the units/“+” in `--forest-mid`.

### 6. How it works `#how`
Head: *"Connect once. Tag as you go. Done by April."* Three numbered step cards (`STEP 01/02/03` in mono forest): Link your accounts · Tag in seconds · Watch taxes handle themselves.

### 7. Pricing `#pricing`
`--surface-2` bg with top/bottom hairlines. Head: *"One plan. Less than a single billable hour."* Two-col (`1.1fr / .9fr`, stacks at 880px):
- **Plan card** (`--shadow-lift`): "30 days free" tag (top-right, forest-tint), price **$18 / month**, sub, then a 6-item checklist (forest checkmarks), then a full-width primary "Start your free trial" button.
- **"Why it's worth it" card** (forest-wash bg, forest-soft border): explanatory paragraph + a "math" stack comparing **Bookkeeper $250 / Year-end cleanup $400 / Missed deductions $1,300** (all struck-through in `--ink-4`) against a forest total row **ExpenseTerminal $18/mo**. Closing line about the partial-split phone bill paying for itself.

### 8. Final CTA
Centered. H2: *"Your books, finally caught up — and staying that way."* + sub + the two hero CTAs + reassurance note.

### 9. Footer
Brand mark + links (Features / Pricing / Security / Support), then fine print copyright with the Plaid + "estimates, confirm with your CPA" disclaimer.

---

## Interactions
- **Scroll reveal:** elements with `.reveal` start at `opacity:0; translateY(14px)`; an `IntersectionObserver` (threshold .12, `rootMargin 0 0 -40px 0`) adds `.in` once, then unobserves. Honor `prefers-reduced-motion` in production by skipping the transform.
- **Sticky nav** with blur backdrop.
- **Hovers** only — no other JS. Anchor links smooth-scroll (`scroll-behavior:smooth`).

## Notes for production
- All copy and figures are **illustrative placeholders** — the $18 price matches the app's billing, but the stats (~9 hrs, $1,300+, 12,000+ banks) and the cost-comparison numbers should be replaced with verified marketing claims before launch.
- The "XT" brand mark is pure CSS/text — no image asset needed. If a real logo lands, swap the `.mark` element.
- Replace anchor `href="#"` CTAs with real signup/sign-in routes.
- Add real `<meta>` OG/Twitter tags, favicon, and analytics for launch.
- Accessibility: the decorative SVGs should get `aria-hidden`; ensure the dark band keeps AA contrast (it does at these values).

## Files in this bundle
```
design/
  Landing.html   — the complete reference page (open in any browser; pixel-perfect target)
README.md        — this spec
```

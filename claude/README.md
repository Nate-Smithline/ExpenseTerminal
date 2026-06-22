# ExpenseTerminal — Landing Page

Static, dependency-free landing page. Build it exactly as the three files describe.

## Files
- `index.html` — markup + inline JSON-LD (SEO/AEO structured data). Loads `site.css` and `landing.js`.
- `site.css` — all styles. CSS custom-property design tokens live in `:root` at the top (colors, radii, shadows, easing). The landing-specific component styles are under the `NEW LANDING` banner near the bottom.
- `landing.js` — vanilla JS (no framework, no build step). Powers: scroll reveals, the interactive swipe demo (drag + buttons + arrow keys), the deduction/tax-saved count-ups, the community goal bar, and the demo-form confirmation.

## Run
Open `index.html` in a browser, or serve the folder statically:
```
npx serve .
```
No bundler or install required.

## Dependencies
- Google Fonts via CDN: **Hanken Grotesk** (UI) and **JetBrains Mono** (numbers/labels). Linked in `<head>`. Self-host if you prefer.
- No JS libraries. ES5-compatible vanilla JS.

## Notes for the build
- **Single source of truth for color/spacing** is the `:root` token block in `site.css` — change brand colors there, not per-component.
- The swipe demo's sample transactions are the `DECK` array at the top of `landing.js`; the blended tax rate is `TAX_RATE` (0.25).
- The demo form is intentionally **front-end only** — `landing.js` calls `preventDefault()` and shows an inline success state. Wire `#demoForm` submit to your real endpoint to make it functional.
- **Illustrative data to replace with real values:** the community savings figure ($68,400 / $100k goal in the Mission section), the pricing comparison math, and the three empty client-quote cards (`.qcard`).
- `index.html`'s nav/footer link to `case-studies.html` and `cases/*.html`, which are **not** part of this export — either build those pages or remove the links.

## Accessibility / SEO already in place
- Semantic landmarks and heading hierarchy.
- SoftwareApplication + FAQPage JSON-LD in `index.html`.
- `aria-label`s on swipe controls; keyboard support (left / right / down arrows); `prefers-reduced-motion` honored for reveals.

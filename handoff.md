# Handoff — step-capture-studio
_Last updated: 2026-07-21 · Current stage: stage-1-foundation_

## 🎯 Goals
Close out Stage 1's remaining verification (screen reader, axe-core, a human actually looking at the
page), then start Stage 2's authoring layer.

## 📍 Current State
- **`docx-reader` and `snagit-parser` are `verified done`** — 29/29 tests, plus a real browser run in
  Chromium 148: the 843 KB sample loads through the actual file input and renders 10 steps / 10
  images at 1040×596, with exactly the 2 known duplicates flagged.
- **Risk #4 is retired:** `DecompressionStream('deflate-raw')` confirmed working in-browser. The
  zero-dependency architecture is proven, not assumed.
- **`app-shell` is `awaiting verification`** — contrast (light + dark), 320 px reflow, heading order,
  focus order, alt coverage and live regions all measured and passing. **But nobody has looked at
  the page**: the screenshot tool timed out on every attempt, including on a blank page.
- Repo `<your-account>/step-capture-studio` is private. Pages deliberately not enabled — see `help.md` 2b.

## 📂 Files I'm Working On
- `index.html`, `src/ui/app.js`, `src/ui/styles.css` — the shell, awaiting verification.
- `src/lib/i18n.js` — EN-CA/FR-CA strings. **French is an unreviewed draft** (`help.md` item 7).
- `tools/serve.mjs` — dev-only static server; `npm start` → localhost:8080.

## ✅ Things I've Changed
- 2026-07-21 — Built the app shell: accessible loader, bilingual rendering, live regions.
- 2026-07-21 — Fixed two AA defects found in browser: WCAG 3.1.2 language-of-parts on fallback text,
  and a contradictory `role="status"` + `aria-live="assertive"` pairing.
- 2026-07-21 — Added `src/lib/i18n.js` and a zero-dependency dev server.
- 2026-07-21 — `docx-reader` and `snagit-parser` verified done in a real browser.
- 2026-07-21 — Created and pushed the private GitHub repo.

## ❌ Watch Out
- **Nobody has visually seen this UI.** Every check so far is programmatic; layout could be wrong in
  ways measurement misses. Open http://localhost:8080 before trusting it.
- Word splits paragraph text across `<w:t>` runs; always concatenate. Covered by a test.
- The bundled French is machine-drafted and unreviewed — do not ship it to learners as-is.

## ➡️ Next Up
1. Run `npm start` and **look at the page** — the rendered-demo half of the verification convention.
2. Wire axe-core as a devDependency and assert zero violations, replacing the manual checks.
3. Screen-reader pass if NVDA/Narrator is available (`help.md` item 6), else leave it blocked.
4. Then Stage 2: `feature-step-editor` and `feature-alt-text`.

## 🔗 Pointer
→ Current stage folder: `staging/stage-1-foundation/` · Active feature file:
`staging/stage-1-foundation/feature-app-shell.md`

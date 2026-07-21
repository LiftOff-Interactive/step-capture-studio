# Handoff — step-capture-studio
_Last updated: 2026-07-21 · Current stage: stage-1-foundation_

## 🎯 Goals
Close the last of Stage 1's verification — a human actually looking at the page, and a screen-reader
pass — then start Stage 2's authoring layer.

## 📍 Current State
- **`docx-reader` and `snagit-parser` are `verified done`.** 41/41 tests. The real 843 KB sample
  renders 10 steps / 10 images at 1040×596 in Chromium 148, with exactly the 2 known duplicates flagged.
- **axe-core is wired in** — automated under jsdom across four states in both languages, plus
  in-browser runs (EN, FR, dark/mobile) at **0 violations and 0 needs-review**, `color-contrast`
  passing on 43 nodes.
- The a11y suite is **mutation-tested**: 7 injected defects, 7 caught, control clean. Its first
  version missed 3 of 6 — see `docs/decisions.md` and `CLAUDE.md` for what that taught us.
- **`app-shell` remains `awaiting verification`** — because **nobody has looked at the page**. The
  screenshot tool times out even on a blank page, so it is a tool fault, but the gap is real.
- Repo `<your-account>/step-capture-studio` is private. Pages not enabled — `help.md` 2b.

## 📂 Files I'm Working On
- `src/ui/render.js` — pure DOM builders; Stage 2's editor will re-render through these.
- `test/a11y.test.js` — axe harness. Read its header before changing the assertions.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` item 7).

## ✅ Things I've Changed
- 2026-07-21 — Wired axe-core + jsdom; hardened it after mutation testing exposed 3 blind spots.
- 2026-07-21 — Split DOM building out of `app.js` into `src/ui/render.js` so rendered states are testable.
- 2026-07-21 — Built the app shell; fixed two AA defects found in-browser (WCAG 3.1.2 language of
  parts; contradictory `role="status"` + `aria-live="assertive"`).
- 2026-07-21 — `docx-reader` and `snagit-parser` verified done in a real browser.
- 2026-07-21 — Created and pushed the private GitHub repo.

## ❌ Watch Out
- **Nobody has visually seen this UI.** axe proves contrast is sufficient, not that the design works.
  Run `npm start`, open http://localhost:8080.
- **Never assert only on axe `violations`** — dangling ARIA references land in `incomplete`. And
  mutation-test any new a11y assertion; the suite silently caught nothing at first.
- The bundled French is machine-drafted and unreviewed — do not ship it to learners as-is.

## ➡️ Next Up
1. Look at the page (`npm start`) — the rendered-demo half of the verification convention.
2. Screen-reader pass if NVDA/Narrator is available (`help.md` item 6), else record it as blocked.
3. Then Stage 2: `feature-step-editor` and `feature-alt-text`.

## 🔗 Pointer
→ Current stage folder: `staging/stage-1-foundation/` · Active feature file:
`staging/stage-1-foundation/feature-app-shell.md`

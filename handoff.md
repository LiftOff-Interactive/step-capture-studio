# Handoff — step-capture-studio
_Last updated: 2026-07-21 · Current stage: stage-2-authoring_

## 🎯 Goals
Finish Stage 2: the bilingual translation round trip and `localStorage` autosave, and close the
accessibility gap the editor left open.

## 📍 Current State
- **LIVE at https://mbubyn.github.io/step-capture-studio/** — public, MIT licensed, Pages serving
  from `main`/root. A `.docx` parses correctly there; zero console output.
- **Stage 1 complete except `app-shell`**, which is `awaiting verification` only because **nobody has
  looked at the page**. `docx-reader`, `snagit-parser`, `pages-deploy` are all `verified done`.
- **Stage 2:** `step-editor` and `alt-text` built, `awaiting verification`. 82 controls on the real
  capture, **0 axe violations, 0 needs-review**, contrast passing on 189 nodes, both languages.
- History was scrubbed before publishing: all 8 commits and every blob clean, old repo deleted and
  recreated rather than force-pushed. **79/79 tests.**

## 📂 Files I'm Working On
- `src/lib/authoring.js` — immutable capture operations + the export gate.
- `src/ui/editor.js` — the editable form; `fieldId` is exported for syncing controls without re-render.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` item 7).

## ✅ Things I've Changed
- 2026-07-21 — Published live: MIT licence, sanitised, history scrubbed, repo recreated public.
- 2026-07-21 — Built the editor UI; fixed two browser-only defects (see Watch Out).
- 2026-07-21 — Added `src/lib/authoring.js` and the alt-text confirmation gate.
- 2026-07-21 — Wired axe-core; hardened it after mutation testing exposed 3 blind spots.
- 2026-07-21 — Built the app shell; fixed two AA defects found in-browser.

## ❌ Watch Out
- **A correct model is not a correct UI.** The confirm checkbox stayed ticked after an edit that
  unconfirmed it; tests passed throughout. See `docs/failed-approaches.md`.
- **The repo is public now.** The pre-commit hook is the only thing between a real capture and a
  permanent public record. Never `--no-verify`.
- **Nobody has visually seen this UI.** axe proves contrast, not usability.

## ➡️ Next Up
1. Make the readiness count a live region — it changes silently for screen-reader users (unticked
   criterion in `feature-alt-text.md`).
2. `feature-bilingual-roundtrip`: copy-prompt export and strict paste-back import.
3. `feature-autosave` — decide its open question first: screenshots blow the ~5 MB `localStorage`
   quota, so text-only persistence or IndexedDB.

## 🔗 Pointer
→ Current stage folder: `staging/stage-2-authoring/` · Active feature file:
`staging/stage-2-authoring/feature-bilingual-roundtrip.md`

# Handoff — step-capture-studio
_Last updated: 2026-07-21 · Current stage: stage-2-authoring_

## 🎯 Goals
Finish Stage 2: the bilingual translation round trip and `localStorage` autosave, then close the
accessibility gaps the editor surfaced.

## 📍 Current State
- **Stage 1:** `docx-reader` and `snagit-parser` are `verified done`. `app-shell` is
  `awaiting verification` only because **nobody has looked at the page**.
- **Stage 2:** `step-editor` and `alt-text` are built and `awaiting verification`. The editor renders
  **82 controls** for the real capture with **0 axe violations, 0 needs-review**, `color-contrast`
  passing on 189 nodes, in both languages and after editing.
- Verified in-browser end to end: seed drafts → confirm → edit (resets confirmation) → merge
  duplicates → delete → undo. Merging keeps both screenshots; numbering re-derives.
- **79/79 tests.** Repo private, 5 commits pushed, Pages still off (`help.md` 2b).

## 📂 Files I'm Working On
- `src/lib/authoring.js` — immutable capture operations + the export gate.
- `src/ui/editor.js` — the editable form. `fieldId` is exported so controls can be synced without
  a re-render.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` item 7).

## ✅ Things I've Changed
- 2026-07-21 — Built the editor UI; fixed two browser-only defects (see Watch Out).
- 2026-07-21 — Added `src/lib/authoring.js` and the alt-text confirmation gate.
- 2026-07-21 — Wired axe-core; hardened it after mutation testing exposed 3 blind spots.
- 2026-07-21 — Built the app shell; fixed two AA defects found in-browser.
- 2026-07-21 — `docx-reader` and `snagit-parser` verified done in a real browser.

## ❌ Watch Out
- **A correct model is not a correct UI.** The confirm checkbox stayed ticked after an edit that
  unconfirmed it — tests passed throughout. See `docs/failed-approaches.md`.
- **Never use `null` as a sentinel where `??` will see it** — cost us focus management on merge and
  delete, silently. See `docs/failed-approaches.md`.
- **Nobody has visually seen this UI.** axe proves contrast, not usability. `npm start` →
  http://localhost:8080.

## ➡️ Next Up
1. Make the readiness count a live region — it currently changes silently for screen-reader users
   (an unticked criterion in `feature-alt-text.md`).
2. `feature-bilingual-roundtrip`: copy-prompt export and strict paste-back import.
3. `feature-autosave` — but first decide its open question: screenshots blow the ~5 MB
   `localStorage` quota, so text-only persistence or IndexedDB. Decide before writing it.

## 🔗 Pointer
→ Current stage folder: `staging/stage-2-authoring/` · Active feature file:
`staging/stage-2-authoring/feature-bilingual-roundtrip.md`

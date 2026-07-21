# Handoff — step-capture-studio
_Last updated: 2026-07-21 · Current stage: stage-1-foundation_

## 🎯 Goals
Finish Stage 1: an accessible page that loads a Snagit `.docx` and renders the parsed capture, so the
two modules already written can finally be verified in a real browser.

## 📍 Current State
- **`docx-reader` and `snagit-parser` are both written and passing** — 29/29 tests. The real 843 KB
  sample parses in 25.5 ms into 10 steps / 10 images at 1040×596, with all metadata resolved and
  exactly the 2 known duplicates flagged, zero false positives.
- Both sit at **`awaiting verification`, not done** — the browser half of their procedure needs a
  page that does not exist yet.
- Repo is live: `<your-account>/step-capture-studio`, **private**, both commits pushed.
- **Pages deliberately NOT enabled** — a Pages site on a private repo can be publicly reachable,
  which would contradict the "private until licensing clears" decision. See `help.md` item 2b.
- No UI exists yet. Nothing has run in a browser.

## 📂 Files I'm Working On
- `src/lib/docx.js`, `src/lib/parse-snagit.js` — written, awaiting browser verification.
- `src/lib/i18n.js` — next; every user-facing string must resolve through it.
- `index.html`, `src/ui/` — the app shell, not yet started.

## ✅ Things I've Changed
- 2026-07-21 — Wrote `src/lib/parse-snagit.js` + 16 tests; verified against the real sample.
- 2026-07-21 — Fixed a tautological test (`|| true`) that could never fail; added real coverage
  for the previously untested `ORPHAN_IMAGE` path.
- 2026-07-21 — Created and pushed the private GitHub repo.
- 2026-07-21 — Wrote `src/lib/docx.js` + 13 tests; verified against the real sample.
- 2026-07-21 — Scaffolded the full doc structure and staging tree.

## ❌ Watch Out
- `DecompressionStream` is proven in **Node, not a browser**. The whole zero-dependency architecture
  rests on it. Settle this first when the shell exists — use a local static server, not Pages.
- Word splits paragraph text across `<w:t>` runs; always concatenate. Covered by a test now.
- Only **one** sample capture exists. Keep parsing structural, never keyed off English verbs.

## ➡️ Next Up
1. Write `src/lib/i18n.js` with the EN-CA/FR-CA dictionary — before any UI, so no string is ever
   hardcoded and retrofitted later.
2. Build `index.html` + `src/ui/` app shell: accessible file input, drag-and-drop enhancement,
   `aria-live` announcements, rendered step list. AA from the first commit.
3. Serve locally, load the real sample in a browser, and record the browser verification that
   `docx-reader` and `snagit-parser` are both waiting on.

## 🔗 Pointer
→ Current stage folder: `staging/stage-1-foundation/` · Active feature file:
`staging/stage-1-foundation/feature-app-shell.md`

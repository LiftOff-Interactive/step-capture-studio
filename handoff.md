# Handoff — step-capture-studio
_Last updated: 2026-07-22 · Current stage: stage-4-ship_

## 🎯 Goals
Finish Stage 4: a shippable demo capture and public polish, so a stranger can use the live site.

## 📍 Current State
- **LIVE at https://mbubyn.github.io/step-capture-studio/** — public, MIT (repo recreated
  2026-07-22). **240/240 tests.** Verified against the live site, not just locally.
- **Editor is three Phases** — Worked example → Edit → Translation — export panel last; capture
  metadata (author/duration/date/steps) editable; "Case study" → **"Worked example"** everywhere.
- **Stages 1–3 complete.** Three HTML artifacts: self-contained, bilingual, readable with JS off,
  axe clean with contrast measured in a browser, and **all three print correctly** (author).
- **`.docx` verified against Word 16.0** — no repair prompt, real heading styles, alt text on every
  image, correct language EN/FR, title surviving a re-save, `CompatibilityMode=15`.
- **Bilingual throughout at last**: chrome, alt text, and the guide title all follow the toggle. The
  title is editable per language and rides the translation round trip.
- **Work is saved by exporting a project file**, not autosave — deleted deliberately, see
  `feature-autosave.md`. Closing the tab without exporting loses the session, with no warning.
- **A second, independent capture parses clean** — retires the master plan's risk #1 for English.
- Everything sits at `awaiting verification` because of human-only checks, not unfinished work.
  Exceptions: `docx-reader`, `snagit-parser`, `pages-deploy` are `verified done`.

## 📂 Files I'm Working On
- `src/lib/emit-project.js` + `parse-project.js` — a matched pair; the round-trip tests are the only
  thing keeping them honest.
- `src/lib/emit-common.js` — `langLabel`, `captureTitle`, `documentHeader`; shared by five emitters.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` 7).

## ✅ Things I've Changed
- 2026-07-22 — **UI restructured into phases** (Worked example → Edit → Translation), editable
  capture metadata, "Load a file", export panel moved to the bottom, "Case study" → "Worked example".
- 2026-07-22 — **Translation prompt now covers the whole worked example** — scenario + narrative +
  alt text + title, not step text alone.
- 2026-07-22 — Bilingual guide title: editable field per language, plus the translation round trip.
- 2026-07-22 — Portable project file replaces autosave; state rides visible `data-` attributes.
- 2026-07-22 — Image format detected from bytes, not assumed PNG; demo downscaled 2.9→0.27 MB.

## ❌ Watch Out
- **A correct model is not a correct UI, and valid markup is not accepted markup.** Every session
  driving a real browser or Word found a defect the green suite could not see.
  → read `docs/failed-approaches.md` before debugging anything.
- **A green suite can sit on top of an unusable UI.** Editor tests build nodes in isolation and never
  exercise the in-place syncing `app.js` does between renders — twice that seam shipped a bug with
  every test passing. → `failed-approaches.md`, "disabled state only updates on re-render".
- **Clear a capture by the whole frame, not its subject.** The demo shipped a personal email in a
  Settings screenshot because the review checked what each shot was *of*, not the account panel/
  taskbar around it. → `failed-approaches.md`, "Reviewing a screenshot's subject but not its
  surroundings". Once public, a crop does not undo it — history/CDN keep the original.

## ➡️ Next Up
1. **Re-run Word's Accessibility Checker** (`help.md` 3b) — hard-refresh the live site first; both
   previous attempts graded pre-fix files. Last unticked `.docx` criterion.
2. `feature-demo-capture` — capture parses clean; ships as a project file the app can load.
3. `feature-public-polish` — README screenshots and contribution notes.
4. Plural forms ("1 items") — needs `Intl.PluralRules`, not string patching.

## 🔗 Pointer
→ Current stage folder: `staging/stage-4-ship/` · Active feature file:
`staging/stage-4-ship/feature-demo-capture.md`

# Handoff — step-capture-studio
_Last updated: 2026-07-29 · Current stage: stage-4-ship_

## 🎯 Goals
Finish Stage 4: a shippable demo capture and public polish, so a stranger can use the live site.

## 📍 Current State
- **LIVE at https://liftoff-interactive.github.io/step-capture-studio/** — public, MIT (repo
  recreated 2026-07-22, moved to the `LiftOff-Interactive` org 2026-08-01; the old
  `mbubyn.github.io` address is gone). **272/272 tests.** Autosave, replace-image, and the
  all-in-one dashboard shipped and verified live 2026-07-24.
- **2026-07-29: full UI redesign to the PowerPoint mock-ups** — teal shell, phase nav
  (6 stages), per-phase instructions panel, step chips (one step at a time), header
  "Export project file" button, Tabbed/Linear toggle, all-in-one restyled. **Pushed and confirmed live**
  (Cam approved the push 2026-07-29; the deployed page serves the new markup). Cam's hands-on
  pass of the live site is still worth doing. See `staging/stage-4-ship/feature-ui-redesign.md`.
- **Editor is three Phases** — Worked example → Edit → Translation — export panel last; capture
  metadata (author/duration/date/steps) editable; "Case study" → **"Worked example"** everywhere.
- **Stages 1–3 complete.** Three HTML artifacts: self-contained, bilingual, readable with JS off,
  axe clean with contrast measured in a browser, and **all three print correctly** (author).
- **`.docx` verified against Word 16.0** — no repair prompt, real heading styles, alt text on every
  image, correct language EN/FR, title surviving a re-save, `CompatibilityMode=15`.
- **Bilingual throughout at last**: chrome, alt text, and the guide title all follow the toggle. The
  title is editable per language and rides the translation round trip.
- **Autosave (2026-07-24) saves the whole session to `localStorage`** and offers to restore it next
  visit; a "Leave site?" prompt fires on close with unexported edits. See `feature-autosave.md`.
- Everything sits at `awaiting verification` (human-only checks, not unfinished work); exceptions
  `docx-reader`, `snagit-parser`, `pages-deploy` are `verified done`. (2nd capture parses clean too.)

## 📂 Files I'm Working On
- `src/lib/emit-all-in-one.js` (+ test) — composes the other emitters into one dashboard; each
  artifact embedded whole in an `<iframe srcdoc>`.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` 7).

## ✅ Things I've Changed
- 2026-07-24 — **"All-in-one" dashboard**: one self-contained page — 3 HTML artifacts in isolated
  `<iframe srcdoc>` + a download-only **Step Guide** card (Word EN/FR). One language control drives
  the whole page; a Print button per sub-page. `feature-all-in-one.md`.
- 2026-07-24 — **Per-image "Replace image"**: swap a bad screenshot in place (PNG/JPEG, dims
  re-measured), resetting that step's confirmation. `feature-replace-image.md`.
- 2026-07-24 — **Autosave restored** on the project file + close-tab warning. `help.md` 10 done.
- Earlier (07-22/23): phases UI, editable metadata, bilingual title, portable project file, merge
  keeps one image, EN/FR Word buttons, "Case study" → "Worked example".

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
1. **Cam's human pass on the UI redesign** (`feature-ui-redesign.md`) — every phase, keyboard-only,
   both languages; then push (push = deploy). The README screenshot will be stale after the push.
2. **Re-run Word's Accessibility Checker** (`help.md` 3b) — hard-refresh the live site first; both
   previous attempts graded pre-fix files. Last unticked `.docx` criterion.
3. `feature-public-polish` — README rewritten with a landing-page screenshot; only **a stranger
   completing the flow** remains (the project's definition of done).
4. Plural forms ("1 items") — needs `Intl.PluralRules`, not string patching.

## 🔗 Pointer
→ Current stage folder: `staging/stage-4-ship/` · Active feature file:
`staging/stage-4-ship/feature-ui-redesign.md`

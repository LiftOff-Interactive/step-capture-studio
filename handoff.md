# Handoff — step-capture-studio
_Last updated: 2026-07-22 · Current stage: stage-4-ship_

## 🎯 Goals
Finish Stage 4: a synthetic demo capture and public polish, so a stranger can use the live site.

## 📍 Current State
- **LIVE at https://mbubyn.github.io/step-capture-studio/** — public, MIT, Pages green. **234/234 tests.**
- **Stages 1–3 complete.** All three HTML artifacts build, self-contained, bilingual, readable with
  JavaScript disabled, axe clean with contrast measured in a real browser. **All three now print
  correctly — confirmed on paper by the author, 2026-07-22.**
- **Stage 4: `.docx` export verified against Word 16.0** — no repair prompt, real heading styles,
  alt text on every image, correct language EN/FR, title and author survive a re-save, and
  **`CompatibilityMode=15`** so Word treats it as a modern document.
- **A second, independent capture parses clean** (6/6 steps, zero warnings) — the parser is no
  longer built against a sample of one. That was risk #1 in the master plan.
- **A portable project file replaces autosave**: export the whole capture to one self-contained
  `.html` (screenshots inlined, state in visible markup) and import it back. Verified end to end in
  a real browser, including hand-editing the file in a text editor.
- **Autosave has been deleted** on the author's instruction — `feature-autosave.md` records what
  that cost. Closing the tab without exporting now loses the session, with no warning.
- Everything sits at `awaiting verification` because of human-only checks, not unfinished work.
  The exceptions are `docx-reader`, `snagit-parser` and `pages-deploy`, which are `verified done`.

## 📂 Files I'm Working On
- `src/lib/emit-*.js` — four emitters plus `emit-common.js` (shell, progressive enhancement).
- `src/lib/case-study.js` — narrative model; `drafted` is the flag the whole feature protects.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` item 7).

## ✅ Things I've Changed
- 2026-07-22 — **The guide title is bilingual**: `capture.title` is `{en, fr}`, editable per
  language and carried by the translation round trip. Closes the last "still in English" item.
- 2026-07-22 — **Portable project file** (`emit-project.js` / `parse-project.js`), a matched pair
  kept honest by round-trip tests. **Autosave removed** in the same pass.
- 2026-07-22 — **One verification checkbox per step**, derived from the model so it cannot lie;
  fixed the page jumping to the top when it was clicked.
- 2026-07-22 — Export buttons repeated at the foot of the step list, held as pairs in code.
- 2026-07-22 — **`settings.xml` / `compatibilityMode`**: without it Word opened every export in
  Compatibility Mode, which **disables the Accessibility Checker** — so that criterion was
  unreachable, not merely unverified.
- 2026-07-22 — **Chrome is bilingual at last.** Headings, buttons and metadata were resolved once
  against `languages[0]`, so French artifacts kept English labels. New `langLabel()` helper.
- 2026-07-22 — Case-study alt text followed `languages[0]` too; now swaps with the language.
- 2026-07-22 — Artifact naming: `TestingWindowsAudio_CaseStudy` for filename **and** `<title>`.
- 2026-07-22 — Case-study print sizing: images were one-per-page, orphaning their own text.
- 2026-07-22 — Accessible `.docx` export; found and fixed a Word-only `dc:language` defect.
- 2026-07-21 — Case study: narrative model, copy-prompt, and the review gate.
- 2026-07-21 — HTML walkthrough: one DOM serving both a plain guide and a two-pane viewer.
- 2026-07-21 — Quick-steps artifact + shared emitter foundation + the export gate.
- 2026-07-21 — Autosave: text-only drafts, re-drop to restore screenshots. **Removed 2026-07-22.**

## ❌ Watch Out
- **A correct model is not a correct UI, and valid markup is not accepted markup.** Every session
  driving a real browser or Word found a defect the passing suite could not see.
  → `docs/failed-approaches.md` is the most valuable file here; read it before debugging anything.
- **Live regions break silently**: never `display:none`, never inside a rebuilt container, never
  `data-i18n`. Three variants have already bitten this project.
- **Self-contained artifacts must never defer anything** — `loading="lazy"` prints blank — and a
  `.docx` must never carry `dc:language`, which makes Word discard the whole properties part.
- **An omitted part can be load-bearing.** Leaving out `settings.xml` looked like prudence and
  silently disabled Word's Accessibility Checker. Ask not only "can this part be malformed?" but
  "what does the consumer assume when it is absent?"
- **Content was per-language long before chrome was.** If you add a user-facing string to an
  emitter, use `langLabel()`. `t(key, primary)` renders it once, in English, forever.
- **`emit-project.js` and `parse-project.js` are a matched pair.** Every attribute one writes, the
  other reads. Change one and you must change the other; the round-trip tests are the only thing
  enforcing it.
- **A green suite can sit on top of an unusable UI.** The editor tests build nodes in isolation and
  never exercise the in-place syncing `app.js` does between renders. Click the thing.

## ➡️ Next Up
1. **Commit and push.** Nothing from 2026-07-22 is committed, so the live site still serves the
   old code — the 3b retest failed for exactly that reason, on a file exported from the live site.
2. **Re-run Word's Accessibility Checker** (`help.md` 3b) on a file exported from code that has the
   fix. The first two attempts both graded pre-fix files. Last unticked `.docx` criterion.
3. `feature-demo-capture` — the capture exists and parses clean, but **the feature file does not**.
   Decide what actually ships (the `.docx` cannot: the hook blocks it, correctly).
4. `feature-public-polish` — README screenshots and contribution notes. **File does not exist yet.**
5. Fix plural forms ("1 items") — needs `Intl.PluralRules`, not string patching.

## 🔗 Pointer
→ Current stage folder: `staging/stage-4-ship/` · Active feature file:
`staging/stage-4-ship/feature-project-file.md`

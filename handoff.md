# Handoff — step-capture-studio
_Last updated: 2026-07-22 · Current stage: stage-4-ship_

## 🎯 Goals
Finish Stage 4: a synthetic demo capture and public polish, so a stranger can use the live site.

## 📍 Current State
- **LIVE at https://mbubyn.github.io/step-capture-studio/** — public, MIT, Pages green. **220/220 tests.**
- **Stages 1–3 complete.** All three HTML artifacts build: quick-steps 7.7 KB · walkthrough 1.09 MB ·
  case study 1.08 MB. Each is self-contained, bilingual, readable with JavaScript disabled, and axe
  clean with contrast measured in a real browser.
- **Stage 4: `.docx` export built and verified against Word 16.0** — opens with no repair prompt,
  real heading styles, alt text on every image, correct language in EN and FR.
- Everything sits at `awaiting verification` because of human-only checks, not unfinished work.
  The exceptions are `docx-reader`, `snagit-parser` and `pages-deploy`, which are `verified done`.

## 📂 Files I'm Working On
- `src/lib/emit-*.js` — four emitters plus `emit-common.js` (shell, progressive enhancement).
- `src/lib/case-study.js` — narrative model; `drafted` is the flag the whole feature protects.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` item 7).

## ✅ Things I've Changed
- 2026-07-22 — Accessible `.docx` export; found and fixed a Word-only `dc:language` defect.
- 2026-07-21 — Case study: narrative model, copy-prompt, and the review gate.
- 2026-07-21 — HTML walkthrough: one DOM serving both a plain guide and a two-pane viewer.
- 2026-07-21 — Quick-steps artifact + shared emitter foundation + the export gate.
- 2026-07-21 — Autosave: text-only drafts, re-drop to restore screenshots.

## ❌ Watch Out
- **A correct model is not a correct UI, and valid markup is not accepted markup.** Every session
  driving a real browser or Word found a defect the passing suite could not see.
  → `docs/failed-approaches.md` is the most valuable file here; read it before debugging anything.
- **Live regions break silently**: never `display:none`, never inside a rebuilt container, never
  `data-i18n`. Three variants have already bitten this project.
- **Self-contained artifacts must never defer anything** — `loading="lazy"` prints blank — and a
  `.docx` must never carry `dc:language`, which makes Word discard the whole properties part.

## ➡️ Next Up
1. `feature-demo-capture` — needs a short, publicly-safe Snagit recording from the author
   (`help.md` 4). Last thing blocking "a stranger completes the flow from the live URL".
2. `feature-public-polish` — README screenshots and contribution notes.
3. Human-only checks: Word's Accessibility Checker (`help.md` 3b), printing all three HTML
   artifacts (`help.md` 3c), a screen-reader pass (`help.md` 6).
4. Fix plural forms ("1 items") — needs `Intl.PluralRules`, not string patching.

## 🔗 Pointer
→ Current stage folder: `staging/stage-4-ship/` · Active feature file:
`staging/stage-4-ship/feature-docx-writer.md`

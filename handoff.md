# Handoff — step-capture-studio
_Last updated: 2026-07-22 · Current stage: stage-4-ship_

## 🎯 Goals
Finish Stage 4: a synthetic demo capture and public polish, so a stranger can use the live site.

## 📍 Current State
- **LIVE at https://mbubyn.github.io/step-capture-studio/** — public, MIT, Pages green.
- **All three artifacts are built.** 201/201 tests. Each is self-contained, bilingual, readable with
  JavaScript disabled, and axe clean with contrast measured in a real browser:
  quick-steps 7.7 KB · walkthrough 1.09 MB · case study 1.08 MB.
- The case study **refuses to emit unreviewed drafted narrative** — gated twice (UI and emitter),
  and separately from the other two so an unreviewed explanation cannot block them.
- **The `.docx` export is built and verified against Word 16.0** — opens with no repair prompt, real
  heading styles, alt text on every image, correct language in EN and FR. **220/220 tests.**
- Stages 1–3 are complete. Everything sits at `awaiting verification` for reasons only a human can
  clear, not because work remains.

## 📂 Files I'm Working On
- `src/lib/emit-*.js` — the three emitters plus `emit-common.js` (shell, progressive enhancement).
- `src/lib/case-study.js` — narrative model; `drafted` is the flag the whole feature protects.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` item 7).

## ✅ Things I've Changed
- 2026-07-22 — Accessible `.docx` export; found and fixed a Word-only `dc:language` defect.
- 2026-07-21 — Case study: narrative model, copy-prompt, and the review gate.
- 2026-07-21 — HTML walkthrough: one DOM serving both a plain guide and a two-pane viewer.
- 2026-07-21 — Quick-steps artifact + shared emitter foundation + the export gate.
- 2026-07-21 — Autosave: text-only drafts, re-drop to restore screenshots.
- 2026-07-21 — Bilingual round trip: copy-prompt out, strict paste-back in.

## ❌ Watch Out
- **Live regions: never `display:none`, never inside a rebuilt container, never `data-i18n`.**
  Three variants of that silent failure have already bitten this project.
- **Never lazy-load or defer anything in a self-contained artifact** — it prints blank.
- **Never put `dc:language` in a .docx core.xml** — Word discards the whole part, silently.
- **Driving Word by COM needs `Start-Job` + a timeout**, and kill leftover invisible instances.
- **A correct model is not a correct UI.** Every browser session has found a defect the passing
  suite could not see. `docs/failed-approaches.md` is the most useful file here.

## ➡️ Next Up
1. `feature-demo-capture` — record a short, publicly-safe Snagit capture (`help.md` item 4) so a
   stranger can try the live site. This is the last thing blocking "a stranger completes the flow".
2. `feature-public-polish` — README screenshots and contribution notes.
3. Human-only checks: Word's Accessibility Checker (`help.md` 3b) and printing all three HTML
   artifacts (`help.md` 3c).
4. Fix plural forms ("1 items") — needs `Intl.PluralRules`, not string patching.

## 🔗 Pointer
→ Current stage folder: `staging/stage-4-ship/` · Active feature file:
`staging/stage-4-ship/feature-docx-writer.md`

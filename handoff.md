# Handoff — step-capture-studio
_Last updated: 2026-07-21 · Current stage: stage-3-generators (complete, awaiting verification)_

## 🎯 Goals
Clear the human verification Stages 1–3 have accumulated, then Stage 4: the accessible `.docx`
export and a synthetic demo capture.

## 📍 Current State
- **LIVE at https://mbubyn.github.io/step-capture-studio/** — public, MIT, Pages green.
- **All three artifacts are built.** 201/201 tests. Each is self-contained, bilingual, readable with
  JavaScript disabled, and axe clean with contrast measured in a real browser:
  quick-steps 7.7 KB · walkthrough 1.09 MB · case study 1.08 MB.
- The case study **refuses to emit unreviewed drafted narrative** — gated twice (UI and emitter),
  and separately from the other two so an unreviewed explanation cannot block them.
- Stages 1 and 2 are complete. Everything sits at `awaiting verification` for reasons only a human
  can clear, not because work remains.

## 📂 Files I'm Working On
- `src/lib/emit-*.js` — the three emitters plus `emit-common.js` (shell, progressive enhancement).
- `src/lib/case-study.js` — narrative model; `drafted` is the flag the whole feature protects.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` item 7).

## ✅ Things I've Changed
- 2026-07-21 — Case study: narrative model, copy-prompt, and the review gate.
- 2026-07-21 — HTML walkthrough: one DOM serving both a plain guide and a two-pane viewer.
- 2026-07-21 — Quick-steps artifact + shared emitter foundation + the export gate.
- 2026-07-21 — Autosave: text-only drafts, re-drop to restore screenshots.
- 2026-07-21 — Bilingual round trip: copy-prompt out, strict paste-back in.

## ❌ Watch Out
- **Live regions: never `display:none`, never inside a rebuilt container, never `data-i18n`.**
  Three variants of that silent failure have already bitten this project.
- **Never lazy-load or defer anything in a self-contained artifact** — it prints blank.
- **A correct model is not a correct UI.** Every browser session has found a defect the passing
  suite could not see. `docs/failed-approaches.md` is the most useful file here.

## ➡️ Next Up
1. **Print all three artifacts to PDF.** Untested for every one, and it is the defining property of
   the quick-steps guide. The walkthrough already had a bug whose symptom was blank print output.
2. Look at the app and time authoring one capture — Stage 2 set itself a 15-minute budget nobody
   has measured.
3. Fix plural forms ("1 items", "1 were returned") — needs `Intl.PluralRules`, not string patching.
4. Then Stage 4: accessible `.docx` export (spike early — highest-risk item left) and a synthetic
   demo capture so a stranger can try the live site.

## 🔗 Pointer
→ Current stage folder: `staging/stage-4-ship/` · Active feature file:
`staging/stage-4-ship/overview.md` (feature files deliberately not written yet)

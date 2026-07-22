# Handoff — step-capture-studio
_Last updated: 2026-07-21 · Current stage: stage-2-authoring (built, awaiting verification)_

## 🎯 Goals
Close out Stage 2's human verification, then start Stage 3: the three artifact emitters.

## 📍 Current State
- **LIVE at https://mbubyn.github.io/step-capture-studio/** — public, MIT, Pages green.
- **Stage 1 done** except `app-shell`, which waits only on a human looking at it.
- **Stage 2: all four features built** — step editor, alt-text gate, bilingual round trip, autosave.
  All `awaiting verification`. **129/129 tests**; axe 0 violations / 0 incomplete, both languages.
- Verified in-browser end to end: edit → seed → confirm → merge → translate → reload → re-drop →
  draft restored with images reattached. Wrong file refused, draft preserved byte for byte.
- Drafts are text-only (**3.3 KB** vs 843 KB of screenshots); images return on re-drop.

## 📂 Files I'm Working On
- `src/lib/draft.js` — persistence + fingerprint · `src/lib/translate.js` — the round trip.
- `src/ui/app.js` — events and state only; DOM building lives in `render.js` / `editor.js`.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` item 7).

## ✅ Things I've Changed
- 2026-07-21 — Autosave: text-only drafts, re-drop to restore screenshots.
- 2026-07-21 — Bilingual round trip: copy-prompt out, strict paste-back in.
- 2026-07-21 — Readiness count announced (WCAG 4.1.3) via a persistent live region.
- 2026-07-21 — Editor UI with the alt-text confirmation gate.
- 2026-07-21 — Published live: MIT licence, sanitised, history scrubbed, repo recreated public.

## ❌ Watch Out
- **Live regions: never `display:none`, never inside a rebuilt container, never `data-i18n`.**
  Three separate variants of that one silent failure have bitten this project already.
- **Generated text must be re-rendered on language change** — errors, banners, status. `data-i18n`
  only covers markup.
- **A correct model is not a correct UI.** Every browser session so far has found a defect the
  passing test suite could not see. See `docs/failed-approaches.md`.

## ➡️ Next Up
1. Run `npm start`, look at the app, and time authoring one capture end to end — Stage 2's own
   done-criteria include a 15-minute budget nobody has measured.
2. Screen-reader pass if NVDA/Narrator is available (`help.md` item 6).
3. Stage 3: `feature-quick-steps`, `feature-html-walkthrough`, `feature-case-study`. Flesh out the
   sketches first — they were left deliberately rough.

## 🔗 Pointer
→ Current stage folder: `staging/stage-3-generators/` · Active feature file:
`staging/stage-3-generators/feature-html-walkthrough.md`

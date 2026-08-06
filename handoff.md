# Handoff — step-capture-studio
_Last updated: 2026-08-05 · Current stage: stage-4-ship_

## 🎯 Goals
Finish Stage 4: public polish and a shippable demo, so a stranger can use the live site unaided.

## 📍 Current State
- **LIVE at https://liftoff-interactive.github.io/step-capture-studio/** — public, MIT. **357/357.**
- **Seven phases:** Start · Capture · Worked example · Edit · Translate · Branding · Export.
- **Branding phase** — fonts/sizes, gradient, highlight, logo, background, card icons; reaches all
  four artifacts and Word. A contrast failure **blocks export**. The default is a deliberate no-op.
- **Export page is a comparison table** — the all-in-one leads, then a row per output (description |
  bundle checkbox | downloads), aligned with `subgrid`. Unticking never blocks a standalone download.
- **Source language is the author's**, **worked example optional**, explanations per language.
- **Stages 1–3 complete.** Artifacts self-contained, bilingual, JS-off readable, axe clean, printable.
- **Word verified, branded (2026-08-05).** Current format, no convert prompt, Accessibility Checker
  clean; fonts, colour and sizes all arrived. Closes `feature-docx-writer`; no `help.md` blockers.
- Everything else is `awaiting verification` — human checks, not unfinished work. `docx-reader`,
  `snagit-parser`, `pages-deploy`, `docx-writer` are `verified done`.

## 📂 Files I'm Working On
- `src/ui/tokens.css` + `src/lib/tokens.js` — the one palette, and the seam that inlines it.
- `src/lib/branding.js` (+ test) — derives and measures rather than asks; surfaces come from tokens.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` 7). 251 keys per language.

## ✅ Things I've Changed
- 2026-08-05 — **One `:root`** for all four surfaces; **studio repaints in the brand**; audit covers
  all eight pairings and reads its surfaces from the tokens. `feature-design-tokens` built.
- 2026-08-05 — **Walkthrough is two columns again** — rail, then screenshot above its instruction.
  The 2026-08-01 beside-the-screenshot split made three. Reverted here and in the all-in-one.
- 2026-08-05 — **`tools/shoot.mjs`** photographs phases or artifacts. Tagline says "multiple" now.
- 2026-08-05 — **Word verified against Word itself, branded.** `feature-docx-writer` → verified done.
- 2026-08-01 — **Export page rebuilt to Mike's mock-up**; dashboard leads, `subgrid` aligns columns.
- 2026-08-01 — **Bundle selection + standard card icons**; icons overridable on Branding.
- 2026-08-01 — **Branding phase** across every artifact, contrast-gated.
- 2026-08-01 — Source language, wider editor.

## ❌ Watch Out
- **A green suite can sit on top of an unusable UI.** Undo left the branding controls stale
  2026-08-01, third time for that seam. → `failed-approaches.md`, "disabled state".
- **Valid markup is not accepted markup, and measured is not seen.** → `failed-approaches.md`,
  "`<dc:language>`" and "Reviewing a screenshot's subject".
- **Word shows the resolved font family, not our option label.** *monospace* → "Cascadia Mono" is
  the mapping working, not a fault; `w:rFonts` cannot hold a stack. Misread as a failure once.
- **A passing assertion may be testing nothing.** `shoot.mjs` twice "succeeded" on identical
  images; the dark-token check split on `:root`, a string in its own comment, so it compared prose
  and passed whatever you deleted. Mutation-test every new assertion — it found both.
- **Never restore a mutation with `git checkout --`, never chain `npm test` with `;` before a
  commit.** Both bit on 2026-08-01. → `failed-approaches.md`, 2026-08-01 entry.

## ➡️ Next Up
_Nothing is blocking._
1. **Cam's human pass** — every phase, keyboard-only, both languages, now including **Adjust
   branding**. `shoot.mjs phases` takes `--fr` and `--brand`; it is the last thing gating two features.
2. `feature-public-polish` — stale README screenshot (`shoot.mjs` regenerates it); **a stranger
   completing the flow** is the definition of done.
3. Plural forms ("1 items") — needs `Intl.PluralRules`, not string patching.

## 🔗 Pointer
→ `staging/stage-4-ship/` · Active feature: `staging/stage-4-ship/feature-design-tokens.md`

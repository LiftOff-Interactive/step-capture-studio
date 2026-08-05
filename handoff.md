# Handoff — step-capture-studio
_Last updated: 2026-08-05 · Current stage: stage-4-ship_

## 🎯 Goals
Finish Stage 4: public polish and a shippable demo, so a stranger can use the live site unaided.

## 📍 Current State
- **LIVE at https://liftoff-interactive.github.io/step-capture-studio/** — public, MIT. Repo moved to
  the `LiftOff-Interactive` org 2026-08-01; the old `mbubyn.github.io` address is gone. **345/345.**
- **Seven phases:** Start · Capture details · Worked example · Edit steps · Translate · Branding ·
  Export. Everything below shipped 2026-08-01 and is deployed.
- **Branding phase** — fonts/sizes, header gradient, one highlight colour, logo, background, per-card
  icons; reaches all four HTML artifacts and Word. Contrast is measured and a failure **blocks
  export** like unconfirmed alt text. The default is a deliberate no-op.
- **Export page is a comparison table** — the all-in-one leads, then a row per output (description |
  bundle checkbox | downloads), aligned with `subgrid`. Unticking never blocks a standalone download.
- **Source language is the author's to set**, the **worked example is optional**, and its
  explanations have a field per language. Each of the three fixed a silent French-capture failure.
- **Stages 1–3 complete.** Artifacts self-contained, bilingual, JS-off readable, axe clean, printable.
- **Word verified, branded (2026-08-05).** Current format, no convert prompt; the Accessibility
  Checker reports zero errors and no warnings. Fonts, heading colour and both point sizes arrived.
  Retires the last `help.md` blocker and closes `feature-docx-writer`.
- Everything else sits at `awaiting verification` — human-only checks, not unfinished work.
  `docx-reader`, `snagit-parser`, `pages-deploy` and now `docx-writer` are `verified done`.

## 📂 Files I'm Working On
- `src/lib/branding.js` (+ test) — fonts, colours, imagery; derives the header ink and dark-scheme
  accent rather than asking for them, and measures the highlight rather than trusting it.
- `src/lib/all-in-one.js` (+ test) — which artifacts the dashboard bundles.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` 7). 251 keys per language.

## ✅ Things I've Changed
- 2026-08-05 — **Word verified against Word itself, branded.** `feature-docx-writer` → verified done.
- 2026-08-01 — **Export page rebuilt to Mike's mock-up**; dashboard leads, `subgrid` aligns columns.
- 2026-08-01 — **Bundle selection + standard card icons**; icons overridable on Branding.
- 2026-08-01 — **Branding phase** across every artifact, contrast-gated.
- 2026-08-01 — **Walkthrough and worked example beside their screenshots**; source language,
  optional worked example, bilingual explanations, wider editor.

## ❌ Watch Out
- **A green suite can sit on top of an unusable UI.** Undo left the branding controls stale on
  2026-08-01 — third time this seam has shipped a bug. → `failed-approaches.md`, "disabled state".
- **Valid markup is not accepted markup, and measured is not seen.** → `failed-approaches.md`,
  "`<dc:language>`" and "Reviewing a screenshot's subject".
- **Word shows the resolved font family, not our option label.** *monospace* → "Cascadia Mono", the
  stack's first concrete face — the mapping working. Misread as a failure 2026-08-05.
- **Never restore a mutation with `git checkout --`, never chain `npm test` with `;` before a
  commit.** Both bit on 2026-08-01. → `failed-approaches.md`, 2026-08-01 entry.

## ➡️ Next Up
_Nothing is blocking._
1. **Cam's human pass** — every phase, keyboard-only, both languages. Nothing visual from
   2026-08-01 has been looked at; it is measured geometry and DOM contracts, no screenshots. Covers
   `feature-branding`'s last criterion: the four **HTML** artifacts of a branded capture, seen.
2. `feature-public-polish` — README screenshot is stale after the redesign; **a stranger completing
   the flow** is the definition of done.
3. Plural forms ("1 items") — needs `Intl.PluralRules`, not string patching.

## 🔗 Pointer
→ `staging/stage-4-ship/` · Active feature: `staging/stage-4-ship/feature-branding.md`

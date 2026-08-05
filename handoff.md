# Handoff — step-capture-studio
_Last updated: 2026-08-01 · Current stage: stage-4-ship_

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
- **Export page is a comparison table** — the all-in-one leads with its own write-up, then a row per
  output (description | include-in-bundle checkbox | downloads), columns aligned with `subgrid`.
  Unticking a part never stops that artifact downloading on its own.
- **Source language is the author's to set** (Capture details). A French-Snagit capture was filed as
  English, running the translation round trip backwards and putting `lang="en-CA"` on French prose.
- **Worked example is optional**, and its explanations now have a field per language — they were
  source-language only, so a French artifact shipped with them silently missing.
- **Stages 1–3 complete.** Artifacts self-contained, bilingual, readable with JS off, axe clean,
  print correctly. `.docx` verified against Word 16.0 (pre-branding).
- Everything sits at `awaiting verification` — human-only checks, not unfinished work. Exceptions
  `docx-reader`, `snagit-parser`, `pages-deploy` are `verified done`.

## 📂 Files I'm Working On
- `src/lib/branding.js` (+ test) — fonts, colours, imagery; derives what must not be asked for
  (header ink, dark-scheme accent) and measures what must not be trusted.
- `src/lib/all-in-one.js` (+ test) — which artifacts the dashboard bundles.
- `src/lib/i18n.js` — **French is an unreviewed machine draft** (`help.md` 7). 251 keys per language.

## ✅ Things I've Changed
- 2026-08-01 — **Export page rebuilt to Mike's mock-up**; dashboard leads, `subgrid` aligns columns.
- 2026-08-01 — **Bundle selection + standard card icons**; icons overridable on Branding.
- 2026-08-01 — **Branding phase** across every artifact, contrast-gated.
- 2026-08-01 — **Walkthrough and worked example laid out beside their screenshots**, not below.
- 2026-08-01 — **Source language, optional worked example, bilingual explanations, wider editor.**

## ❌ Watch Out
- **A green suite can sit on top of an unusable UI.** Undo left the branding controls stale this
  session — third time this seam has shipped a bug. → `failed-approaches.md`, "disabled state".
- **Valid markup is not accepted markup, and measured is not seen.** → `failed-approaches.md`,
  "`<dc:language>`" and "Reviewing a screenshot's subject".
- **Never restore a mutation with `git checkout --`, never chain `npm test` with `;` before a
  commit.** Both bit this session. → `failed-approaches.md`, 2026-08-01 entry.

## ➡️ Next Up
1. **`help.md` 0 (blocking)** — open a **branded** `.docx` in Word, run the Accessibility Checker.
   Branding reaches `styles.xml` but has never been seen by Word.
2. **Cam's human pass** — every phase, keyboard-only, both languages. Nothing visual from
   2026-08-01 has been looked at; it is all measured geometry and DOM contracts, no screenshots.
3. `feature-public-polish` — README screenshot is stale after the redesign; **a stranger completing
   the flow** is the definition of done.
4. Plural forms ("1 items") — needs `Intl.PluralRules`, not string patching.

## 🔗 Pointer
→ Current stage folder: `staging/stage-4-ship/` · Active feature file:
`staging/stage-4-ship/feature-branding.md`

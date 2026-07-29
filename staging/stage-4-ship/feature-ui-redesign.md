# Feature: ui-redesign (tabbed teal dashboard)
_Stage: stage-4-ship · Status: **awaiting verification** — built 2026-07-29_

## Goal
Re-skin and restructure the studio to match the July 2026 PowerPoint mock-ups ("Step Capture
studio Dashboard" deck, 9 slides): a brand-teal shell with white cards, a phase nav
(Start here → Capture details → Worked example → Edit steps → Translate → Export), a per-phase
"Page instructions" panel on the right, numbered step chips that show one step at a time in the
editor, an Export shortcut in the header, and a Tabbed/Linear layout toggle. The all-in-one
dashboard export restyled to slide 1 (alternating card tint, large teal icon tiles).

## The shape, and why
- **The tabbed layout is applied entirely at runtime by app.js.** The markup ships fully linear:
  without JavaScript (and under jsdom, which does not run module scripts) the page is today's
  single scroll, so the axe suites keep auditing the whole document rather than one tab.
- **Two independent visibility switches**: `hidden` = "this content does not exist yet" (owned by
  the existing show/hide logic, unchanged); `.phase-off` = "exists, but belongs to another phase"
  (owned by `syncView()`). Either hides. Sections carry `data-phase`; error/restore/unsupported
  are global and follow only `hidden`.
- **Deliberately NOT an ARIA tab widget.** These are wizard stages over whole page regions — a
  `<nav>` of buttons with `aria-current` on the active phase. In the linear layout the same
  buttons scroll to their section instead of hiding the rest.
- **#status moved out of #loader to a direct child of `<main>`.** A live region inside a
  display:none section announces nothing, and "Prompt copied" fires from the Translate phase.
  Known cost, accepted: `#readiness-summary` still lives in the export phase, so its count
  announcements are silent while another phase is showing (they were arguably noise mid-edit; the
  summary is visible on arrival).
- **Step chips**: visible label is the number, accessible name is "Step {n} of {total}". A
  selection change moves `aria-current` between existing buttons (`syncChips`) — rebuilding would
  destroy the button under the pointer and drop focus. All steps stay in the DOM (focus restore
  and the export gate depend on every control existing); inactive ones are display:none, tabbed
  layout only. Handlers that change the list (delete/merge/replace/verify) pin `state.activeStep`
  first so focus restore never targets a hidden step.
- **Editor fieldset split into `.step__main` / `.step__side`** (fields left; verify + delete +
  screenshot right, per slide 7). Pure structure in editor.js; the two columns are CSS ≥62rem.
- **Layout preference persists** (`step-capture-studio.view` in localStorage). Loading a capture
  advances the tabbed view to Capture details; a failed load returns to Start here and re-locks
  the nav (phases past Start are disabled until a capture exists).
- **i18n**: nav/toggle/instructions strings in both languages; `data-i18n-aria` added to
  applyStaticStrings for landmarks named by aria-label. French is a draft like the rest
  (help.md 7).
- **All-in-one emitter**: CSS-only change — cards alternate background by position
  (`li:nth-child(odd)`), 28px radius, 132×112 brand-teal icon tiles with dark outline. Classes
  and structure untouched; the emit-all-in-one tests still assert them.

## Colour tokens (sampled from the slides)
`--brand #155f82` (shell, pills, icon tiles) · `--brand-tint #dceaf7` (active pill, odd cards) ·
`--chip-active #bfe0f0` · dark-mode shell `#0b1f2a`, tint `#10394d`.

## Success Criteria
- [x] 272/272 tests green, axe clean in empty/loaded/error states, both languages (2026-07-29).
- [x] Contrast measured in a real browser, both themes: nav pill 7.02, active pill 11.28/10.01,
      chip 16.91/15.48, active chip 12.19/10.54, header Export 7.02/7.02, instructions text
      16.91/15.48, tagline 6.84/9.1 (light/dark). One defect found and fixed by measurement:
      `.button--brand` inherited dark-mode `--on-accent` and measured **2.65:1** — explicit
      `--on-brand` now.
- [x] Full flow driven in a real browser (Playwright + preview): demo load auto-advances to
      Capture details; nav unlocks; chips show one step at a time and switch; header Export jumps
      to the export phase ("Ready to export." on the demo); Linear stacks all six sections, hides
      chips + instructions, and persists; French swaps nav labels, chip aria-labels, nav
      aria-label, and instructions body; all-in-one export renders 4 cards with alternating tint.
- [ ] **Human pass (Cam)**: look at every phase on the live site, keyboard-only walk, and confirm
      the design matches the deck's intent — especially the instructions copy, which I drafted.

## Verification Log
- 2026-07-29 — Built. `npm test` 272/272 including axe suites on the restructured page and the
  split editor. Browser-verified per criteria above (light + dark, EN + FR, tabbed + linear);
  eleven screenshots captured via Playwright against the local server, all-in-one export opened
  and inspected. Status stays **awaiting verification** pending Cam's human pass on the live site.
- 2026-07-29 — Cam approved the push after reviewing the screenshots. Deployed to main
  (`e455852`); live page at https://liftoff-interactive.github.io/step-capture-studio/ confirmed
  serving the redesign markup (curl found the 6 phase-nav buttons). Remaining human criterion —
  the on-site keyboard walk and copy read — still open, so the status stands.

## Open edges
- Slide 2 shows a 3-card all-in-one variant (no Step Guide card, Word links under Worked
  Example). Slide 1's 4-card layout matches the shipped structure and was taken as the target;
  revisit if the deck meant the 3-card variant as the goal state.
- Slide 3's header shows the literal caption "Export Button"; shipped label is Export/Exporter.
- `#readiness-summary` announcement suppression noted above.

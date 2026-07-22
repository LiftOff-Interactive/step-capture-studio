# Stage 2 — Authoring

_Moderately specified. Flesh out the feature files when Stage 1 is verified done, not before._

## Goal
Give the author a focused surface for the parts only a human can supply: fixing Snagit's repetitive
step text, writing alt text for every screenshot, and getting the French in. The parser handles the
mechanical 80%; this stage is the 20% that makes the output shippable.

## Features
- [x] `feature-step-editor` — dedup detection and inline editing of step text
- [x] `feature-alt-text` — required EN + FR alt text per image, gating export
- [x] `feature-bilingual-roundtrip` — copy-prompt translation export and paste-back import
- [x] `feature-autosave` — `localStorage` draft persistence

## Definition of done — testable checklist
- [ ] The real sample reaches a **complete** bilingual model: every step has EN and FR text, every
      image has EN and FR alt text.
- [ ] Export is **blocked** while any alt text is unconfirmed, and the blocking reason is announced
      to assistive tech, not just shown visually.
- [ ] Duplicate consecutive steps (3/4 and 7/8 in the sample) are detected and surfaced with a
      one-click merge that the author can decline.
- [ ] Editing any field, closing the browser, and reopening restores the draft intact.
- [ ] The translation round trip completes without hand-editing JSON: copy prompt → run externally →
      paste back → fields populate, with a clear error if the pasted text does not match the steps.
- [ ] `npm test` passes; axe-core reports zero violations on every editor state.
- [ ] The entire editor is operable by keyboard alone, including the merge and paste-back flows.

## Notes
This stage is where the manual burden lives — roughly 20+ hand-entered fields for a 10-step capture
once alt text and French are counted. That number is the reason autosave was pulled into v1, and it
is the number to watch: if authoring the sample takes more than about 15 minutes, the design needs
rethinking before Stage 3 builds on top of it.


## Status - 2026-07-21
All four features are built and `awaiting verification`. 129/129 tests; axe clean in both languages
across every editor state. What remains is verification a machine cannot do: a screen-reader pass
(`help.md` item 6) and a human actually looking at the interface.

The stage's own warning - "if authoring the sample takes more than about 15 minutes, the design needs
rethinking" - has not been measured. Nobody has authored a capture end to end at human speed.

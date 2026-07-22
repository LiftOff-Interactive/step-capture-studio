# Stage 3 — Generators

_**Sketch only.** Deliberately under-specified — detailed specs written this far ahead rot before we
reach them. Flesh these out when Stage 2 is verified done, using what Stages 1–2 actually taught us._

## Goal
Emit the three artifacts from the completed capture model. Every emitter consumes the model and
nothing else, so all three are independent and can be built in any order.

## Features
- [x] `feature-quick-steps` — terse cheat sheet for users who know the system
- [x] `feature-html-walkthrough` — the two-pane interactive guide (the headline artifact)
- [ ] `feature-case-study` — narrative skeleton plus copy-prompt

## Shared requirements — apply to all three
- **Self-contained.** One HTML file, screenshots inlined as data URIs. No image folder, no broken
  links, emailable, opens offline from a USB stick.
- **Bilingual.** Language toggle swaps content *and* `<html lang>`; the change is announced.
- **WCAG 2.1 AA.** Zero axe violations, full keyboard operability, visible focus, 4.5:1 text
  contrast, 320 px reflow, `prefers-reduced-motion` respected.
- **No JavaScript dependency for content.** The steps must be readable with scripting disabled —
  interactivity is an enhancement, not the delivery mechanism. This matters for printing, for
  archiving, and for restrictive government browser configurations.

## Definition of done — testable checklist
- [ ] All three artifacts download and open correctly from the local filesystem with no network.
- [ ] Screenshots render at full quality and correct aspect ratio in all three.
- [ ] The language toggle swaps text, alt text, and `lang` in the walkthrough.
- [ ] axe-core reports zero violations on every artifact in both languages.
- [ ] Each artifact is fully keyboard operable, including the walkthrough's step rail.
- [ ] Content is readable with JavaScript disabled.
- [ ] Each artifact prints sensibly to PDF (real use case for the quick-steps guide).
- [ ] `npm test` passes; the user has seen all three rendered.

## Known design intent — artifact 2 (confirmed with the user)
Main pane shows the current screenshot with its instruction in a text box; a rail beside it lists
every step; clicking a step or pressing arrow keys moves between them. Current step is indicated by
more than colour alone.

## Open risk
Data-URI inlining makes files large — the sample's 843 KB of PNGs become roughly 1.1 MB of base64 per
artifact. Acceptable for a 10-step capture; revisit if captures routinely run to 50+ steps. Do not
solve this speculatively.


## Status - 2026-07-21
`feature-quick-steps` is built and `awaiting verification`; the shared emitter foundation
(`src/lib/emit-common.js`) is in place and the export gate is wired to readiness. 145/145 tests.

The shared machinery now proven by a real artifact: self-contained output with no external requests,
both languages emitted with per-block `lang`, progressive enhancement so the no-JavaScript state is
bilingual rather than broken, and axe running over the generated document as a document.

`feature-html-walkthrough` is now built too - the headline artifact, 1.09 MB for the real capture
with all 10 screenshots inlined and decoding, axe clean in both languages.

Remaining: `feature-case-study`. Printing is untested for every artifact, so the one-page claim for
quick-steps is intent rather than evidence, and the walkthrough's print stylesheet is unproven.

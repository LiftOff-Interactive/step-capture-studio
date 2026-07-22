# Feature: quick-steps
_Stage: stage-3-generators · Status: awaiting verification_

## Goal
A one-page cheat sheet for someone who already knows the system and needs a reminder of the sequence.
Terse, scannable, printable. No screenshots by default.

## Success Criteria
- [x] An ordered list of step text only, no screenshots, fitting one page for a 10-step capture.
- [x] Bilingual, self-contained, AA conformant.
- [ ] Prints cleanly to one page with no clipped content.
- [x] Readable with JavaScript disabled.

## How We'll Verify
Render from the sample, print to PDF, confirm one page and no clipping. axe-core zero violations.
Keyboard pass. Show the user the rendered output.

## Verification Log

### 2026-07-21 - Built; automated PASS, in-browser PASS

**Automated: 145/145** (16 in `test/emit-quick-steps.test.js`). The generated HTML is loaded as a
real document in jsdom and asserted on directly:
- **Self-contained:** no `<link>`, no external `<script src>`, no absolute URL, no `@import`, no
  `url()` outside data URIs.
- Complete document: doctype, `lang`, charset, title, closing tag.
- Every step present and in order; no `<img>` at all, which is what keeps it to one page.
- Injection: a step containing `<script>alert(1)</script>` is escaped, not executed, and reads back
  correctly as text.
- Bilingual: both languages emitted, each block carrying its own `lang` (WCAG 3.1.2).
- **axe clean as a document in its own right, in BOTH the scripted and no-JavaScript states.** The
  no-JS state is a real state a reader will hit, so it is tested as one rather than assumed to be a
  degraded copy.

**Progressive enhancement, verified:** with scripting off there is no `data-lang`, so the stylesheet
shows **both** languages and the toggle stays hidden. The document is bilingual rather than
half-empty. With scripting on, JS sets `data-lang`, hides the inactive language and reveals the
toggle.

**In-browser (Chromium 148, real 10-step capture):** authored to completion in both languages, which
moved readiness from "30 items still need attention" to **"Ready to export."** and enabled the
download. The emitted artifact was rendered in an iframe so contrast could actually be measured:
- **7.7 KB**, 10 steps, zero images, title and `lang` correct
- French hidden by default (`display: none`), English shown, toggle labelled "Français"
- Toggling inside the artifact: `data-lang` and `<html lang>` both flip to `fr-CA`, French shows,
  English hides, button relabels to "English"
- **axe: 0 violations, 0 incomplete, contrast passing** - in both languages

**Export gate:** the download button is `disabled` while any blocker remains, with a hint explaining
why. Disabled rather than hidden, so the export is discoverable and its unavailability is
explicable - a button that vanishes tells the author nothing.

**Still outstanding:** printing has not been tested - the one-page claim is a design intent, not yet
evidence. Nobody has visually looked at the artifact. No screen-reader pass.

## Open Questions
- Should screenshots be available as an opt-in? A thumbnail rail might help without breaking the
  one-page goal — decide with a real user, not in advance.
- Both languages side by side on one sheet, or two separate sheets? Side-by-side is genuinely useful
  for a bilingual workplace and is the more interesting option.

## Notes & Decisions
Both languages are rendered into the document rather than one, because the no-JavaScript requirement
already forces both to be present. Side-by-side bilingual output on a printed sheet is genuinely
useful on a bilingual desk, so the constraint turned into the feature.

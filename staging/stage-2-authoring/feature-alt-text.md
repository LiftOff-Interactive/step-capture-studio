# Feature: alt-text
_Stage: stage-2-authoring · Status: in progress_

## Goal
Ensure every screenshot in every generated artifact carries meaningful alt text in both official
languages. Snagit supplies none, so this is the single biggest accessibility gap between the source
document and a conformant deliverable.

## Success Criteria
- [ ] Each image has an EN and an FR alt-text field.
- [ ] Fields are **seeded** from the step text as a draft, clearly marked unconfirmed.
- [ ] The author must actively confirm each one; seeded-but-unconfirmed does not count as done.
- [ ] Export is **blocked** while any alt text is unconfirmed, with a count of what remains.
- [ ] The blocking reason is announced via `aria-live`, not conveyed by colour or position alone
      (WCAG 1.4.1).
- [ ] A "confirm all seeded values" bulk action exists but is deliberately friction-ful — it states
      how many it will confirm and requires a second action.
- [ ] Alt text flows through to all three HTML artifacts and to the `.docx` (`wp:docPr/@descr`).
- [ ] Empty alt is permitted **only** via an explicit "decorative" toggle, which writes `alt=""`.

## How We'll Verify
1. `npm test` — assert export is refused with unconfirmed alt text; assert confirmed alt text reaches
   every emitter's output; assert the decorative toggle emits `alt=""` and not a missing attribute.
2. Manually attempt export with one image unconfirmed; confirm it is blocked and the message names
   the specific image.
3. Screen-reader pass over a generated artifact: confirm each screenshot is announced with its alt
   text, in the correct language.
4. axe-core zero violations on generated artifacts (axe catches missing alt, not meaningless alt —
   step 3 is what covers quality).
5. Screenshot the blocked-export state and show the user.

## Verification Log
_Empty. Cannot be `verified done` until dated evidence appears here._

## Open Questions
- Is step text a good enough alt-text seed? `Click "Open in Word"` describes the *action*, not the
  *image*. Better seeding might be `Screenshot showing the Open in Word button` — worth testing which
  produces better author behaviour, since a plausible-looking seed may get rubber-stamped.
- Should the decorative toggle exist at all? In a step-by-step guide essentially no screenshot is
  decorative, and offering the escape hatch may invite misuse.

## Notes & Decisions
The gate is the feature. An optional alt-text field would be skipped under deadline pressure, which
is exactly when accessibility gets dropped — so the requirement is enforced by the export path, not
by a reminder in the UI.

# Feature: alt-text
_Stage: stage-2-authoring · Status: awaiting verification_

## Goal
Ensure every screenshot in every generated artifact carries meaningful alt text in both official
languages. Snagit supplies none, so this is the single biggest accessibility gap between the source
document and a conformant deliverable.

## Success Criteria
- [x] Each image has an EN and an FR alt-text field.
- [x] Fields are **seeded** from the step text as a draft, clearly marked unconfirmed.
- [x] The author must actively confirm each one; seeded-but-unconfirmed does not count as done.
- [x] Export is **blocked** while any alt text is unconfirmed, with a count of what remains.
- [ ] The blocking reason is announced via `aria-live`, not conveyed by colour or position alone
      (WCAG 1.4.1). — **not met:** the readiness panel is stated in text (so not colour-alone), but it
      is not a live region, so the count changes silently for a screen-reader user. Needs fixing.
- [ ] A "confirm all seeded values" bulk action exists but is deliberately friction-ful — it states
      how many it will confirm and requires a second action. — **not built.**
- [ ] Alt text flows through to all three HTML artifacts and to the `.docx` (`wp:docPr/@descr`).
      — blocked: the emitters are Stage 3/4.
- [ ] Empty alt is permitted **only** via an explicit "decorative" toggle, which writes `alt=""`.
      — the toggle exists and satisfies the gate; the `alt=""` half cannot be shown until emitters exist.

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

### 2026-07-21 — Model and editor built; automated PASS, browser PASS
**Automated:** 79/79. `test/authoring.test.js` covers the gate directly — seeded drafts never count
as confirmed, editing resets confirmation, empty alt text cannot be confirmed at all, export stays
blocked with specific step/image/language named, decorative images satisfy the requirement without
alt text, and a missing French blocks a bilingual export. `test/editor-a11y.test.js` adds axe over
the editor in both languages and with a decorative image, plus label/id/grouping assertions.

**In-browser (Chromium 148, real 10-step capture):** the editor renders **82 controls** — 20
textareas, 20 alt inputs, 30 checkboxes, 12 buttons. axe: **0 violations, 0 needs-review**, with
`color-contrast` passing on **189 nodes**. Re-run after editing (seed → confirm → edit → merge →
delete) in both languages: still 0 and 0.

Workflow exercised end to end: seeding drafted alt text for all 10 screenshots; a second seed
correctly refused instead of claiming success; confirming reduced blockers 30 → 29; editing the
confirmed text returned it to 30.

**Two real defects found in the browser and fixed — neither was visible to the tests:**
1. **The confirm checkbox lied.** Editing alt text after confirming reset the model (readiness went
   29 → 30) but left the checkbox visibly ticked, so the UI asserted a confirmation the author never
   gave. In a feature that *is* a confirmation gate, this was the worst possible bug. The box is now
   synced by id rather than by re-rendering, which would have thrown focus out of the field mid-typing.
2. **Focus stranding.** `focusId: null` was meant to signal "ignore current focus", but `??` treats
   `null` as nullish and fell through to `document.activeElement`, so after a merge focus stayed on
   whatever button was last pressed. Replaced with an explicit `preserveFocus` flag. Verified: merge
   lands on the merged step, delete lands on the step that took its place.

**Still outstanding:** French alt text depends on `feature-bilingual-roundtrip`. No screen-reader
pass yet (`help.md` item 6). Nobody has visually looked at the editor.

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

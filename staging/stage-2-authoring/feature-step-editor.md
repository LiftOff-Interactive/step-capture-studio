# Feature: step-editor
_Stage: stage-2-authoring · Status: not started_

## Goal
Let the author fix Snagit's machine-written step text before it reaches learners — editing wording,
merging the duplicate consecutive steps Snagit produces, and reordering or removing steps.

## Success Criteria
- [ ] Every step's text is editable in place; edits update the capture model immediately.
- [ ] Consecutive steps with identical text are detected and surfaced with a **suggested merge** the
      author can accept or decline. In the real sample this must flag steps 3/4 and 7/8.
- [ ] Merging two steps keeps both screenshots on the resulting step (the model already allows an
      image array — this is what it is for).
- [ ] A step can be deleted, and deletion is undoable.
- [ ] Step numbering re-derives from position after any merge, delete, or reorder — never stored.
- [ ] All of it works by keyboard alone, including merge and reorder.
- [ ] Edits are announced to assistive tech via the existing `aria-live` region.

## How We'll Verify
1. `npm test` — unit tests for the dedup detector (including a French fixture, a no-duplicates
   fixture, and three-in-a-row duplicates) and for renumbering after merge/delete/reorder.
2. Load the real sample in the browser, confirm 3/4 and 7/8 are flagged and nothing else is, merge
   one, and confirm the result renumbers to 9 steps with both screenshots retained.
3. Keyboard-only pass over the full edit flow.
4. axe-core zero violations in the editing state.
5. Screenshot the flagged-duplicate UI and show the user.

## Verification Log
_Empty. Cannot be `verified done` until dated evidence appears here._

## Open Questions
- Should merged steps concatenate both texts, keep the first, or prompt? Leaning "keep the first,
  editable" — but decide with a real capture in front of you.
- Is reorder actually needed for v1, or is it speculative? Cut it if Stage 2 runs long; dedup and
  edit are the load-bearing parts.

## Notes & Decisions
Detection is automatic; **merging is never automatic**. Snagit sometimes emits genuinely distinct
steps that happen to share a label — silently collapsing them would lose a real screenshot.

# Feature: step-editor
_Stage: stage-2-authoring · Status: awaiting verification_

## Goal
Let the author fix Snagit's machine-written step text before it reaches learners — editing wording,
merging the duplicate consecutive steps Snagit produces, and reordering or removing steps.

## Success Criteria
- [x] Every step's text is editable in place; edits update the capture model immediately.
- [x] Consecutive steps with identical text are detected and surfaced with a **suggested merge** the
      author can accept or decline. In the real sample this must flag steps 3/4 and 7/8.
- [x] Merging two steps keeps both screenshots on the resulting step (the model already allows an
      image array — this is what it is for).
- [x] A step can be deleted, and deletion is undoable.
- [x] Step numbering re-derives from position after any merge, delete, or reorder — never stored.
- [ ] All of it works by keyboard alone, including merge and reorder. — focus management after
      merge/delete verified; **reorder was cut** and no full keyboard-only pass has been done.
- [ ] Edits are announced to assistive tech via the existing `aria-live` region. — merge and delete
      are announced; field edits deliberately are not (per-keystroke announcements would be hostile),
      but the readiness count changing is currently silent.

## How We'll Verify
1. `npm test` — unit tests for the dedup detector (including a French fixture, a no-duplicates
   fixture, and three-in-a-row duplicates) and for renumbering after merge/delete/reorder.
2. Load the real sample in the browser, confirm 3/4 and 7/8 are flagged and nothing else is, merge
   one, and confirm the result renumbers to 9 steps with both screenshots retained.
3. Keyboard-only pass over the full edit flow.
4. axe-core zero violations in the editing state.
5. Screenshot the flagged-duplicate UI and show the user.

## Verification Log

### 2026-07-21 — Built; automated PASS, browser PASS
**Automated:** 79/79. Merging keeps both screenshots and renumbers; a translation present only on the
later step survives the merge; merging step 1 throws; deleting renumbers and leaves the original
capture intact (which is how undo works); out-of-range edits throw rather than silently no-op;
`duplicatePairs` finds exactly the real duplicate and nothing on a clean capture.

**In-browser (Chromium 148, real 10-step capture):**
- **2 duplicate notices**, on steps 4 and 8 — exactly the known duplicates, no false positives.
- Merging step 4 → 9 steps, legends renumbered `Step 1 of 9`…, and **both screenshots retained** on
  the merged step.
- Deleting step 2 → 8 steps, announced as "Step 2 deleted."
- Undo restored 8 → 9 → 10 steps, with an unrelated alt-text edit still intact.
- Merge is offered, never applied automatically — asserted in tests, confirmed in the browser.

**Defect found and fixed:** focus was stranded after merge/delete (see the entry in
`feature-alt-text.md` — same root cause, one `??` treating `null` as nullish). Focus now lands on the
merged step, or on whichever step took a deleted one's place.

**Still outstanding:** reorder is not built — it was flagged as the first thing to cut and remains
cut. No screen-reader pass (`help.md` item 6). Nobody has visually looked at the editor.

## Open Questions
- Should merged steps concatenate both texts, keep the first, or prompt? Leaning "keep the first,
  editable" — but decide with a real capture in front of you.
- Is reorder actually needed for v1, or is it speculative? Cut it if Stage 2 runs long; dedup and
  edit are the load-bearing parts.

## Notes & Decisions
Detection is automatic; **merging is never automatic**. Snagit sometimes emits genuinely distinct
steps that happen to share a label — silently collapsing them would lose a real screenshot.

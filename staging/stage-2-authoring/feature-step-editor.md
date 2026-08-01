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

### 2026-08-01 — Wider step pane, equal columns, bilingual explanations

Four changes to the Edit steps phase, on Mike's instruction.

**The step pane was capped at a reading width.** `p, li, dd { max-width: var(--measure) }` keeps
prose lines short, and a step is an `<li>` — so every step in the editor was clamped to 68ch. At a
1280 viewport that was **585px inside an 869px column**, with the two halves squeezed to 324/216.
The cap is right for prose and wrong for a form of labelled controls. `.steps > .step` now opts out.

**The two halves are equal**, `minmax(0, 1fr)` each rather than 3fr/2fr. The fields side now carries
step text, alt text *and* the explanations in both languages, so the old split in favour of the
fields no longer matched what is in each column.

Measured after: 1280 → pane **867px**, columns **411/411**. 1600 → pane 1035px, columns 495/495 side
by side. 900 (below the 62rem breakpoint) → stacked, full width, no horizontal overflow.

**Explanations now have a field per language.** They were source-language only, on the reasoning that
the French arrives through the translation round trip. That left no way to write or fix a French
explanation by hand — and `emitCaseStudy` renders whichever languages carry narrative, so a capture
whose round trip was never run shipped a French worked example with the explanations **silently
missing**. Ids moved from `f-narr-{n}-{field}` to `f-narr-{n}-{field}-{code}`, and the drafted notice
is now per language: a reviewed English passage says nothing about an unreviewed French one. The form
is longer; the artifact is completable in both languages without leaving the app.

**"Export project file" removed from the toolbar.** It lives only in the header now, where it is
reachable from every phase — two buttons with the identical label on one screen read as two different
saves. The a11y test that asserted the header button matched its toolbar twin was rewritten to assert
there is exactly **one** control carrying `project.export`.

**Automated: 304/304** (was 300). New editor tests cover the per-language fields and their labels,
that editing the French field reports `fr` to the handler (reporting the source language there would
file French as English — the bug `feature-source-language` exists to undo), that the explanations
still vanish entirely when the worked example is off, and axe on the bilingual form.

**In-browser:** only `header-export` remains; 24 narrative groups on the demo (6 steps × 2 fields ×
2 languages) labelled "Why this step matters (English/French)" and the French equivalents; typing
into `f-narr-1-why-fr` and exporting the project file put the text in `div.note > div[lang=fr-CA]`.
No console errors.

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

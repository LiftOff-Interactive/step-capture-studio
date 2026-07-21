# Feature: html-walkthrough
_Stage: stage-3-generators · Status: not started_ · **Sketch — flesh out when Stage 2 is done**

## Goal
The headline artifact: the interactive guide learners actually use. Screenshot pane plus step rail,
one self-contained HTML file.

## Success Criteria
- [ ] Main pane shows the current screenshot and its instruction as real text in a visible box.
- [ ] A rail beside the pane lists every step; clicking one jumps to it.
- [ ] Arrow keys and Previous/Next move between steps; focus moves correctly with them.
- [ ] Current step is indicated by more than colour alone (WCAG 1.4.1).
- [ ] Progress is stated in text, e.g. "Step 3 of 10", and updated in an `aria-live` region.
- [ ] Language toggle swaps step text, alt text, and `<html lang>`.
- [ ] With JavaScript disabled, all steps render as a plain sequential document.
- [ ] Reflows to 320 px — rail stacks above or below the pane rather than scrolling horizontally.
- [ ] Self-contained, offline, AA conformant.

## How We'll Verify
Generate from the sample; open from `file://` with the network disabled; walk all 10 steps by
keyboard only; toggle language and confirm `lang` changes in DevTools; disable JS and confirm content
remains readable; axe-core zero violations in both languages; test at 320 px; screenshot and show the
user.

## Verification Log
_Empty. Cannot be `verified done` until dated evidence appears here._

## Open Questions
- Does the rail need to scroll independently for long captures, and does that create a keyboard trap?
- Should the current step be reflected in the URL hash so a specific step can be linked? Cheap to add,
  genuinely useful for support conversations.
- Deep-linking plus JS-disabled fallback may conflict — resolve when building.

## Notes & Decisions
This is the artifact to get right. If Stage 3 runs short on time, the other two give way to this one.

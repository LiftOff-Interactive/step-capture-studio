# Feature: case-study
_Stage: stage-3-generators · Status: not started_ · **Sketch — flesh out when Stage 2 is done**

## Goal
The narrative artifact: context and explanation for *why* each step matters, not just what to click.
The tool produces a structured skeleton and a copy-prompt; the human supplies the judgement.

## Success Criteria
- [ ] Skeleton includes, per step: the screenshot, the action, and fields for "Why this matters" and
      "What breaks if skipped".
- [ ] Document-level fields for scenario, audience, and outcome.
- [ ] A "Copy AI prompt" action builds a prompt containing all steps and the author's existing notes,
      requesting narrative for the empty fields.
- [ ] Pasting the response back populates fields by id, with the same strict validation as the
      translation round trip.
- [ ] AI-drafted passages are visually and semantically marked as unreviewed until the author
      confirms them — a reviewer must be able to tell drafted content from authored content.
- [ ] Bilingual, self-contained, AA conformant.

## How We'll Verify
Generate from the sample; run the copy-prompt round trip for real; confirm unreviewed passages are
distinguishable both visually and to a screen reader; axe-core zero violations; keyboard pass;
show the user.

## Verification Log
_Empty. Cannot be `verified done` until dated evidence appears here._

## Open Questions
- How strongly should unreviewed AI content be marked in the *exported* artifact? Marking it in the
  editor is obviously right. Marking it in the final deliverable is a judgement call — it is honest,
  but authors may find it unshippable and simply strip it.
- Should export be blocked while unreviewed passages remain, as alt text is? Consistent, but possibly
  too heavy for prose where a partial draft may be legitimate.
- Reuse the translation round-trip machinery, or keep the two prompts separate? Reuse is tempting;
  the validation logic is genuinely shared.

## Notes & Decisions
This artifact carries the project's main integrity risk: a confident, wrong *why* in training
material is worse than no *why* at all. Whatever else changes, the distinction between drafted and
authored content must survive.

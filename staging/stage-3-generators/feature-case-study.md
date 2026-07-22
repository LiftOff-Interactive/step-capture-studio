# Feature: case-study
_Stage: stage-3-generators · Status: awaiting verification_

## Goal
The narrative artifact: context and explanation for *why* each step matters, not just what to click.
The tool produces a structured skeleton and a copy-prompt; the human supplies the judgement.

## Success Criteria
- [x] Skeleton includes, per step: the screenshot, the action, and fields for "Why this matters" and
      "What breaks if skipped".
- [x] Document-level fields for scenario, audience, and outcome.
- [x] A "Copy AI prompt" action builds a prompt containing all steps and the author's existing notes,
      requesting narrative for the empty fields.
- [x] Pasting the response back populates fields by id, with the same strict validation as the
      translation round trip.
- [x] AI-drafted passages are visually and semantically marked as unreviewed until the author
      confirms them — a reviewer must be able to tell drafted content from authored content.
- [x] Bilingual, self-contained, AA conformant.

## How We'll Verify
Generate from the sample; run the copy-prompt round trip for real; confirm unreviewed passages are
distinguishable both visually and to a screen reader; axe-core zero violations; keyboard pass;
show the user.

## Verification Log

### 2026-07-21 - Built; automated PASS, in-browser PASS

**The integrity property, and how the open questions resolved.** The one thing that had to survive
is the distinction between a sentence a human stood behind and one a model guessed. Both open
questions resolved into the same answer: **the gate**.

- *How strongly should unreviewed AI content be marked in the exported artifact?* It is not marked,
  because **it cannot get there.** Export is blocked while any drafted passage is unconfirmed.
  Badging every paragraph in the deliverable would be honest but unshippable, and authors would
  strip it - which is worse, because then the marking is gone AND nobody reviewed anything.
- *Is blocking too heavy, given a partial draft may be legitimate?* The distinction that makes it
  bearable is **empty vs unreviewed**. An empty field claims nothing and is always allowed. A
  drafted-but-unconfirmed field makes a claim nobody checked. Only the second is gated.
- *Reuse the translation machinery?* Yes - `parseTranslationResponse` is shared, so an unknown id
  aborts the whole import here too.

**Two locks, not one.** The UI disables the download; the emitter itself throws on unreviewed
narrative. There is no path that produces the artifact without a review.

**Automated: 201/201** (20 in `test/case-study.test.js`, 14 in `test/emit-case-study.test.js`).
Includes: typed text is authored and never drafted; model output is always drafted; drafted text
blocks export; confirming is the only thing that clears the mark and leaves the words untouched;
editing a drafted passage counts as review; an empty passage cannot be confirmed into existence;
NEEDS AUTHOR is recorded as a refusal rather than stored as prose; the mark survives a
serialise/revive round trip; and the emitter refuses, naming exactly what is unreviewed.

**The prompt** carries the author's scenario as grounding and the whole step sequence, asks only for
fields still empty, forbids inventing policy names, system names, deadlines or amounts, and offers
NEEDS AUTHOR as a way to decline. It asked for 20 ids on the real capture.

**In-browser (Chromium 148, real 10-step capture):**
- With authored narrative only: **all three exports enabled**, "Ready to export."
- After applying a draft: **case study blocked, the other two still enabled** - per-artifact gating,
  not a blunt lock. Two "Drafted, not yet reviewed" notices appeared with review checkboxes.
- `s2w ||| NEEDS AUTHOR` left step 2 genuinely empty rather than storing the refusal.
- After reviewing both: gate reopened, notices gone, **the text unchanged** - review changes who
  stands behind a sentence, not the sentence.
- Emitted artifact: **1.08 MB**, 10 steps, 2 notes, 2 scenario rows, 10/10 images decoded,
  **axe 0 violations / 0 incomplete, contrast passing on 33 nodes**.

**French narrative** travels through the existing translation round trip rather than doubling the
form - and `collectTranslatable` deliberately excludes drafted passages, so an unreviewed guess is
never multiplied into a second language.

**Still outstanding:** printing untested. No screen-reader pass. Nobody has visually looked at the
artifact. Plural forms are wrong in generated counts ("1 items", "1 were returned") - see Open
Questions.

## Open Questions
- ~~How strongly should unreviewed AI content be marked in the exported artifact?~~ **RESOLVED** - it
  is never in the artifact, because export is blocked until reviewed.
- ~~Should export be blocked while unreviewed passages remain?~~ **RESOLVED** - yes, and the
  empty-vs-unreviewed distinction is what keeps it bearable.
- ~~Reuse the translation round-trip machinery?~~ **RESOLVED** - yes, `parseTranslationResponse` is
  shared.
- **NEW: plural forms are wrong in generated counts.** "1 items still need attention", "1 were
  returned as NEEDS AUTHOR". Fixing this properly needs `Intl.PluralRules` in `i18n.js` rather than
  string patching, and French pluralisation differs from English. Small, visible, not yet done.

## Notes & Decisions
This artifact carries the project's main integrity risk: a confident, wrong *why* in training
material is worse than no *why* at all. Whatever else changes, the distinction between drafted and
authored content must survive.

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

### 2026-08-01 — This artifact is now optional

An author can switch the worked example off on its phase, which collapses the scenario and narrative
fields, drops them from the translation prompt, stops unreviewed drafts blocking export, and removes
the card from the all-in-one. Nothing here changes when it is left on, which is the default and what
every capture written before the choice existed gets. See
`staging/stage-4-ship/feature-optional-worked-example.md`.

### 2026-08-01 — Step image capped on screen, not only in print

The print block already capped step images because an uncapped screenshot pushed its own explanation
onto the following page. The same defect existed on screen and surfaced in the all-in-one, which
embeds this document in an iframe barely taller than one step: `max-height: 46vh` with
`width`/`height: auto` now applies unconditionally. On a normal window the width cap already bound,
so the standalone artifact renders identically (measured: 736x419 before and after). Full write-up,
measurements and the browser pass are in `staging/stage-4-ship/feature-all-in-one.md` (2026-08-01).

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

### 2026-07-22 — Print sizing, bilingual chrome, and alt text pinned to English

**Printing verified by the author:** screenshots appear. But images printed at full page width,
so each step's explanation was orphaned onto the next page — the one thing a case study cannot do,
since the whole artifact exists to keep a screenshot next to the reason for it. Print now caps
images at 4.6in × 3.2in with `break-inside: avoid` on the figure. Measured in a real browser: a
screenshot went from 736px wide (overflowing a ~624px text column) to 441 × 251px, **29% of a page
instead of 100%**.

**Chrome was English in French mode** — "Case study" and "About this procedure" — same
`languages[0]` root cause as the other two artifacts. Fixed via `langLabel()`. Verified live:
`Case study → Étude de cas`, `About this procedure → À propos de cette procédure`,
`Step 1 of 6 → Étape 1 sur 6`.

**A WCAG defect the print check could not have shown:** alt text was pinned to `languages[0]`, so
in French every image went on describing itself in English. The walkthrough already solved this
with `data-alt-*` and an `artifact:langchange` listener; the case study never did. It now uses the
same mechanism. axe cannot catch this — it checks that alt text *exists*, not what language it is
in — so it is pinned by a bespoke assertion, mutation-tested.

**Naming:** `<title>` is now `TestingWindowsAudio_CaseStudy`, matching the download filename. The
visible `<h1>` still reads as prose; only `<title>` carries the file name.

### 2026-07-22 — Renamed "Worked example" in the UI and outputs

Author request: everything the user sees now says **"Worked example"** (FR "Exemple pratique"), not
"case study" — the on-page phase, the artifact `<h2>`, the download button, and the filename
(`..._WorkedExample.html`). The internal identifiers in this feature (`emitCaseStudy`,
`caseStudy.*` keys, `case-study.js`, the `#case-study` DOM id) are unchanged; only the visible
strings and the filename suffix moved. This file keeps its name and "case study" wording as the
historical record of how the artifact was built.

### 2026-07-23 — Superseded: drafted narrative IS now translated

The 2026-07-21 log above says `collectTranslatable` "deliberately excludes drafted passages." That
is no longer true. On author request, the translation prompt now offers every populated field,
drafted narrative included. It is safe because the worked-example export gate still blocks any
drafted passage: a translated draft returns drafted and cannot ship until reviewed. See
`docs/decisions.md`, 2026-07-23.

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

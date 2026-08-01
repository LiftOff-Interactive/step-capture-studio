# Feature: source-language
_Stage: stage-4-ship · Status: **awaiting verification** — built 2026-08-01_

## Goal
Let the author say which language the capture was actually recorded in, and move every parsed string
to match. A capture made with a French Snagit interface was being filed as English, which sent the
translation round trip backwards and put the wrong `lang` on every artifact.

## The problem, measured
The parser has always taken a `sourceLang`. The load path never passed one, so it defaulted to `en`
for every capture. Parsing a French capture through the app's real path (`app.js` → `parseSnagitDocx(bytes)`):

```
sourceLang            : en
step 1 text buckets   : {"en":"Cliquez sur le navigateur Web","fr":null}
```

Three consequences, all confirmed by running it:

1. **The translation prompt ran backwards.** It read *"Translate … from Canadian English (en-CA) to
   Canadian French (fr-CA)"* and was handed French. Whatever came back landed in `fr`, leaving French
   on both sides and English nowhere.
2. **The artifacts lied about their language.** The emitted walkthrough carried `<html lang="en-CA">`
   over French prose with no `lang="fr-CA"` override anywhere — a WCAG 3.1.1/3.1.2 failure in a tool
   whose output is meant to be AA. `render.js` already carries a comment about this exact hazard.
   The same wrong language flows into the Word document's proofing language.
3. **Alt-text drafting produced hybrids** — `"Screenshot showing: Cliquez sur le navigateur Web"`,
   an English template around French, filed under `en`.

The export gate does stop a *half-authored* capture. It cannot see a *mislabelled* one.

## The shape, and why
- **A correction moves text; it does not relabel it.** Setting `sourceLang` alone would leave the
  French prose sitting in the `en` bucket and every consumer would still read it as English. So
  `setSourceLang` **exchanges** the two languages' buckets across the whole capture: title, scenario,
  step text, alt text, alt confirmations, and narrative passages.
- **The exchange is gated, precisely because it is lossless.** Swapping over authored work would file
  that work under the other language and read as nonsense. `sourceLangReadiness` reports every item
  in the way — by step index and field — and `setSourceLang` refuses. Confirmed alt text blocks even
  with no text of its own: which language was reviewed is authored state in its own right.
- **It lives in `src/lib/source-lang.js`, not `authoring.js`.** It reaches into narrative and scenario
  as well as text and alt, so folding it into either existing module would have tangled the two.
- **Narrative slots keep their `{text, drafted}` shape.** A bare key swap would have written `null`
  where a passage was; `emptyPassage` is now exported from `case-study.js` so the invariant has one
  home rather than two.
- **A radio group on Capture details, not a toggle button in the header.** This is a value belonging
  to the capture, sitting where the other capture metadata is edited, in the phase immediately after
  load — before any translation work starts. The header's `aria-pressed` pair is for view modes.
- **Undoable.** It goes through `commit()`, so a misclick costs one Undo rather than a reload.
- **Not auto-detected.** The obvious signal is the step verbs, and keying logic off those is the one
  thing CLAUDE.md forbids. The docx may carry `dc:language`, but there is still no real French-Snagit
  capture to test that against (`help.md` 3), and this project verifies against the real consumer
  rather than the specification.

## Success Criteria
- [x] A French capture can be corrected to `fr`, and every string moves with it.
- [x] After correcting, the translation prompt asks fr → en instead of en → fr.
- [x] Title, scenario, alt text, alt confirmations and narrative all travel.
- [x] The swap refuses when the target language already holds authored work, naming what is in the way.
- [x] Correcting and correcting back is the identity; the input capture is never mutated.
- [x] The control is a labelled radio group, named by a legend, described by the hint, in both languages.
- [x] Undo restores both the model **and** the control.
- [ ] **A real French-Snagit capture**, loaded and corrected end to end. — *human, blocked on `help.md` 3.*

## How We'll Verify
1. `npm test` — the transform, its gate, and the markup contract.
2. Drive the real app in a browser: load a French `.docx`, correct the language, undo, and confirm
   the fields and the radio agree with the model at every step.

## Verification Log

### 2026-08-01 — Built. Automated PASS, in-browser PASS, one bug found and fixed.

**Automated: 286/286** (was 275). `test/source-lang.test.js` covers the move, the translation
direction flipping, every bucket travelling, the `{text, drafted}` shape surviving, the refusal (both
step text and confirmed alt), the no-op, the unknown language, non-mutation, and the round-trip
identity. `test/a11y.test.js` gained the markup contract, mutation-tested twice: dropping the French
radio's label fails it, and turning the fieldset into a div fails it.

**In-browser, Chromium against the local server, with a synthetic French capture:**
- Loaded → radio on English, step field shows `Cliquez sur le navigateur Web`. The reported bug.
- Clicked French → status announced *"Source language set to French. The step text moved with it."*
  Step text moved from the `-en` fields to the `-fr` fields for all three steps; title moved from
  `title-en` to `title-fr`; Undo became available.
- Undo → radio back to English, text and title back where they started.
- The demo capture (fully authored in both languages) → refused, as designed:
  *"…22 items are already written in French…"* in the `role="alert"` region, radio snapped back.
- Both languages: legend, labels and hint all swap; `aria-describedby` resolves. No console errors.

**Bug found in the browser that the green suite could not see.** Undo called `rerenderSteps()` only.
Every history entry until now was step-scoped, so that was the whole picture; the source language is
the first operation that moves capture-level state, and undoing it left the radio, the title fields
and the scenario inputs showing the state that had just been undone. Extracted `syncCaptureFields()`
and called it from both `renderAll` and undo. **This is the third time this render seam has shipped a
bug with every test passing** — see `failed-approaches.md`, "disabled state only updates on
re-render". It is still not covered by an automated test, because jsdom does not run `app.js`.

Status stays **awaiting verification**: the last criterion needs a real French-Snagit capture.

## Open edges
- **Detection.** If a real French-Snagit `.docx` turns out to carry a trustworthy `dc:language` or a
  French metadata line (`N étapes`), the control could default to the detected value instead of
  always English, with the radios left as the correction. Untestable until such a capture exists.
- **The gate is all-or-nothing.** An author who has typed one French sentence must clear it before
  correcting. A "move it aside and let me re-enter it" path would be friendlier, and is more machinery
  than the problem currently justifies.
- **`languages` order is untouched.** `sourceLang` and the display order are independent; the primary
  display language is still `languages[0]`. Worth revisiting if a French-source capture should also
  default the artifacts to French-first.

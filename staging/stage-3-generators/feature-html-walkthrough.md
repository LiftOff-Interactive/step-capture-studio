# Feature: html-walkthrough
_Stage: stage-3-generators · Status: awaiting verification_

## Goal
The headline artifact: the interactive guide learners actually use. Screenshot pane plus step rail,
one self-contained HTML file.

## Success Criteria
- [x] Main pane shows the current screenshot and its instruction as real text in a visible box.
- [x] A rail beside the pane lists every step; clicking one jumps to it.
- [x] Arrow keys and Previous/Next move between steps; focus moves correctly with them.
- [x] Current step is indicated by more than colour alone (WCAG 1.4.1).
- [x] Progress is stated in text, e.g. "Step 3 of 10", and updated in an `aria-live` region.
- [x] Language toggle swaps step text, alt text, and `<html lang>`.
- [x] With JavaScript disabled, all steps render as a plain sequential document.
- [x] Reflows to 320 px — rail stacks above or below the pane rather than scrolling horizontally.
- [x] Self-contained, offline, AA conformant.

## How We'll Verify
Generate from the sample; open from `file://` with the network disabled; walk all 10 steps by
keyboard only; toggle language and confirm `lang` changes in DevTools; disable JS and confirm content
remains readable; axe-core zero violations in both languages; test at 320 px; screenshot and show the
user.

## Verification Log

### 2026-08-01 — Screenshot beside its instruction, not above it

**Reported by Mike:** in the all-in-one, the walkthrough "has stacked interaction (text on top of
image)".

**Measured, all-in-one at a 1280 window.** The panel frame was 960×596. A step measured **644px**,
taller than the frame showing it: image 911×518 at full column width, instruction at y=1017 — 532px
below the top of the picture it describes. Same defect the worked example had; here there was width
going spare, so the fix was to use it rather than only to shrink the image.

**Two changes.** Every step's figures are wrapped in `.step__media`, so the grid has exactly two
children however many images a step carries — omitted entirely when a step has none, and the CSS
gives the instruction full width by keying off that absence. The step then becomes a two-column grid
with the heading spanning both.

**A container query, not a media query.** How much room a step has depends on whether the 17rem rail
is showing, and this document is embedded in an iframe as well as opened standalone — so the viewport
does not answer the question. Measured proof: an **800px frame gives the steps 751px**, while a
**1000px frame gives only 664px**, because the rail appears in between. A viewport media query would
have had that backwards. Browsers without container queries keep the stacked layout, which is what
shipped before.

**Result, same panel:** step **309px** (was 644), image 444×253 in the left column, instruction 444px
wide beside it, and the step now fits the frame with no outer scroll.

**Swept the width**, driving the frame directly: side by side at 1400/1000/800/700; stacked at 660 and
below (the container falls under the 40rem threshold); no horizontal overflow at any width down to
360. Standalone artifact at 1280: rail visible, side by side, aspect ratio preserved, no overflow, no
console errors.

**Print pinned to stacked.** The printed content box lands right on the container threshold, close
enough to flip on a margin change, and printing was already verified stacked — so `@media print` sets
`display: block` explicitly and caps the image at 3.2in, matching the worked example.

**Automated: 307/307** (was 304). Three tests, all mutation-tested: the wrapper contract (emitting
bare figures again fails it), the rule being a container query (swapping in a media query fails it),
and print staying stacked (dropping the pin fails it).

### 2026-07-21 - Built; automated PASS, in-browser PASS

**One DOM, two modes.** The emitted document is a plain sequential guide with scripting off and a
two-pane viewer with it on - not two implementations. Without script: a navigation rail of ordinary
fragment anchors followed by every step in full, both languages. With script: all but the current
step is hidden, the rail gains `aria-current`, Previous/Next and arrow keys appear, and the fragment
stays in sync. **The fragment is what reconciles deep-linking with the no-JS fallback** - the open
question in this file. The same URL works in both modes because the step ids are real ids.

**Automated: 167/167** (21 in `test/emit-walkthrough.test.js`). Both modes are exercised as
first-class states: no-JS shows every step with nothing hidden and viewer-only controls suppressed;
JS mode shows exactly one. Also covered: Previous/Next with progress, Next disabling at the end
rather than wrapping silently, Arrow/Home/End keys, modifier keys NOT hijacked (Ctrl+Arrow belongs
to the browser and the screen reader), focus moving to the step itself, exactly one `aria-current`
at all times, rail clicks, deep links, per-language alt swapping, and axe in both modes.

**In-browser (Chromium 148, real 10-step capture, authored to completion):**
- **1.09 MB**, all **10/10 screenshots decoded at 1040x596**
- Rail click -> step 3 shown, focus on step 3, `aria-current` moved
- Next -> step 2 with "Step 2 of 10"; End -> step 10 with Next disabled
- Language toggle -> `<html lang>` `fr-CA`, progress "Étape 3 sur 10", alt text switched to the
  French description
- **axe: 0 violations, 0 incomplete, contrast passing on 29 nodes** - both languages
- **Reflow at 320 px:** `scrollWidth` 305 = `clientWidth` 305, no horizontal scroll, **zero**
  overflowing elements, the rail stacked above the steps, and the screenshot scaled to fit

**Two defects found in the browser and fixed - neither visible to the tests:**
1. **`loading="lazy"` left every screenshot undecoded.** The images are data URIs already in the
   file, so deferring them saves no request, but a lazy image never scrolled into view can print
   blank and stayed undecoded entirely while its step was hidden. Caught only because the browser
   check reported `imagesDecoded: 0` against 10 inlined images.
2. **An unguarded `history.replaceState` killed the rail.** In a context with an opaque URL it
   throws, and sitting before the navigation it took the whole click handler with it - clicks did
   nothing at all. Keeping the URL in sync is a nicety; changing the step is the feature.

Both are in `docs/failed-approaches.md`. Regression tests were added for each.

**Still outstanding:** printing is untested. Nobody has visually looked at the artifact. No
screen-reader pass. The rail's independent scrolling on long captures (an open question below) has
not been tried with a capture long enough to need it.

### 2026-07-22 — Chrome was never bilingual; print confirmed

**Printing verified by the author:** screenshots appear in print. The `loading="lazy"` class of
failure — blank images on paper, invisible on screen — is retired by observation, not by argument.

**Defect found by the same pass:** the rail heading and the Previous/Next buttons stayed English in
French mode. Same root cause as the other two artifacts — chrome resolved once against
`languages[0]` while content was correctly per-language. Fixed via `langLabel()`.

Verified in a real browser: `Steps → Étapes`, `Previous step → Étape précédente`,
`Next step → Étape suivante`, progress `Step 1 of 6 → Étape 1 sur 6`, and image alt text
`Screenshot showing: … → Capture d'écran 1`. Round-trips back to English cleanly.

**Naming:** `<title>` is now `TestingWindowsAudio_Walkthrough`, matching the download filename.

## Open Questions
- Does the rail need to scroll independently for long captures, and does that create a keyboard trap?
  The rail is `position: sticky` with `overflow-y: auto` above 60rem, but 10 steps never exercise it.
  **Unresolved** - needs a capture long enough to overflow.
- ~~Should the current step be reflected in the URL hash?~~ **RESOLVED** - yes, and it is what makes
  deep-linking work in both modes.
- ~~Deep-linking plus JS-disabled fallback may conflict.~~ **RESOLVED** - they do not. The rail links
  are ordinary anchors to real ids, so the browser handles them natively without script, and the
  viewer reads the same fragment with it.

## Notes & Decisions
This is the artifact to get right. If Stage 3 runs short on time, the other two give way to this one.

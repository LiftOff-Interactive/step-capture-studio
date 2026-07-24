# Feature: replace-image
_Stage: stage-2-authoring · Status: **awaiting verification** — built 2026-07-24_

## Goal
Let the author swap the file behind any screenshot, in place, without reloading the whole capture —
for when a shot came out wrong (blurry, cropped, the wrong screen, an accidental bit of surrounding
UI). A per-image "Replace image" button on each step.

## Why it belongs in the authoring layer
The parser reports and never repairs; every human decision is applied here (edit, merge, alt text,
decorative). Replacing a bad screenshot is the same kind of act, and it must be immutable and
undoable like the rest — so it is one more `authoring.js` operation, not a special path.

## Success Criteria
- [x] Every image in the editor has its own "Replace image" control (a merged step can hold several).
- [x] Only **PNG or JPEG** is accepted, checked by file signature — not by extension, and not by the
      forgiving `imageType` fallback that relabels unknown bytes as PNG.
- [x] The new file's pixel dimensions are measured (in the browser, so JPEG works too) and stored, so
      the `.docx` keeps the right aspect ratio rather than the 600×400 fallback box.
- [x] The swap keeps everything the author already decided about the slot: alt text, the decorative
      flag, the image `id`, and its source `path`.
- [x] The swap **resets that step's alt-text confirmation** — the picture the alt describes has
      changed, so it must be re-verified before export (author's choice, 2026-07-24). The export gate
      re-closes for that step until re-confirmed.
- [x] A non-image file is refused with a clear bilingual message, and the existing image is untouched.
- [x] The control is keyboard-operable with a visible focus indicator, and the whole editor stays
      axe-clean.
- [x] The replacement survives the project-file round trip (it is just a capture with new bytes).
- [ ] Screen-reader pass over the new control (`help.md` 6) — *human, shared with the rest of the
      project.*

## How We'll Verify
1. `npm test` — `replaceImage` unit tests (swap, preservation, confirmation reset, immutability,
   bad input) and the existing project round trip.
2. In a browser: replace a real screenshot, confirm it renders, the gate re-closes, re-confirming
   re-opens it, a `.txt` is refused, and the replacement survives an export.

## Verification Log

### 2026-07-24 — Built; automated PASS, browser PASS

**Design.** `replaceImage(capture, stepIndex, imageId, { bytes, width, height })` in `authoring.js`:
immutable `mapImage` swap of bytes + dimensions, keeping `id`/`path`/alt/decorative and resetting
`altConfirmed` to all-false. Dimensions are the caller's to supply — only PNG has a byte-level size
reader here, so `app.js` decodes the file with `createImageBitmap` (any browser format) and passes
them in, keeping the authoring layer pure and jsdom-testable. The picker is the canonical accessible
file-button: a real `<label>` styled as a button plus a visually-hidden **but focusable** `<input>`,
with a `:focus-within` ring so keyboard focus is never invisible. PNG/JPEG validated by signature,
because `imageType` deliberately falls back to PNG and would wave a garbage file through.

**Automated: 262/262** (was 255). 7 new in `authoring.test.js`: swap of bytes+dims; preservation of
alt/decorative/id/path; confirmation reset; the reset re-opening the step's export gate;
immutability; unknown-id `RangeError`; empty-bytes refusal.

**In-browser (dev server, real demo):**
- 6 "Replace image" controls, one per image; demo arrives export-ready.
- Replaced step 1's 771×438 JPEG with a 320×200 PNG → image re-rendered, **dimensions updated to
  320×200**, status announced "Screenshot replaced in step 1. Re-check its alt text before export.",
  and **the export gate re-closed** (quick-steps button disabled) because confirmation reset.
- Re-ticked step 1's verification → gate re-opened.
- Dropped a `.txt` on step 2 → refused with "That file is not a PNG or JPEG image…", the step-2 image
  unchanged.
- The autosaved project HTML now carries step 1 as a **PNG** data URI with `data-width="320"
  data-height="200"` — the replacement (and its format change) survives serialization; the parse side
  is already guarded by `project-roundtrip.test.js`.
- Keyboard: focusing the hidden input lights the label's focus ring (`:focus-within`, ~3px solid).
- axe over the editor with the controls present: **0 violations, 0 incomplete**. Bilingual: label
  "Replace image" / "Remplacer l’image".

**Outstanding:** no screen-reader pass (`help.md` 6). Status stays **awaiting verification**.

## Notes & Decisions
- **Confirmation reset was a deliberate choice, not an accident.** The lower-friction alternative
  (carry the confirmed alt over untouched) risks shipping a genuinely different screenshot with
  author-"confirmed" alt text that no longer matches it. The author chose the accessibility-first
  reset, consistent with `setAltText` unconfirming on every text edit.
- **Dimensions decoded in the UI, not the model.** Keeps `authoring.js` free of browser APIs and
  testable under jsdom; the emitters already degrade gracefully if width/height are ever null.

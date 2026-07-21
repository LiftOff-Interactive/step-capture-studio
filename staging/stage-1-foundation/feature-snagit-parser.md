# Feature: snagit-parser
_Stage: stage-1-foundation · Status: verified done_

## Goal
Turn the raw package entries from `docx-reader` into the normalised **capture model** that every
other part of the system consumes. This is the adapter boundary: a future Steps Recorder parser will
emit this exact shape, and no emitter will ever know which format it came from.

## Background — confirmed structure
Verified against the real sample on 2026-07-21. `word/document.xml` held 23 paragraphs in this order:

| Paragraph | Content |
|---|---|
| 0 | Title — the application name (`Microsoft Edge`) |
| 1 | Metadata — `A. Author \| 10 steps \| 1 minute` |
| 2 | Date — `July 21, 2026` |
| 3, 5, 7 … | Step text — `1. Click on Microsoft Edge`, `2. Click "Sign in"`, … |
| 4, 6, 8 … | A single image each, via `r:embed` → `word/_rels/document.xml.rels` → `media/imageN.png` |

`docProps/core.xml` additionally supplies `dc:creator` and `dcterms:created`.

## Target model
```js
{
  title, author, duration, createdAt, sourceLang,
  steps: [{
    index,                          // 1-based, from document order — NOT parsed from the text
    text: { en: "...", fr: null },  // numbering prefix stripped
    images: [{ id, path, bytes, width, height, alt: { en: null, fr: null } }]
  }]
}
```

## Success Criteria
- [x] The real sample yields exactly **10 steps**, each with exactly **1 image**.
- [x] Step *n*'s text is paired with the screenshot that follows it in document order.
- [x] The `N.` numbering prefix is stripped from step text; `index` comes from document order instead.
- [x] `title`, `author`, and `createdAt` are populated from the header paragraphs and/or
      `docProps/core.xml`.
- [x] Image `width`/`height` are read from the PNG header (native resolution), not from the Word
      display extent.
- [x] **No logic keys off English words.** A capture whose steps read `Cliquez sur …` parses
      identically. Only the `N.` numbering pattern is matched.
- [x] A step paragraph with no following image, or an image with no preceding text, is preserved
      rather than silently dropped — the model tolerates the mismatch and flags it.
- [x] Duplicate consecutive step text is **preserved** here and flagged for the authoring layer.
      The parser reports; it does not edit.

## How We'll Verify
1. `npm test` — `test/parse-snagit.test.js` against the synthetic fixture:
   - asserts step count, image count, and text↔image pairing
   - asserts numbering prefixes are stripped and `index` is sequential from 1
   - asserts a French-language fixture (`Cliquez sur …`) parses to the same structure
   - asserts an orphan-image and an orphan-text fixture do not throw and set the mismatch flag
   - asserts duplicate consecutive step text survives parsing and is flagged
2. **Real-file check:** load `snagit Test.docx` through the live page and confirm the 10 parsed steps
   match the table above exactly, including that steps 3/4 and 7/8 are the known duplicates.
3. Record both results below.

## Verification Log

### 2026-07-21 — Step 1 (automated) PASS
`npm test` on Node v24.16.0 — **29 passed, 0 failed**, 142 ms (13 reader + 16 parser). Parser tests
cover: step/image pairing, prefix stripping with index from document order, **text split across three
runs**, the two-run metadata line, a French capture (`Cliquez sur …`) parsing identically, a
three-language model proving no hardcoded language pair, native image dimensions, empty alt slots,
duplicate preservation + flagging, step-without-image, trailing image, leading orphan image,
declared/actual count mismatch, no false positives on a clean capture, accented characters, and XML
entity unescaping.

### 2026-07-21 — Step 2 (real file, Node) PASS
Parsed the real `snagit Test.docx` in **25.5 ms**:
- **10 steps, 10 images**, every step paired with the correct screenshot, all 1040×596
- `title` "Microsoft Edge" · `author` "A. Author" · `duration` "1 minute" · `date` "July 21, 2026" ·
  `createdAt` 2026-07-21T20:14:00Z · declared count 10 = parsed count 10
- Step text matches the source exactly, numbering stripped, including the long step 9
- **Warnings: exactly 2** — `DUPLICATE_STEP_TEXT` at steps 4 and 8. These are the known real
  duplicates (`Click "My courses"`, `Click "Open in Word"`) predicted from the raw XML
  before the parser existed. **Zero false positives.**
- `fr` and all `alt` slots empty, as designed — Stage 2 fills them.

### 2026-07-21 — Step 2 (browser) PASS
Chromium 148, real sample loaded through the actual file input at `http://localhost:8080`:

- **10 steps rendered, 10 images**, every one decoded at 1040×596
- Status announced: `"10 steps loaded from Microsoft Edge."`
- Metadata rendered: Author `A. Author` · Duration `1 minute` · Recorded `July 21, 2026` · Steps `10`
- Step 1 text `"Click on Microsoft Edge"`, labelled `"Step 1 of 10"`
- **Warnings: exactly 2**, both `DUPLICATE_STEP_TEXT` (steps 4 and 8), rendered as translated
  sentences. Same result as the Node run — no browser-specific divergence.
- Switched to French: all chrome translated, `Étape 1 sur 10`, warnings in French, images retained.

**All success criteria met and the procedure fully executed → `verified done`.**
(Live-URL confirmation belongs to `feature-pages-deploy`, which is deliberately deferred.)

## Open Questions
- Does Snagit ever emit more than one image per step (e.g. a zoomed inset)? The model allows an array
  to avoid painting into a corner, but no sample exercises it.
- Is the metadata line's format (`author | N steps | duration`) stable across Snagit versions and
  locales? A French export may read `10 étapes`. Parse it defensively: split on `|`, take the count
  from the digits, and never fail the whole parse if this line is unrecognised.
- Is the title paragraph always the application name, or is it user-editable in Snagit?

## Notes & Decisions
The parser's job is **fidelity, not improvement**. Dedup, editing, and alt text all belong to the
authoring layer in Stage 2. Keeping this module free of "helpful" cleanup is what lets the golden-file
tests stay meaningful.

### ⚠️ Word splits text across runs — found 2026-07-21
Running the real sample through `docx.js` showed the metadata line arrives as **two separate `<w:t>`
runs**, not one:

```
run 1: "A. Author"
run 2: " | 10 steps | 1 minute"
```

Word splits runs at arbitrary points (formatting changes, spellcheck boundaries, revision marks), so
a paragraph's text is the **concatenation of all its runs**. Any parser that reads the first `<w:t>`
per paragraph will silently truncate step text — and it will look fine on short steps, which is
exactly how this ships broken.

**Therefore:** extract per `<w:p>`, join every `<w:t>` inside it, and preserve
`xml:space="preserve"` whitespace. Add a fixture with a step deliberately split across three runs.

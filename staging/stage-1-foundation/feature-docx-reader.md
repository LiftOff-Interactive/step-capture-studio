# Feature: docx-reader
_Stage: stage-1-foundation · Status: awaiting verification_

## Goal
Read a `.docx` file's bytes in the browser and return every entry in the package as raw bytes, using
only browser-native APIs. This is the foundation everything else sits on: no dependency here means no
dependency anywhere in the read path.

## Background — confirmed facts about the format
Verified against the real sample on 2026-07-21 by unzipping it and inspecting compression methods:

- A `.docx` is a ZIP archive.
- XML parts (`word/document.xml`, `word/_rels/document.xml.rels`, `docProps/core.xml`) are stored
  with **method 8 (Deflate)** → inflate with `new DecompressionStream('deflate-raw')`.
- Embedded PNGs (`word/media/*.png`) are stored with **method 0 (Stored/uncompressed)** → slice the
  bytes directly out of the buffer, no decompression at all.
- The sample contained 10 PNGs at 1040×596 native resolution.

Because both cases are covered natively, no ZIP library is needed.

## Success Criteria
- [x] Given `.docx` bytes, returns a map of entry path → `Uint8Array` for every entry in the archive.
- [x] Correctly inflates Deflate entries — `word/document.xml` parses as well-formed XML.
- [x] Correctly extracts Stored entries — each PNG begins with the bytes `89 50 4E 47` and its
      decoded width/height match the values in the source file.
- [x] Reads the ZIP **central directory** rather than scanning local file headers, so entries with
      data descriptors do not corrupt the result.
- [x] A file that is not a valid ZIP produces a clear, translatable error, not a stack trace.
- [x] A valid ZIP that is not a Word document produces a distinct, translatable error.
- [x] No global state; the module exports a pure async function.

## How We'll Verify
1. `npm test` — `test/docx.test.js` runs against `test/fixtures/synthetic-capture.docx`:
   - asserts the entry list contains `word/document.xml` and `word/media/image1.png`
   - asserts `document.xml` bytes decode to a string starting with `<?xml`
   - asserts every `word/media/*.png` entry starts with the PNG magic number
   - asserts a truncated/corrupt input rejects with the expected error code
2. **Browser check** (the part tests cannot cover — `DecompressionStream` is a browser API, and
   whether it is available in the user's target browsers is an open risk): load the real sample
   through the live page, open DevTools, confirm 10 PNGs are extracted with correct dimensions and
   that zero network requests fire after page load.
3. Record both results below, including the browser and version used.

## Verification Log

### 2026-07-21 — Step 1 (automated) PASS
`npm test` on Node v24.16.0 — **13 passed, 0 failed**, 120 ms. Covers: entry enumeration, Deflate
inflation to well-formed XML, Stored extraction with PNG signature and dimension checks, native
resolution (1040×596) rather than Word's display extent, both compression methods on any entry,
UTF-8 round trip (`« Français »`, `Réal Côté`), directory-entry skipping, and five error paths
(`NOT_A_ZIP` ×2, `NOT_A_DOCX`, truncation, `NOT_A_PNG`).

### 2026-07-21 — Step 2 (real file, Node) PASS
Ran `src/lib/docx.js` against the real `snagit Test.docx` (843 KB) outside the test suite:
- 31 entries parsed in **26.2 ms**
- `word/document.xml` → 18,519 chars, well-formed, ends `</w:document>`
- **10 images, all 1040×596**
- Extracted byte lengths match the original archive **exactly** (18314 / 35718 / 39752 / 45609 /
  98839 / 80984 / 64708 / 52173 / 52410 / 351724) — extraction is byte-faithful, not approximate.

### 2026-07-21 — Step 2 (browser) NOT YET RUN
The in-browser half of the procedure cannot run until `feature-app-shell` exists — there is no page
to load the file through. Node provides the same `DecompressionStream`/`Blob`/`Response` APIs, so the
code path is genuinely exercised above, but **real-browser support remains unproven** (Open Question
below, risk #4 in the master plan).

**Status stays `awaiting verification` for this reason.** Every success criterion is met; the
stated procedure is not yet fully executed. Do not mark `verified done` until a browser run is
recorded here with its browser and version.

## Open Questions
- Is `DecompressionStream('deflate-raw')` available in the browsers this must support? Believed
  broadly available in current Chrome/Edge/Firefox/Safari but **not yet verified** — this is
  risk #4 in the master plan and this feature is where it gets settled. If a target browser lacks it,
  the fallback is a hand-written inflate (~200 lines) rather than adding a dependency.
- Do Snagit exports ever store XML entries with method 0, or PNGs with method 8? Only one sample
  exists, so the reader must handle both methods for every entry regardless of what the sample shows.

## Notes & Decisions
Handle **both** compression methods for **all** entries. The observed pattern (XML deflated, PNG
stored) is what Word happened to write for this file, not a guarantee of the format.

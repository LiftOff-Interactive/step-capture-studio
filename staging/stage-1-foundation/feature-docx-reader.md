# Feature: docx-reader
_Stage: stage-1-foundation · Status: verified done_

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

### 2026-07-21 — Step 2 (browser) PASS — **risk #4 retired**
Browser: **Chromium 148**, page served from `http://localhost:8080` via `tools/serve.mjs`.

- `typeof DecompressionStream` → `"function"`; `new DecompressionStream('deflate-raw')` constructs
  without throwing. **This is the assumption the entire zero-dependency architecture rests on, and
  it now has evidence.**
- Loaded the real 843 KB sample through the actual file input (`change` event, not a backdoor):
  **10 images extracted, all decoding at 1040×596** with `naturalWidth > 0` — i.e. the browser
  really decoded them, not merely accepted the bytes.
- **Zero console messages** of any kind.
- Network log after load: page assets and `blob:` object URLs only. No external host, no server
  round-trip for file handling. (The single `.docx` fetch in the log is the test harness staging the
  sample, not the application.)
- Error path: a non-ZIP file surfaces `NOT_A_ZIP` as translated text in a `role="alert"` region;
  results stay hidden.

**Note on scope:** verified on a local server, not the Pages URL, because Pages is deliberately
deferred (see `feature-pages-deploy`). The live-URL check belongs to that feature. What this feature
needed to prove — that browser-native decompression works on a real capture — is proven.

**All success criteria met and the procedure fully executed → `verified done`.**

## Open Questions
- ~~Is `DecompressionStream('deflate-raw')` available?~~ **RESOLVED 2026-07-21** — confirmed working
  in Chromium 148, which is the agreed target (current Chrome/Edge only). No fallback inflate needed.
  A guard is in place regardless: if the API is absent the file input is disabled and a translated
  "browser too old" message is shown, so it degrades with an explanation rather than silently.
- Do Snagit exports ever store XML entries with method 0, or PNGs with method 8? Only one sample
  exists, so the reader must handle both methods for every entry regardless of what the sample shows.

## Notes & Decisions
Handle **both** compression methods for **all** entries. The observed pattern (XML deflated, PNG
stored) is what Word happened to write for this file, not a guarantee of the format.

# Handoff — step-capture-studio
_Last updated: 2026-07-21 · Current stage: stage-1-foundation_

## 🎯 Goals
Get a real Snagit `.docx` parsed entirely in the browser and rendered at a live GitHub Pages URL,
accessible and keyboard-operable from the first commit.

## 📍 Current State
- Project scaffolded. Docs, staging tree, slash commands, and leak-guard hook are in place.
- Git initialised on `main`. No GitHub remote yet — repo not created.
- Snagit `.docx` structure **confirmed against a real sample**: XML parts are Deflate, PNGs are
  Stored (uncompressed), layout is title → `author | N steps | duration` → date → alternating
  text/image pairs. Zero-dependency parsing is viable.
- **No application code written yet.** Nothing has been verified working.
- Sample file lives at `<your-downloads-folder>\snagit Test.docx` — outside the repo, deliberately.

## 📂 Files I'm Working On
- `src/lib/docx.js` — zero-dep `.docx` unzip. Not yet created.
- `src/lib/parse-snagit.js` — step/image pairing into the normalised model. Not yet created.
- `test/parse-snagit.test.js` — golden-file tests. Not yet created.

## ✅ Things I've Changed
- 2026-07-21 — Scaffolded the full doc structure and staging tree.
- 2026-07-21 — Confirmed Snagit `.docx` internals against the real sample (see docs/decisions.md).

## ❌ Watch Out
- Only **one** sample capture exists. The parser will overfit unless kept structural, not textual.
- The repo is public and captures are internal government systems — never commit one, never `--no-verify`.
- Accessible `.docx` writing with zero deps is unproven; spike it early, not in stage 4.

## ➡️ Next Up
1. Write `src/lib/docx.js`: read `.docx` bytes → `{ [path]: Uint8Array }` using `DecompressionStream`.
2. Write `test/fixtures/build-fixture.mjs` to derive a **synthetic** fixture from the real sample so
   tests run without the private file.
3. Write `src/lib/parse-snagit.js` and prove it yields 10 steps + 10 images from the sample.

## 🔗 Pointer
→ Current stage folder: `staging/stage-1-foundation/` · Active feature file:
`staging/stage-1-foundation/feature-docx-reader.md`

# Handoff — step-capture-studio
_Last updated: 2026-07-21 · Current stage: stage-1-foundation_

## 🎯 Goals
Get a real Snagit `.docx` parsed entirely in the browser and rendered at a live GitHub Pages URL,
accessible and keyboard-operable from the first commit.

## 📍 Current State
- **`docx-reader` is written and passing** — 13/13 tests, and it parses the real 843 KB sample in
  26 ms: 31 entries, 10 images at 1040×596, byte lengths matching the source archive exactly.
  Status is `awaiting verification`, **not done**: the browser half of its procedure needs a page
  that does not exist yet.
- Zero runtime dependencies confirmed working — `DecompressionStream` handles Deflate, Stored
  entries slice directly. **Browser support still unproven** (Node was used).
- Leak-guard hook tested for real: blocked both a `.docx` and a stray `.png`.
- No parser, no UI, no repo on GitHub yet.

## 📂 Files I'm Working On
- `src/lib/docx.js` — done, awaiting browser verification.
- `test/helpers/synthetic.mjs` — in-memory fixture builder; also proves the ZIP-writing half of the
  Stage 4 `.docx` writer works.
- `src/lib/parse-snagit.js` — next to write.

## ✅ Things I've Changed
- 2026-07-21 — Wrote `src/lib/docx.js` + 13 tests; verified against the real sample.
- 2026-07-21 — Added in-memory synthetic fixtures so no capture file ever enters the repo.
- 2026-07-21 — Added `.gitattributes` forcing LF on the hook (CRLF would silently disable it).
- 2026-07-21 — Scaffolded the full doc structure and staging tree.

## ❌ Watch Out
- **Word splits paragraph text across multiple `<w:t>` runs** — the sample's metadata line is two
  runs. Reading only the first truncates silently. See `feature-snagit-parser.md` → Notes.
- Only **one** sample capture exists; keep parsing structural, never keyed off English verbs.
- `DecompressionStream` is proven in Node, not in a browser. First thing the app shell settles.

## ➡️ Next Up
1. Write `src/lib/parse-snagit.js` — pair step text with images into the capture model, joining all
   `<w:t>` runs per paragraph and stripping only the `N.` prefix.
2. Add French and split-run fixtures to `test/helpers/synthetic.mjs`; assert identical structure.
3. Then `feature-app-shell`, which unblocks the browser verification `docx-reader` is waiting on.

## 🔗 Pointer
→ Current stage folder: `staging/stage-1-foundation/` · Active feature file:
`staging/stage-1-foundation/feature-snagit-parser.md`

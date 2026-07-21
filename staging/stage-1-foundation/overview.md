# Stage 1 — Foundation

## Goal
Turn `.docx` bytes into a structured capture model entirely in the browser, render it on an
accessible page, and have that page live at a real GitHub Pages URL. This stage proves the two
riskiest assumptions in the project — that zero-dependency parsing works, and that the deploy path
works — before any feature depth is built on top of them.

## Features
- [x] `feature-docx-reader` — zero-dependency `.docx` → `{ path: bytes }` — **verified done**
- [x] `feature-snagit-parser` — `document.xml` → normalised capture model — **verified done**
- [ ] `feature-app-shell` — accessible file-drop UI — *awaiting verification* (screen reader +
      rendered demo outstanding)
- [ ] `feature-pages-deploy` — live URL — *deferred by decision until the repo goes public*

## Definition of done — testable checklist
- [x] `npm test` passes with zero failures. — 29/29
- [x] Loading the real sample (`snagit Test.docx`) produces exactly **10 steps** and **10 images**.
- [x] Each step's text is paired with the correct screenshot (step *n* text ↔ step *n* image).
- [x] Parser output contains no `1.`/`2.` numbering prefixes and no English-verb-dependent logic.
- [x] The page works with **no network requests after load** — network log shows page assets and
      `blob:` URLs only.
- [ ] The whole flow is operable by keyboard alone, with a visible focus indicator at every stop.
      *Focus order and target sizes verified; focus-ring contrast not yet measured.*
- [ ] axe-core reports **zero violations** on the rendered page. *Manual equivalents measured and
      passing (contrast, headings, alt, lang, live regions); axe-core itself not yet wired in.*
- [x] All UI strings resolve through `src/lib/i18n.js` — zero hardcoded user-facing text.
- [ ] The site is reachable at its public Pages URL and the sample parses **there**, not just locally.
      *Blocked by the licensing decision — see `help.md` item 1.*
- [x] `git status` is clean and no capture file exists anywhere in the repo or its history.

## Status — 2026-07-21
Two of four features verified done. The stage's core risk (browser-native decompression) is retired
with evidence. Remaining work is verification, not construction: a screen-reader pass, an axe-core
harness, someone actually looking at the page, and the public Pages flip.

## Notes
The sample capture is private and lives outside the repo at `<your-downloads-folder>\snagit Test.docx`.
Tests must not depend on it — `test/fixtures/` holds a **synthetic** `.docx` built to the same
structure, so the suite runs on any machine including CI.

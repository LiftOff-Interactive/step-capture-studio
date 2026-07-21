# Stage 1 — Foundation

## Goal
Turn `.docx` bytes into a structured capture model entirely in the browser, render it on an
accessible page, and have that page live at a real GitHub Pages URL. This stage proves the two
riskiest assumptions in the project — that zero-dependency parsing works, and that the deploy path
works — before any feature depth is built on top of them.

## Features
- [ ] `feature-docx-reader` — zero-dependency `.docx` → `{ path: bytes }`
- [ ] `feature-snagit-parser` — `document.xml` → normalised capture model
- [ ] `feature-app-shell` — accessible file-drop UI that renders the parsed capture
- [ ] `feature-pages-deploy` — live URL, deploying on push to `main`

## Definition of done — testable checklist
- [ ] `npm test` passes with zero failures.
- [ ] Loading the real sample (`snagit Test.docx`) produces exactly **10 steps** and **10 images**.
- [ ] Each step's text is paired with the correct screenshot (step *n* text ↔ step *n* image).
- [ ] Parser output contains no `1.`/`2.` numbering prefixes and no English-verb-dependent logic.
- [ ] The page works with **no network requests after load** — verified in DevTools Network tab.
- [ ] The whole flow is operable by keyboard alone, with a visible focus indicator at every stop.
- [ ] axe-core reports **zero violations** on the rendered page.
- [ ] All UI strings resolve through `src/lib/i18n.js` — zero hardcoded user-facing text.
- [ ] The site is reachable at its public Pages URL and the sample parses **there**, not just locally.
- [ ] `git status` is clean and no capture file exists anywhere in the repo or its history.

## Notes
The sample capture is private and lives outside the repo at `<your-downloads-folder>\snagit Test.docx`.
Tests must not depend on it — `test/fixtures/` holds a **synthetic** `.docx` built to the same
structure, so the suite runs on any machine including CI.

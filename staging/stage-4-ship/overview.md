# Stage 4 — Ship

_No longer a sketch: Stage 3 is built, so this stage is in progress._

## Goal
Accessible `.docx` export, a synthetic demo capture, and enough public polish that a stranger can
use the tool without knowing anything about it.

## Features
- [x] `feature-docx-writer` — zero-dependency accessible OOXML export — **built, awaiting verification**
- [x] `feature-project-file` — portable save/resume — **built, awaiting verification**
- [x] `feature-demo-capture` — ships as a loadable project file — **built, awaiting verification**
- [x] `feature-all-in-one` — one dashboard bundling every artifact + Word downloads — **built,
      awaiting verification** (added 2026-07-24)
- [ ] `feature-public-polish` — README done; screenshot + stranger-flow remain — **in progress**

_Note: `feature-project-file` no longer "replaces autosave" — autosave was restored 2026-07-24, rebuilt
on the project file. See `staging/stage-2-authoring/feature-autosave.md`._

## Definition of done — testable checklist
- [x] Exported `.docx` opens in Word with no repair prompt. — **verified, Word 16.0**
- [x] Word opens it as a modern document, **not in Compatibility Mode** — `CompatibilityMode=15`,
      verified via COM 2026-07-22. Without this the checker below is disabled and unreachable.
- [ ] It passes **Word's own Accessibility Checker** with zero errors — the checker's verdict, not an
      inspection of the markup. *First attempt 2026-07-22 was invalid: Word required conversion
      first, so it graded a converted copy. Re-run needed — `help.md` 3b.*
- [x] Every image carries alt text (`wp:docPr/@descr`); headings use real heading styles; `w:lang` is
      set per run; the document has a title in its core properties. — **all four verified in Word**
- [x] A synthetic demo ships in the repo and contains **no internal system imagery**. — a project
      file at `assets/demo/`, loaded by the ordinary importer; content reviewed 2026-07-22.
- [ ] A stranger completes the full flow from the live URL using only the README and the demo.
- [x] Licensing is resolved and a `LICENSE` file exists. — MIT, 2026-07-21
- [x] `git log --all --diff-filter=A --name-only` confirms no capture file ever entered history.

## The main risk in this stage
**Accessible `.docx` writing with zero dependencies is unproven.** Reading is confirmed; writing means
hand-building an OOXML package — ZIP writer with CRC32, `document.xml` with real heading styles,
`styles.xml`, image relationships, `descr` alt text, and `w:lang`. Stored (uncompressed) ZIP entries
are valid and Word accepts them, so no compressor is needed — but none of this is verified.

**Spike this in Stage 2 or early Stage 3, not here.** Write the smallest possible `.docx` that Word
opens without complaint, and prove it before the rest of the stage depends on it. If the spike fails,
the fallback options are: ship HTML-only for v1 and defer `.docx`; or accept a single dev-time
dependency for this one emitter and document the exception in `docs/decisions.md`.


## Status - 2026-07-22 (third pass)
`feature-docx-writer` is verified against Word 16.0: no repair prompt, real heading styles, alt
text on every image, correct language EN/FR, title and author surviving a re-save, and
`CompatibilityMode=15`. **224/224 tests.**

The risk this stage was most worried about is retired. The author's print pass (`help.md` 3c) is
done and found a real print-sizing defect, now fixed. The demo capture exists and **parses clean on
the first attempt**, which retires the master plan's risk #1 for English.

What remains:
- **The Accessibility Checker still has not run.** Two attempts both graded pre-fix files — the
  first a Word-converted copy, the second exported from the live site before the fix was pushed.
  Cause fixed and deployed; re-run needed on a hard-refreshed page.
- **`feature-public-polish` in progress.** README rewritten to match the shipped tool; a screenshot
  in `docs/assets/` and a stranger completing the flow remain.
- **Nobody has yet done the thing the demo exists for**: a stranger completing the flow from the
  live URL using only the README and the sample.

## Status — 2026-07-24 (feature additions)
Three features shipped and verified against the live site this day, all `awaiting verification` only
for the screen-reader pass (`help.md` 6): **autosave restored** on the project file + close-tab
warning (stage 2); **per-image "Replace image"** (stage 2); and **`feature-all-in-one`** — a single
self-contained dashboard bundling the three HTML artifacts (each in an isolated `<iframe srcdoc>`)
with a download-only Step Guide card (Word EN/FR), one language control driving the whole page, and a
Print button per sub-page. **272/272 tests.** The stage's own definition of done is unchanged — the
Accessibility Checker re-run (`help.md` 3b) and the stranger-completes-the-flow test still stand
between the tool and done.

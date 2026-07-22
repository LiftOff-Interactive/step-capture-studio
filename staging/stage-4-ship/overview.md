# Stage 4 — Ship

_No longer a sketch: Stage 3 is built, so this stage is in progress._

## Goal
Accessible `.docx` export, a synthetic demo capture, and enough public polish that a stranger can
use the tool without knowing anything about it.

## Features
- [x] `feature-docx-writer` — zero-dependency accessible OOXML export — **built, awaiting verification**
- [ ] `feature-demo-capture` — a synthetic, publicly-safe sample capture
- [ ] `feature-public-polish` — README, screenshots, licence, contribution notes

## Definition of done — testable checklist
- [x] Exported `.docx` opens in Word with no repair prompt. — **verified, Word 16.0**
- [ ] It passes **Word's own Accessibility Checker** with zero errors — the checker's verdict, not an
      inspection of the markup.
- [x] Every image carries alt text (`wp:docPr/@descr`); headings use real heading styles; `w:lang` is
      set per run; the document has a title in its core properties. — **all four verified in Word**
- [ ] A synthetic demo capture ships in the repo and contains **no internal system imagery**.
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


## Status - 2026-07-22
`feature-docx-writer` is built and verified against Word 16.0: opens with no repair prompt, real
heading styles, alt text on every image, correct language in both EN and FR. 220/220 tests.

The risk this stage was most worried about is retired. What remains is a demo capture, public
polish, and two things only a human can do (`help.md` 3b and 3c): running Word's Accessibility
Checker, and printing the HTML artifacts.

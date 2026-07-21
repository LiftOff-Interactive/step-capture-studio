# Stage 4 — Ship

_**Sketch only.** Do not write feature files for this stage yet — they would rot. Create them when
Stage 3 is verified done._

## Goal
Accessible `.docx` export, a synthetic demo capture, and enough public polish that a stranger can
use the tool without knowing anything about it.

## Likely features
- `feature-docx-writer` — zero-dependency accessible OOXML export
- `feature-demo-capture` — a synthetic, publicly-safe sample capture
- `feature-public-polish` — README, screenshots, licence, contribution notes

## Definition of done — testable checklist
- [ ] Exported `.docx` opens in Word with no repair prompt.
- [ ] It passes **Word's own Accessibility Checker** with zero errors — the checker's verdict, not an
      inspection of the markup.
- [ ] Every image carries alt text (`wp:docPr/@descr`); headings use real heading styles; `w:lang` is
      set per run; the document has a title in its core properties.
- [ ] A synthetic demo capture ships in the repo and contains **no internal system imagery**.
- [ ] A stranger completes the full flow from the live URL using only the README and the demo.
- [ ] Licensing is resolved and a `LICENSE` file exists.
- [ ] `git log --all --diff-filter=A --name-only` confirms no capture file ever entered history.

## The main risk in this stage
**Accessible `.docx` writing with zero dependencies is unproven.** Reading is confirmed; writing means
hand-building an OOXML package — ZIP writer with CRC32, `document.xml` with real heading styles,
`styles.xml`, image relationships, `descr` alt text, and `w:lang`. Stored (uncompressed) ZIP entries
are valid and Word accepts them, so no compressor is needed — but none of this is verified.

**Spike this in Stage 2 or early Stage 3, not here.** Write the smallest possible `.docx` that Word
opens without complaint, and prove it before the rest of the stage depends on it. If the spike fails,
the fallback options are: ship HTML-only for v1 and defer `.docx`; or accept a single dev-time
dependency for this one emitter and document the exception in `docs/decisions.md`.

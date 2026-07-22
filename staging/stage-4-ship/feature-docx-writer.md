# Feature: docx-writer
_Stage: stage-4-ship · Status: awaiting verification_

## Goal
Export an accessible Word document from the capture model, with zero runtime dependencies. Flagged
as the project's highest-risk item from day one, because hand-written OOXML that is even slightly
malformed makes Word offer to "repair" the file — which a user reads as corruption.

## Success Criteria
- [x] Exported `.docx` opens in Word with no repair prompt.
- [x] Every image carries alt text (`wp:docPr/@descr`).
- [x] Headings use real heading styles, declared in `styles.xml`.
- [x] `w:lang` is set per run, and Word reports the correct language.
- [x] The document has a title in its core properties.
- [x] One file per language; the filename says which.
- [x] Zero runtime dependencies — `CompressionStream` + hand-written ZIP.
- [ ] Passes **Word's own Accessibility Checker** with zero errors. — *not run; see below.*

## How We'll Verify
1. `npm test` — round-trip the emitted package through this project's own `docx.js` reader, proving
   the ZIP is valid and every XML part well formed; assert alt text, styles, language and title.
2. Open the result in Word and confirm no repair prompt.
3. Run Word's Accessibility Checker and confirm zero errors.
4. Record what Word actually reports, not what the markup claims.

## Verification Log

### 2026-07-22 — Built and verified against Word 16.0

**Automated: 220/220** (18 in `test/emit-docx.test.js`). The package round-trips through our own
reader; every XML part parses strictly; screenshots embed byte-identically with no re-encoding;
every image relationship resolves to a part that exists; special characters and control characters
cannot corrupt the package; images scale to the text column preserving aspect ratio; and the emitter
refuses an image with no alt text.

**In Word 16.0, via COM (English document):**
- **Opened without a repair prompt** — the headline risk, retired.
- 21 paragraphs, 5 inline shapes, 108 words.
- **Alt text on 5/5 images, none missing**, first reading `Screenshot showing: Click on the web browser`.
- **5 real `Heading 1` paragraphs and 1 `Title`** — Word recognises them as styles, not bold text.
- Paragraph language reported as **4105** (`wdEnglishCanadian`).

**French document:** opened without repair, 5/5 images with alt text (`Capture d'écran 1`),
`Heading 1` recognised, language reported as **3084** (`fr-CA`).

**One real defect found, and it was invisible to every structural test.** Word was discarding the
entire `docProps/core.xml` part, taking the document title with it — and the title is an explicit
Accessibility Checker requirement. Nothing looked wrong: well-formed XML, correct content type,
correct relationship type.

Found by bisection, with a control proving Word *does* preserve core properties when re-saving its
own files, so the measurement itself was sound. Two plausible fixes changed nothing (matching Word's
exact `core.xml` shape; using Word's `rId1/2/3` relationship convention). The cause was
**`<dc:language>`**: removing that single element fixed it outright. Title and creator now survive a
Word re-save. Pinned by a regression test and written up in `docs/failed-approaches.md`.

**Still outstanding — the one criterion not met:** Word's Accessibility Checker has **not** been
run. There is no COM API for its results, so it needs a human: open the file, Review → Check
Accessibility, confirm zero errors. Everything the checker looks for has been verified individually
(title, alt text, real heading styles, language), but "each ingredient is present" is not the same
as "the checker passes", and this project does not treat those as equivalent.

## Open Questions
- Should the `.docx` mirror the case study (narrative included) or the walkthrough (steps only)?
  Currently it includes authored narrative when present, and omits unreviewed drafts — consistent
  with the HTML case study. Untested with a real audience.
- Word normalises `w:lang` on save, moving it out of individual runs. Harmless, but it means a
  round-tripped file will not look byte-identical to ours. Only matters if anyone diffs them.

## Notes & Decisions
No `docProps/custom.xml`, no `settings.xml`, no `theme1.xml`, no `fontTable.xml`. Word adds all of
them on save; omitting them keeps the package to the parts that are genuinely required, and every
part omitted is one that cannot be got subtly wrong.

# Feature: branding
_Stage: stage-4-ship · Status: **awaiting verification** — built 2026-08-01_

## Goal
A Branding phase that controls the look of every artifact: fonts and sizes, a two-tone header
gradient, one highlight colour, a logo, a page background image, and an icon per all-in-one card.

## The shape, and why
- **Three constraints drove every decision.** No external request of any kind, so no web fonts.
  Contrast measured rather than trusted, because a brand colour is chosen by someone who was not
  thinking about WCAG. Everything inlined, so an artifact stays one self-contained file.
- **The default is a genuine no-op.** `defaultBranding()` is the palette the artifacts already
  shipped with — the same `#0b5cab` accent, no gradient, no images. A capture made before this
  existed must render byte-identically, so "no branding" and "the default branding" are one code
  path rather than two. This is asserted, and mutation-tested by giving the default a gradient.
- **Fonts are stacks, not files.** Six options, each ending in a generic family so a reader missing
  every named face still gets the right *kind* of type. Mike's call, over uploading a `.woff2`:
  embedding adds 30–150KB to every artifact and most commercial EULAs forbid redistribution.
- **Sizes are one base and one ratio**, not a box per heading level. Six independent sizes is six
  ways to produce a document whose headings do not step.
- **Size is a percentage of the reader's own default, never absolute px.** A reader who set a larger
  default text size usually needs it, and an artifact whose entire purpose is accessibility has no
  business overriding that. `html { font-size: 112.5% }`, not `18px`.
- **Colours that sit *on* a brand colour are derived, never asked for.** `bestOn()` picks black or
  white for header text; the dark-scheme accent is `darkHighlight()`, the author's colour blended
  toward white until it clears AA on both dark surfaces. One brand colour cannot serve a white page
  and a near-black one — BASE_CSS already shipped two accents for exactly that reason — and asking
  for a second would contradict "a single highlight colour".
- **Failing contrast blocks export**, alongside unconfirmed alt text, with the measured ratio in the
  blocker. Mike's call. A colour that fails AA makes the artifact exactly as non-compliant as a
  missing alt attribute, and it fails everywhere at once rather than in one image.
- **The logo's alt text may be empty, and that is the honest default.** A logo beside a title that
  already names the thing is decorative; inventing "Company logo" only makes screen readers announce
  noise. Card icons are always decorative — each card's title sits directly underneath.
- **A background image gets a scrim.** Text over an arbitrary photograph is a contrast failure
  waiting to happen; the scrim is what keeps the measured ratios honest.

## Success Criteria
- [x] Fonts, sizes, gradient, highlight, logo, background and four card icons, all editable.
- [x] Every option reaches all four HTML artifacts and survives the project-file round trip.
- [x] Default branding changes nothing about an existing capture's output.
- [x] A contrast failure blocks export and names the ratio.
- [x] The reader's own text-size preference is scaled, not overridden.
- [x] Branding reaches the Word document: fonts, heading colour, sizes.
- [x] Controls labelled and translated in both languages; collapsed states axe clean.
- [x] **The Word document opened in Word itself.** — *human, 2026-08-05; see the log below.*
- [ ] A real author brands a capture end to end and looks at the result. — *human. Word side done
  2026-08-05; the four HTML artifacts from that same branded capture have still not been looked at.*

## How We'll Verify
1. `npm test` — the model, the contrast maths, the gate, every emitter, both round-trip directions.
2. Drive the real app: set each control, watch the ratios, export and inspect what came out.
3. **Open the branded `.docx` in Word** and run the Accessibility Checker. Not done — see below.

## Verification Log

### 2026-08-01 — Built. Automated PASS, in-browser PASS for HTML. Word UNVERIFIED.

**Automated: 332/332** (was 307). `test/branding.test.js` covers the defaults, the patch semantics,
contrast against WCAG reference values, the derived on-colour and dark accent, the export gate with
its ratio, half-a-gradient, clamping, every font stack ending generically, the scrim, the logo's
decorative default, card icons reaching the dashboard, and both project-file directions.
`test/emit-docx.test.js` covers the Word mapping.

**Four mutations, all caught:** giving the default a gradient, removing branding from the export
gate, pinning `html` to absolute px, and letting "System default" resolve to a named face in Word.

**In-browser, Chromium, demo capture.** Seven phases with Branding between Translate and Export;
font options, icon rows and instructions all translated; live readout "#0b5cab — 6.70:1 on white.
Passes AA."

The gate was then exercised for real: `#f2c1c1` produced *"Highlight colour: 1.59:1 against the
page. WCAG AA needs 4.5:1"* and disabled **every** download; `#7a0019` cleared it.

Exported walkthrough, resolved in a real browser rather than read out of the CSS text:
`--accent` → `#7a0019`, dark-scheme `#bd808c`, root font-size 18px, heading font Rockwell, header
`linear-gradient(135deg, rgb(15,95,122), rgb(15,116,144))` with white text, logo inlined as a data
URI carrying the author's alt.

**A bug the gate caught in this feature's own defaults.** Ticking the gradient box seeded the app
shell's teal, and `#12839c` measures **4.42:1** against the white the header text derives to — under
AA, blocking export the instant the box was ticked. Seeds are now `#0f5f7a`/`#0f7490`, 7.15:1 and
5.36:1. A default that immediately blocks export is worse than no default.

**The Word document is not verified.** The branding reaches `styles.xml` — correct fonts, `w:color`,
scaled sizes, and no override at all for "System default" — and that is asserted structurally. But
this project's own rule is that `.docx` is verified against **Word itself**, not by inspecting
markup, precisely because valid OOXML can still be rejected (`dc:language` in core.xml discarded a
whole part while every structural test passed). I cannot drive Word here. Mike chose to include the
Word document knowing this; the criterion stays open and the blocker is in `help.md`.

### 2026-08-05 — Word PASS. Opened in Word by Mike; the last automated criterion closes.

**Automated: 345/345** (332 at the time of the entry above; the rest arrived with the bundle
selection and Export rebuild).

**The check the 2026-07-22 attempt could not make.** A fresh export from the deployed build opened
in **the current format — no Compatibility Mode, no convert prompt, no repair dialog**. That is the
precondition everything below depends on: in Compatibility Mode Word disables the Accessibility
Checker outright, which is why the July result was meaningless rather than merely stale.

**Review → Check Accessibility: "Looks good. No accessibility issues found."** Zero errors, and no
warnings or tips reported. Heading styles are still recognised as headings by the navigation pane,
so the outline survived as *structure* and not merely as large text.

**Branding as it arrived in Word.** Branded with highlight `#ad0b69`, body font *monospace*, heading
font *Humanist sans*, a logo, and an enlarged base size:

| Set on the Branding phase | Seen in Word | Why that is the correct answer |
|---|---|---|
| Body font `mono` | **Cascadia Mono** 12.5pt | `w:rFonts` takes one family, not a stack. `named()` skips the generic aliases and takes the first concrete face — `ui-monospace` out, `Cascadia Mono` in. |
| Heading font `humanist` | **Trebuchet MS** 28pt (H1) | First named face of the humanist stack. |
| Highlight `#ad0b69` | Heading colour applied | Emitted as `w:color` `AD0B69`. Export was possible at all, so the gate measured it as clearing AA. |
| Base size 18px, scale 1.5 | 12.5pt body / 28pt H1 | `Math.round(size × rem × 1.375)` → `round(18×1.375)`=25 half-points=**12.5pt**; `round(18×1.5²×1.375)`=`round(55.6875)`=56=**28pt**. |

**Read the font row before filing a bug.** Word's font box shows the resolved family, never our
option label — "monospace" and "Humanist sans" are names in `i18n.js`, not typefaces. Seeing
*Cascadia Mono* where you chose *monospace* is the mapping working. This was misread once already.

**The sizes are the strongest evidence here.** Both observed point sizes land exactly on the
emitter's formula, half-point rounding included, which pins the whole size path through Word rather
than establishing only that the text got bigger. Note the anchor is deliberate: 16px maps to Word's
familiar 11pt body, not to the literal 12pt a px→pt conversion would give.

**Not recorded:** the Word build number. The pre-branding check was 16.0; this one was not written
down at the time.

**No evidence file exists, by design.** The capture branded was an internal one, so the `.docx` and
any screenshot of it can never enter the repo — the pre-commit hook checks file contents for
embedded imagery and would stop it. This entry is deliberately specific because it is the only
record there will be.

## Open edges
- **Gradient and background have no Word equivalent** and are dropped there. Word has no page
  gradient worth the OOXML, and a photograph behind body text is the opposite of accessible in a
  document meant to be printed.
- **SVG is accepted for logo and icons** but sniffed with a string check on the first 200 bytes
  rather than parsed. A hostile SVG is not a threat here — the file never leaves the browser and the
  author supplied it — but it is not validation.
- **Only the highlight is contrast-checked against page surfaces.** Body text, borders and the
  scrim are all still BASE_CSS's, which were measured in a browser when they shipped. If branding
  ever reaches those, the check has to grow with it.
- **No live preview.** The author sets values and exports to see them. A preview pane would be
  better and is a much larger piece of work.

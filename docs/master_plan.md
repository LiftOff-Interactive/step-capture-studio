# step-capture-studio — Master Plan

_Written 2026-07-21. Assumes zero prior context — a brand-new session should be able to rebuild the
whole vision from this file alone._

## Pitch
A zero-install, zero-upload static web tool that turns one Snagit step-capture `.docx` into three
bilingual, WCAG 2.1 AA training artifacts: a quick-steps cheat sheet, an interactive HTML
walkthrough, and a case-study skeleton.

## Problem & Why
Trainers and subject-matter experts record a procedure once in Snagit, then rebuild it by hand three
times for three audiences: a terse reminder for experts, a click-by-click guide for novices, and a
narrative case study for people who need to understand *why*. That is three documents to write,
three to keep in sync, and three to translate — from a single recording that already contains every
screenshot and every step.

Worse, the raw Snagit export is not usable as-is. Its step text is machine-generated and repetitive
(the reference sample contains `Click "My courses"` twice in a row), it carries no alt
text, and it is monolingual. Every downstream artifact needs human editing before it can be shipped
to learners.

This tool does the mechanical 80% deterministically and gives the author a focused surface for the
20% only a human can supply: the *why*, the alt text, and the French.

## Target users & use cases
**Primary:** trainers and SMEs in a bilingual, accessibility-regulated environment — the reference
user works at a Canadian federal department — who already use Snagit to record procedures.

**Jobs to be done:**
1. "I recorded this once — give me the three formats my audiences actually need."
2. "Make it pass accessibility review without me learning WCAG."
3. "Get me a French version without sending internal screenshots to a translation service."

**The one feature they cannot live without:** the HTML walkthrough. It is the artifact learners
actually use.

**Hard environmental constraint:** the source screenshots show internal government systems. Nothing
may be uploaded anywhere. This is why the tool is client-side only — not for elegance, but because
any architecture involving a server is disqualified.

## v1 scope

**In:**
- `.docx` input (Snagit step-capture export), parsed entirely in-browser
- All three artifacts, each self-contained and offline-capable
- Bilingual EN-CA / FR-CA with a language toggle on the HTML walkthrough
- WCAG 2.1 AA on the artifacts, the authoring tool itself, and the `.docx` export
- Per-image alt text, required before export
- Step dedup and inline editing of step text
- Copy-prompt export for case-study narrative and for FR translation
- Portable project file: export the whole capture to one `.html`, import it back
  (replaced `localStorage` autosave, 2026-07-22 — see `docs/decisions.md`)
- Live on GitHub Pages with a synthetic demo, shipped as a loadable project file

**Explicitly out (v1):**
- `.pdf`, `.snagx`, and Windows Steps Recorder `.mht` input
- Any server, backend, API key, account, or login
- AI *inside* the tool (it only ever builds prompts for the user to run elsewhere)
- Multi-capture pairing for true bilingual screenshots (design sketched, deferred — see below)
- Saved server-side projects, sharing, collaboration, versioning

## Future roadmap (6–12 months)
- **Two-capture pairing** — upload an EN and an FR recording of the same procedure, pair by step
  index, and have the toggle swap *screenshots* as well as text. This is the correct answer for
  Official Languages compliance and is the most likely first post-v1 feature. Keep the content model
  per-language so this stays a small change.
- **More input formats** — Steps Recorder `.mht` is the natural second parser; the normalised step
  model already isolates it behind an adapter.
- **Annotation passthrough** — Snagit callouts/highlights are flattened into the PNG today; richer
  Snagit formats could preserve them.
- **Template themes** — departmental branding for generated artifacts.

**Do not paint into a corner on:** the number of languages (do not hardcode a two-language
assumption — use language *codes* as keys), the input format (keep parsing behind an adapter), or the
assumption that one step has exactly one screenshot.

## Tech stack & key decisions
Each links to the full entry in [docs/decisions.md](decisions.md).

| Choice | One-line why |
|---|---|
| Vanilla JS, ES modules, no build step | Push to `main` is the deploy; nothing to rot or re-tool in a year |
| Zero runtime dependencies | `DecompressionStream` + `DOMParser` + `Blob` cover the whole job natively |
| Client-side only | Internal government screenshots must never leave the machine |
| GitHub Pages | Free, static, matches the no-server constraint exactly |
| `.docx` input only for v1 | A `.docx` is a ZIP; images extract losslessly. PDF extraction is lossy and slow to build |
| Deterministic, no AI in-tool | No key to manage, no cost, no fabricated business rationale in training material |
| Copy-prompt for narrative + FR | Keeps AI benefit without putting AI in the trust boundary |
| Deploy in Stage 1, not last | "Done" means live, so the deploy path is proven on day one |

## Architecture sketch

```
 .docx bytes
     │
     ▼
 src/lib/docx.js          Zero-dep ZIP reader. XML parts are Deflate → DecompressionStream
     │                    ('deflate-raw'); PNGs are Stored → sliced straight from the buffer.
     ▼
 src/lib/parse-snagit.js  document.xml + document.xml.rels → normalised model (adapter boundary:
     │                    a future .mht parser emits the same shape)
     ▼
 ┌─────────────── Capture model (the one shared structure) ───────────────┐
 │ { title, author, duration, createdAt,                                  │
 │   steps: [ { index, images:[{ id, bytes, w, h, alt:{en,fr} }],         │
 │              text: { en, fr } } ] }                                    │
 └────────────────────────────────────────────────────────────────────────┘
     │                                    │
     ▼                                    ▼
 src/ui/  authoring layer            src/lib/generate-*.js
 (dedup, edit, alt text,             three emitters, each producing one
  FR round-trip, autosave            self-contained artifact
  → localStorage)
                                          ▼
                            quick-steps.html · walkthrough.html
                            case-study.html  · *.docx
```

**Key invariant:** everything downstream of the parser consumes the capture model and nothing else.
New input formats add a parser; new artifacts add an emitter; neither touches the other.

## Staged roadmap

| Stage | Goal | Headline feature | Definition of done |
|---|---|---|---|
| **1 — Foundation** | Bytes to structured steps, deployed | Zero-dep `.docx` parser + live Pages URL | Real sample parses at the live URL showing 10 steps and 10 screenshots; axe clean; fully keyboard operable |
| **2 — Authoring** | The human-input surface | Required per-image alt text + FR round-trip | Sample reaches a complete bilingual model with confirmed alt text, surviving a browser restart |
| **3 — Generators** | Three artifacts from one model | Two-pane HTML walkthrough | All three download, open offline with images intact, axe clean, toggle swaps content and `lang` |
| **4 — Ship** | Public-ready | Accessible `.docx` export | Passes Word's Accessibility Checker; a stranger completes the flow with the synthetic demo |

## Open questions & risks

_Reviewed 2026-07-22. Resolved risks are kept, struck through, so the record shows what was feared
and what actually happened._

**Live:**

1. **Sample size of one.** The parser is still built against a single Snagit capture — one version,
   one theme, one locale. Mitigated by keying off document *structure* and never off English text,
   and by a French fixture in the tests. Unknown until a second real capture appears (`help.md` 3).
2. **French guides show English screenshots.** Accepted trade-off. The content model is per-language
   so two-capture pairing stays a small change. Revisit if a francophone pilot flags it.
3. **The bundled French is an unreviewed machine draft.** It must not reach learners unreviewed
   (`help.md` 7).
4. **Printing is untested for all three HTML artifacts.** It is the defining property of the
   quick-steps guide, and one bug has already been found whose symptom was blank printed
   screenshots. Human-only check (`help.md` 3c).
5. **Public repo, sensitive source material.** Enforced by `.githooks/pre-commit`, not by memory.
   History was scrubbed and audited before the repo went public.

**Resolved:**

6. ~~Accessible `.docx` writing with zero dependencies is unproven.~~ **Resolved 2026-07-22** —
   built and verified against Word 16.0: opens with no repair prompt, real heading styles, alt text
   on every image, correct language in EN and FR. The one defect found (`dc:language` making Word
   discard core.xml) is in `docs/failed-approaches.md`. Word's Accessibility Checker itself still
   needs a human (`help.md` 3b).
7. ~~`DecompressionStream('deflate-raw')` browser support is unverified.~~ **Resolved 2026-07-21** —
   confirmed in Chromium 148, the agreed target. No fallback inflate needed.
8. ~~Licensing is unresolved.~~ **Resolved 2026-07-21** — MIT, © Mike Bubyn. Repo is public.

## Glossary
- **Snagit step capture** — TechSmith Snagit's mode that records each click as a numbered step with a
  screenshot, exportable to `.docx`.
- **Capture model** — this project's normalised, format-agnostic representation of a parsed recording.
- **Quick-steps guide** — terse cheat sheet for users who know the system and need a reminder.
- **Walkthrough** — the interactive HTML guide: screenshot pane plus step rail.
- **Case study** — narrative artifact explaining the *why* behind each step; the only artifact
  requiring substantial human writing.
- **Copy-prompt** — the tool builds a ready-to-paste AI prompt; the user runs it externally and
  pastes results back. Keeps AI outside the tool's trust boundary.
- **WCAG 2.1 AA** — the accessibility conformance level required for Government of Canada web content.
- **EN-CA / FR-CA** — Canadian English and Canadian French, the two required official languages.

# Feature: design tokens
_Stage: stage-4-ship · Status: **in progress** — designed and started 2026-08-05_

## Progress
- [x] **1. `src/ui/tokens.css` extracted**, linked by `index.html` before `styles.css`, whose own
      `:root` block is deleted rather than duplicated. All 24 tokens resolve; all seven studio
      phases render at byte-identical heights to before. 345/345.
- [ ] 2. Artifacts consume it — reconcile `--muted`→`--text-muted`, `--aio-*`→`--brand-*`, and have
      the app fetch the file at startup and pass it to the emitters.
- [ ] 3. Branding writes tokens on `:root`; **Adjust branding** commits and audits.
- [ ] 4. Expanded contrast audit + the new assertions, each mutation-tested.

## Goal
One set of design tokens shared by all four surfaces — the studio, the project file, the all-in-one
and the three training artifacts — so branding reaches every one of them from a single definition,
and the studio repaints in the author's brand so they can see it without exporting.

## Why now
The palette already exists three times, copied by hand, and the names have drifted:

| Value | Studio (`styles.css`) | Artifacts (`emit-common.js`) | Dashboard (`emit-all-in-one.js`) |
|---|---|---|---|
| `#155f82` | `--brand` | — | `--aio-brand` |
| `#dceaf7` | `--brand-tint` | — | `--aio-tint` |
| `#565b62` | `--text-muted` | `--muted` | — |
| `#0b5cab` | `--accent` | `--accent` | — |

`--bg`, `--surface`, `--text`, `--border`, `--border-subtle` and `--radius` are duplicated verbatim
between the studio and the artifacts. The project file carries a fourth copy in `PROJECT_CSS`.

This is why a branded dashboard came out half-branded on 2026-08-05: the accent reached it correctly
while its cards stayed `--aio-brand` teal, because nothing connects the two. Every assertion passed.

## The shape, and why

- **`src/ui/tokens.css` is the single source.** Nothing but `:root` and its dark-scheme block.
  `index.html` links it before `styles.css`, so first paint is correct and there is no flash of
  unstyled chrome. The studio's own `:root` block is deleted, not duplicated.
- **Artifacts inline it, fetched once at startup.** An artifact must stay one self-contained file, so
  the exporter needs the token text as a string. The app fetches `tokens.css` during load — while
  the page is demonstrably online, since it just loaded — and holds it. Fetching at *export* time
  would put a network request between the author and their download and break the promise that you
  can disconnect and keep working.
- **Emitters take the tokens as an argument.** Not a module global. The dependency is then visible
  in every call site and the Node tests supply the real file, which means the tests prove that what
  ships is what was measured.
- **Artifacts carry the whole token block, including variables they do not use.** A handful of unused
  custom properties is a few hundred bytes against artifacts that inline base64 screenshots. Two
  divergent subsets is how the current mess started.
- **Branding is applied by setting custom properties on `:root`,** not by injecting a stylesheet.
  One mechanism for the studio and the artifacts, and it cannot fight the cascade.
- **The default stays `#155f82`.** Mike's call. Default output must remain byte-identical to what
  ships today, so "no branding" and "the default branding" stay one code path — the same invariant
  `feature-branding` already mutation-tests, now extended to the dashboard's cards.
- **The brand reaches header, page background, accent and buttons. Nothing else.** Mike's call.
  Focus rings, error and warning states, the export blocker list and the project file's "unconfirmed"
  flags stay on the default palette permanently. These are *functional* colours: an author whose
  brand fails AA must still be able to read the message telling them so. A tool that renders its own
  error state unreadable in the exact circumstance the error exists for is worse than one that never
  branded anything.
- **Repaint happens on commit, never live.** Mike's call. Pick a colour, close the picker, and an
  explicit **Adjust branding** action applies it. Dragging a colour picker fires continuously, and a
  studio that repaints on every event spends the drag in states nobody chose — some of them
  unreadable. Committing also gives the contrast audit one obvious moment to run and somewhere to
  report.
- **A failing brand warns, and does not repaint.** The audit lists every pairing it measured with its
  ratio. Export stays blocked exactly as it is today; the studio stays on defaults rather than
  adopting a palette that fails. The author sees the failure reported, not applied.

## Success Criteria
- [ ] One `:root` definition in the repo. No hex that appears in `tokens.css` is written again in
      `styles.css`, `emit-common.js`, `emit-all-in-one.js` or `emit-project.js` — asserted by test.
- [ ] Default branding still produces byte-identical output for all four exported files.
- [ ] A brand colour reaches the studio, the project file, the all-in-one **including its cards and
      icon tiles**, and the three training artifacts, from one setting.
- [ ] The studio repaints on **Adjust branding**, not on input.
- [ ] The contrast audit covers every pairing the brand now touches, light **and** dark scheme, and
      names each ratio. Text 4.5:1, UI borders and focus 3:1.
- [ ] A failing brand blocks export, warns with the full report, and leaves the studio on defaults.
- [ ] Functional colours are provably unbrandable — asserted, not just intended.
- [ ] Studio keyboard-operable and axe clean, `violations` and `incomplete`, in both languages.

## How We'll Verify
1. `npm test` — the token-duplication assertion, byte-identical default output, the expanded audit
   against WCAG reference values, and the unbrandable-functional-colours assertion.
2. **Mutation-test the new assertions**: reintroduce a duplicated hex, brand a functional colour, and
   let one derived pairing fail — each must turn the suite red.
3. `node tools/shoot.mjs artifacts` with a deliberately hostile brand, then look at all four.
4. Rendered demo of the studio in both languages, before and after applying a brand.

## Verification Log
_Empty. Nothing here is done._

## Open edges
- **The dashboard's card tint is a design decision, not just a wiring one.** Deriving a readable
  tint from an arbitrary brand is the same problem `darkHighlight()` solves for the dark scheme, and
  it may need the same treatment rather than a plain lightening.
- **Word does not participate.** It has no stylesheet; `emit-docx.js` keeps its bespoke mapping of
  fonts, heading colour and sizes. Mike's call, 2026-08-05.
- **The all-in-one and the project file stay separate files.** Considered and rejected 2026-08-05:
  `opting out deletes nothing` and `the all-in-one drops the card and the panel` are both shipped,
  tested behaviours, and one file cannot honour both without carrying excluded content invisibly
  into something handed to learners.

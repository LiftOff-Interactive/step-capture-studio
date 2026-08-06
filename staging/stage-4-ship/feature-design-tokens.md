# Feature: design tokens
_Stage: stage-4-ship · Status: **awaiting verification** — all four steps built 2026-08-05_

## Progress
- [x] **1. `src/ui/tokens.css` extracted**, linked by `index.html` before `styles.css`, whose own
      `:root` block is deleted rather than duplicated. All 24 tokens resolve; all seven studio
      phases render at byte-identical heights to before. 345/345.
- [x] **2. All four surfaces consume it.** `--muted`→`--text-muted`, `--aio-brand`/`--aio-tint`/
      `--aio-outline`→`--brand`/`--brand-tint`/`--brand-border`; the three duplicate `:root` blocks
      deleted from `emit-common.js`, `emit-all-in-one.js` and `emit-project.js`. `tokens.js` is the
      seam — the browser loads the file at startup, `test/helpers/tokens.mjs` does it for tests via
      `--import`, and `tokensCss()` throws rather than emitting a colourless artifact. **All four
      branded artifacts re-render byte-identically**, so the consolidation is a proven no-op. 349/349.
- [x] **3. The studio repaints in the author's brand, on commit.** `brandingTokensCss()` is shared
      by the studio and every artifact, so the preview cannot drift from the export — it is the same
      string. **Adjust branding** applies it; editing a control does not. A failing brand is refused
      with the Export page's own wording, and the studio is left as it was.
- [x] **4. The audit covers every pairing the brand touches**, in both schemes, and
      `branding.js` reads the page surfaces from the tokens instead of its own copy.

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
- ~~**Emitters take the tokens as an argument.** Not a module global.~~ **Revised in build.** Only
  two functions actually assemble a `<style>` — `renderDocument` and `emitProject` — so threading a
  parameter through five emitters and 107 call sites would have added noise without adding a
  guarantee. `tokens.js` holds the text behind an accessor that **throws** when nothing was loaded,
  which buys the thing the argument was for: a missing load fails loudly instead of producing a
  colourless artifact. The tests still supply the real file, so what ships is what was measured.
- **Artifacts carry the whole token block, including variables they do not use.** A handful of unused
  custom properties is a few hundred bytes against artifacts that inline base64 screenshots. Two
  divergent subsets is how the current mess started.
- ~~**Branding is applied by setting custom properties on `:root`.**~~ **Wrong, and caught in build.**
  Inline properties on the root element cannot express a media query, so a branded studio would have
  forced its light values onto a reader in dark mode. Branding is injected as a `<style>` instead —
  and the string is the one the artifacts embed, which turned out to be the stronger guarantee
  anyway: the preview cannot drift from the export because there is only one of it.
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
- **The author's colour is never altered — the gate blocks instead.** Mike's call. `bestOn()` already
  flips the text on a brand colour to black or white by measuring both, and a scan of 636,056
  colours shows that flip **never drops below 3:1**, so headings, borders and focus rings are safe
  by construction for any colour whatsoever. It falls under 4.5:1 for 4.6% of the space — saturated
  mid-tone violets, magentas and teals — worst case `#ab3fff` at 4.297:1. A 1–4% nudge would close
  every one of those, and we deliberately do not do it. Quietly shifting someone's brand colour to
  make our own check pass is the tool overruling the author about their own identity; being told
  plainly is better. This means the gate only ever fires on normal-size text.
- **A failing brand warns, and does not repaint.** The audit lists every pairing it measured with its
  ratio. Export stays blocked exactly as it is today; the studio stays on defaults rather than
  adopting a palette that fails. The author sees the failure reported, not applied.

## Success Criteria
- [x] One `:root` definition in the repo. No hex that appears in `tokens.css` is written again in
      `styles.css`, `emit-common.js`, `emit-all-in-one.js` or `emit-project.js` — asserted by test.
- [x] Default branding still produces byte-identical output for all four exported files.
- [x] A brand colour reaches the studio, the project file, the all-in-one **including its cards and
      icon tiles**, and the three training artifacts, from one setting.
- [x] The studio repaints on **Adjust branding**, not on input.
- [x] The contrast audit covers every pairing the brand now touches, light **and** dark scheme, and
      names each ratio. Text 4.5:1, UI borders and focus 3:1.
- [x] A failing brand blocks export, warns with the full report, and leaves the studio on defaults.
- [x] Functional colours are provably unbrandable — asserted, not just intended.
- [x] Studio axe clean, `violations` and `incomplete`, in both languages, against the real
      `index.html` with both stylesheets.
- [ ] **Studio keyboard-only pass with the new control.** — *human.* `<button>` is operable by
      construction and axe is clean, but neither of those is a person tabbing through it. Rides with
      Cam's pass.

## How We'll Verify
1. `npm test` — the token-duplication assertion, byte-identical default output, the expanded audit
   against WCAG reference values, and the unbrandable-functional-colours assertion.
2. **Mutation-test the new assertions**: reintroduce a duplicated hex, brand a functional colour, and
   let one derived pairing fail — each must turn the suite red.
3. `node tools/shoot.mjs artifacts` with a deliberately hostile brand, then look at all four.
4. Rendered demo of the studio in both languages, before and after applying a brand.

## Verification Log

### 2026-08-05 — Steps 1–2. Consolidation proven to be a no-op; two latent bugs found.

**349/349** (345 before; `test/tokens.test.js` adds four).

**The consolidation changes nothing, and that is measured rather than asserted.** All four branded
artifacts — same brand as the Word check, `#ad0b69` / Cascadia Mono / Trebuchet / 18px / 1.5 — were
re-exported and re-photographed after the change and came back **byte-identical**:
`cdb42d7ee3`, `90dc88ef58`, `0be8be2b31`, `f57eaf5db3`, unchanged from before. Every studio phase
also re-rendered at identical heights. The names were drifted aliases holding the same hexes, so
reconciling them moves nothing.

**Three mutations, all now caught:** a colour literal reintroduced into a consumer file; a token
given no dark-scheme value; `renderDocument` stopping inlining the tokens.

**One of those assertions was worthless when written, and mutation testing is the only reason it is
not still worthless.** The dark-scheme check split the file on the string `:root` — which appears in
the file's own header comment — so it compared prose against the light block and passed no matter
what was deleted. Rewritten to match `:root { … }` blocks, it failed immediately on a real omission:
`--brand-hover` had been added with no dark value.

**Two latent bugs found by looking for stray hexes**, both invisible until branding reaches them:
`.phase-nav__btn:hover` was a hardcoded `#1b6f97` that would have stayed teal while its button went
magenta, and the dashboard's icon glyphs were a hardcoded `#ffffff` that would vanish on a light
brand. Both now tokens; both no-ops at today's values.

**Still open:** `branding.js` hardcodes the page surfaces in `SURFACES` — a fourth copy of `--bg`
and `--surface`. It is excluded from the duplication assertion for now because the contrast audit
needs those values; step 4 should take them from the tokens instead.

### 2026-08-05 — Step 3. The studio paints itself; the dashboard is finally whole.

**352/352.** Driven in Chromium against the demo capture, not just asserted.

**Commit, not live — measured.** With the Branding panel open, setting the highlight to `#ad0b69`
left `--brand` at `#155f82`; clicking **Adjust branding** moved it to `#ad0b69` and the page shell
with it. That is the behaviour Mike asked for, and the reason for it is that a colour picker fires
continuously while dragged.

**Refusal works, in both languages.** `#f2c1c1` produced *"Not applied — this would fail WCAG AA, so
the studio has been left as it was. Highlight colour: 1.59:1 against the page…"* and the French
equivalent, and `--brand` did not move. The wording is the Export page's own strings, so one failure
reads the same wherever the author meets it.

**Functional colours confirmed untouched** while branded: `--focus` stayed `#0b5cab`,
`--error-border` `#a3161d`.

**The half-branded dashboard is fixed.** Re-exported branded, only the all-in-one's hash changed
(`cdb42d7ee3` → `175d677656`); the walkthrough, quick steps and worked example are byte-identical,
which is exactly the blast radius expected when only the dashboard consumes `--brand`.

**Six mutations caught across steps 2–3:** a colour literal in a consumer; a token with no dark
value; tokens not inlined; branding writing `--focus`; the default emitting a shell colour; the tint
derivation pushed until card ink fails AA. Each was confirmed to have actually applied first — an
earlier round recorded a "not caught" that turned out to be a mutation that never took.

**One bug only a screenshot could find.** The branded studio came out magenta with two stubbornly
blue range sliders: `accent-color` had been set on checkboxes and radios only. No assertion would
have flagged it — the sliders were painted exactly as the stylesheet said.

### 2026-08-05 — Step 4. The audit grew to the whole brand; the last palette copy is gone.

**357/357.**

**`branding.js` no longer keeps its own surfaces.** The list annotated "from BASE_CSS" now reads
`tokenValue('--bg')` and `--surface`, so the contrast maths can never be measuring a page the
artifacts stopped using. That was the fourth copy; there are none left.

**Eight pairings measured, up from two.** Highlight on each page surface, the button label on the
button, header text on the brand, the label at hover, and card text on the card wash — the last two
in both colour schemes, because those colours differ per scheme. The derived on-colours are measured
rather than assumed: `bestOn` guarantees 3:1 for any colour in sRGB but never 4.5:1.

**That distinction is not theoretical.** `#ab3fff` now fails on four pairings at once — 3.97:1 on the
page, **4.30:1 for the button label**, 4.30:1 for header text, 3.55:1 at hover — and is refused. Under
the old audit only the page was measured. Conversely `#ffd400` fails on the page but *passes* on its
own buttons and cards, because dark text on yellow is perfectly readable: one verdict for both would
have been wrong in one direction.

**Four mutations caught:** dropping the button-label measurement, letting readiness ignore the new
pairings, auditing only the light scheme, and reverting a surface to a hardcoded hex.

**One of those escaped first time round.** Deleting the dark-scheme button measurement passed,
because the "both schemes" assertion only covered the cards. Now it covers every pairing whose
colour differs per scheme — the readers who need dark mode are the least able to absorb a contrast
failure.

**A bilingual defect surfaced by having four ratios instead of one.** French read
*"3.97:1 … La norme WCAG AA exige 4,5:1"* — two decimal marks in one sentence, one of them wrong.
Ratios now format through `formatRatio()` against the reader's locale, so FR-CA gets `3,97:1`. This
was always broken; one ratio per message hid it.

**The a11y fixture was quietly measuring the wrong page.** It inlined `styles.css` alone, which since
step 1 declares no colours at all. It now loads both sheets in the order `index.html` links them.

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

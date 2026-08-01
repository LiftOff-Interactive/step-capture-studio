# Feature: optional-worked-example
_Stage: stage-4-ship · Status: **awaiting verification** — built 2026-08-01_

## Goal
Let the author say the capture will not produce a worked example, and have the whole app believe it:
the explanations disappear from the step editor, drop out of the translation prompt, stop counting as
blockers, and the artifact greys out on the Export page.

The worked example is the only artifact that is not just a reformatting of the capture — it needs
prose the author has to write, two passages per step. An author who does not want one was previously
carrying that form, that prompt, and that gate anyway.

## The shape, and why
- **`capture.includeWorkedExample`, and absent means included.** Every capture and project file
  written before this existed had a worked example. Defaulting to "excluded" would silently drop work
  an author had already done, so only the literal `false` (and the literal string `"false"` in a
  project file) opts out. A hand-edited file with something unexpected in the attribute fails safe
  the same way — the artifact is produced rather than quietly dropped.
- **Opting out deletes nothing.** Scenario and narrative stay in the model and in the project file,
  so switching back restores the work rather than asking for it again. That is also why the project
  file writes the flag even when it is true: the prose is still in the file, so its presence cannot
  imply the choice — only the attribute can.
- **The gate stops asking, but only about prose.** `caseStudyReadiness` returns ready, and
  `stepVerification` drops its narrative items so the step's single check is satisfiable. Alt text
  and step text are untouched: this drops one artifact, it does not weaken the accessibility gate.
- **The all-in-one loses the card, not the dashboard.** Its card and panel are absent rather than
  shown disabled — that file is the deliverable a reader opens, and a dead tile in it is a defect,
  not a hint. Turning off one artifact should not cost the author the bundle, and it makes the
  dashboard reachable for captures that could never produce a worked example at all. `emitCaseStudy`
  refuses a capture with no explanations, so the all-in-one now only builds it when it is wanted —
  otherwise it would throw on exactly the captures that opted out.
- **The Export page greys the worked example out rather than hiding it**, consistent with every other
  gated control there: an export that vanishes tells the author nothing about why.
- **`translate.js` keeps its own copy of the predicate.** That file deliberately does not import from
  `case-study.js` — the import runs the other way and a cycle would result. The file already
  duplicates `NARRATIVE_FIELDS` and `SCENARIO_FIELDS` for the same reason and says so; this follows
  it, with a comment naming `case-study.js` as the owner. It is behaviour rather than a constant, so
  the two must be kept in step.
- **`hidden` on one wrapper, not a CSS class.** The scenario fields and prompt controls are not
  merely invisible when the worked example is off — they are not part of the form. A screen reader
  user tabbing into a field that feeds nothing is the accessible equivalent of a dead control.

## Success Criteria
- [x] Unticking collapses the phase body, and the explanations vanish from every step in the editor.
- [x] The translation prompt loses the scenario and the explanations, and keeps title, steps and alt.
- [x] The worked-example download greys out; the other three artifacts are unaffected.
- [x] The all-in-one still exports, with three cards and no dangling link to the missing panel.
- [x] Unreviewed drafted prose stops blocking; alt text and step text still block.
- [x] Nothing is deleted — re-ticking restores scenario, narrative and the gate exactly.
- [x] The choice survives the project-file round trip; a file without the attribute keeps its example.
- [x] Labelled and described in both languages; collapsed state axe clean.
- [ ] A real author decides against a worked example and ships the other three. — *human.*

## How We'll Verify
1. `npm test` — the flag, its default, every consumer, and the project round trip.
2. Drive the real app: tick and untick against the demo capture, watching the editor, the prompt,
   the Export page, and an actual exported all-in-one.

## Verification Log

### 2026-08-01 — Built. Automated PASS, in-browser PASS.

**Automated: 300/300** (was 287). `test/worked-example-optional.test.js` covers the default, the
absent-means-included rule, that opting out and back is the identity, the readiness and
step-verification changes, alt/step text still being mandatory, the prompt losing exactly the right
items, the all-in-one dropping card and panel while keeping the other three, the all-in-one building
with no narrative at all, and both project-file directions. `test/a11y.test.js` gained the markup
contract for the collapsible wrapper and an axe run in the collapsed state.

**Four mutations, all caught:**
- absent flag meaning *excluded* → fails the before-the-choice-existed test.
- `translate.js`'s copy drifting to always-true → fails the prompt test.
- a scenario field escaping `#worked-example-body` → fails the wrapper contract.
- the all-in-one keeping its worked-example card regardless → fails the dashboard test.

**In-browser, Chromium against the local server, demo capture loaded:**

| | included | excluded |
|---|---|---|
| Phase body | shown | `hidden` |
| Narrative fields in editor | 12 | 0 |
| Worked-example download | enabled | **greyed** |
| All-in-one download | enabled | **enabled** |
| Walkthrough download | enabled | enabled |
| Translation prompt items | 23 | 14 |

The nine dropped prompt items are exactly `about-audience`, `about-context`, `about-outcome` and
`s1w`–`s6w`. The exported all-in-one measured **3 cards**, no `#panel-worked-example`, and zero links
pointing at it.

Re-ticking restored the phase body, all 12 narrative fields, the scenario text and the narrative text
verbatim, and re-enabled the download — nothing was deleted, confirmed in the running app rather than
only in the model. Undo behaves the same. Both languages swap. No console errors.

Status stays **awaiting verification** — an author actually shipping without one is the open criterion.

## Open edges
- **The card tint alternates by position** (`:nth-child(odd)` in `AIO_CSS`), so dropping a card
  re-tints the ones after it. That is the documented intent of the positional alternation, but the
  three-card dashboard has not been eyeballed against the deck.
- **No per-artifact control for the others.** Quick steps, walkthrough and Word are always produced.
  They cost the author nothing to include, so there is no reason yet — but if that changes, this flag
  is the wrong shape and a set of them would be better.
- **The predicate is duplicated in `translate.js`.** Correct today and commented, but it is behaviour
  in two files. If a third consumer needs it, move it somewhere both can import instead.

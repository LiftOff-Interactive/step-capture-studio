# Feature: project-file
_Stage: stage-4-ship · Status: awaiting verification_

## Goal
Let an author save the whole capture to a single portable file and load it back later — so work
survives closing the tab, moving between machines, and hand-editing in a text editor.

Replaces `feature-autosave` as the way work is preserved (see that file for what was lost in the
trade). Unlike the three artifacts, this file is **for the author, not the reader**.

## Success Criteria
- [x] Export produces one self-contained `.html` — screenshots inlined as data URIs, no external
      request of any kind, no script.
- [x] Import restores the capture exactly: text, screenshots, alt text, scenario, narrative.
- [x] **State that has no visible form survives** — alt-text confirmations, decorative markers, and
      drafted-vs-authored narrative. An import must never silently reopen the export gate.
- [x] **An import must never *invent* a confirmation.** Unconfirmed alt text comes back unconfirmed.
- [x] Editing the prose in a plain text editor changes what is imported.
- [x] A file that is not a project file is refused outright, never half-imported.
- [x] Export is available while work is unfinished — it is a save, not a deliverable.
- [ ] A real author exports, closes the browser, reopens and resumes. — *human, not yet done.*

## How We'll Verify
1. `npm test` — full round trip of a fully authored capture through emit → parse, asserting every
   field including the invisible state; plus hand-edit and refusal cases.
2. Drive the real app: author a capture, export, reload cold, import, confirm the session is back.
3. Edit the exported file in a text editor and confirm the change survives import.

## Verification Log

### 2026-07-22 — Built and verified end to end

**Automated: 14 round-trip tests** in `test/project-roundtrip.test.js`. Metadata, step text in both
languages, screenshots byte-identical, alt text with confirmation state, decorative flags, drafted
vs reviewed narrative, and the scenario block all survive. Hand-editing the prose changes the
import. Deleting a step by hand renumbers rather than leaving a gap. A stranger's HTML, one of our
own artifacts, and a project file with no steps are each refused by code, not by luck.

**Mutation-tested — all three caught:**
- Stop writing `data-confirmed` → fails. State loss cannot pass silently.
- Make import mark everything confirmed → fails. **This is the important one**: it is the shortcut
  that would quietly gut the accessibility gate, and the suite refuses it.
- Read text from an attribute instead of `textContent` → fails 5 tests. Hand-editability is real,
  not incidental.

**In a real browser (Chromium), with the actual demo capture:**
- Authored 6 steps, exported: **2.98 MB, 6 inline images, no `<script>`,** confirmations and
  decorative flags present in the markup.
- Reloaded cold with `localStorage` cleared, imported: 6 steps, 6 screenshots restored, and
  **"Ready to export." immediately** — the confirmations survived, so nothing needed re-checking.
- Hand-edited the file: the edited step text came back, neighbouring steps untouched, confirmations
  still intact.
- **axe: 0 violations, 0 incomplete, 27 passes** over the whole app with the new import control and
  export footer present — in a real browser, so contrast was genuinely measured.

**Still outstanding:** nobody has yet done the thing this feature exists for — export, close the
browser for real, come back later and resume. That is the only criterion left.

## Open Questions
- **Size.** 2.98 MB for six steps, because screenshots are base64 (~33% larger than the PNG). A
  40-step capture would be ~20 MB. Fine for a local file; awkward to email. Worth revisiting only
  if someone actually hits it.
- **No warning before losing work.** With autosave gone, closing the tab without exporting loses
  everything. A `beforeunload` prompt would cover it, but browsers deliberately limit those and an
  unconditional one is its own annoyance. Not built; flagged in `feature-autosave.md`.
- Should Import warn when the file was exported by a newer version? `data-project-version` is
  written and checked for presence, but not compared. There is only one version so far.

## Notes & Decisions
**No hidden JSON state block, deliberately.** Embedding the model as JSON would round-trip just as
reliably and be far less code. It was rejected because it makes the visible document a lie: the
author edits the prose, and nothing happens on import. Keeping state in `data-` attributes on the
elements they describe means the file a person reads *is* the file the app reads. The cost is that
`emit-project.js` and `parse-project.js` are a matched pair with no compiler to keep them honest —
which is exactly what the round-trip tests are for. Change one, change the other.

**Step indexes are taken from position, not from `data-step-index`.** A hand-edited file with a step
deleted must renumber; leaving a gap would break every part of the app that assumes contiguity.

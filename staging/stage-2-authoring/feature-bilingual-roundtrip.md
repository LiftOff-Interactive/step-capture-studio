# Feature: bilingual-roundtrip
_Stage: stage-2-authoring · Status: not started_

## Goal
Get French content into the capture model without the tool ever calling a model or touching a
network. The tool builds a complete, ready-to-paste translation prompt; the author runs it in
whatever assistant they already use and pastes the result back.

## Success Criteria
- [ ] A "Copy translation prompt" action produces a prompt containing every step text and every
      confirmed alt text, each tagged with a stable id.
- [ ] The prompt specifies **Canadian French** and requests a strict, machine-parseable return format.
- [ ] Pasting the response back populates the matching `fr` fields by id.
- [ ] A response with missing, extra, or unrecognised ids produces a clear error naming exactly what
      did not match — never a silent partial import.
- [ ] Import is idempotent: pasting the same response twice changes nothing the second time.
- [ ] Every `fr` field remains hand-editable after import.
- [ ] The round trip requires no JSON editing by the author.
- [ ] Language codes are used as model keys throughout — nothing assumes exactly two languages.

## How We'll Verify
1. `npm test` — round-trip a fixture: build prompt → feed a canned well-formed response → assert every
   field populates. Then feed malformed, partial, duplicate-id, and extra-id responses and assert each
   produces the specific expected error.
2. Do the round trip for real with the sample capture: copy the prompt, run it in Claude, paste back,
   confirm all 10 steps and 10 alt texts populate in Canadian French.
3. Confirm the imported French renders correctly in the artifacts, including accented characters
   (encoding check — no mojibake).
4. Keyboard-only pass; axe-core zero violations.
5. Show the user the populated bilingual state.

## Verification Log
_Empty. Cannot be `verified done` until dated evidence appears here._

## Open Questions
- What return format survives copy-paste from a chat UI most reliably? Fenced JSON is
  machine-parseable but chat clients sometimes reformat it; a delimited `id ||| text` line format is
  uglier but far more robust. **Test both with a real paste before committing to one.**
- Should the prompt include the screenshots? It cannot — this is text-only. That means the translator
  has no visual context for UI labels, which may matter for interface strings that have official
  French equivalents. Worth noting in the prompt itself.
- Does the department have an approved terminology list for these interfaces? If so the prompt should carry it,
  and machine French should be reviewed against it before publication.

## Notes & Decisions
This is the accepted-limitation feature: it moves the *words* into French, not the *interface*.
The French artifact still shows English screenshots. See `docs/decisions.md` — two-capture pairing is
the real fix and the model is already shaped to accept it.

# Feature: bilingual-roundtrip
_Stage: stage-2-authoring · Status: awaiting verification_

## Goal
Get French content into the capture model without the tool ever calling a model or touching a
network. The tool builds a complete, ready-to-paste translation prompt; the author runs it in
whatever assistant they already use and pastes the result back.

## Success Criteria
- [x] A "Copy translation prompt" action produces a prompt containing every step text and every
      confirmed alt text, each tagged with a stable id.
- [x] The prompt specifies **Canadian French** and requests a strict, machine-parseable return format.
- [x] Pasting the response back populates the matching `fr` fields by id.
- [x] A response with missing, extra, or unrecognised ids produces a clear error naming exactly what
      did not match — never a silent partial import.
- [x] Import is idempotent: pasting the same response twice changes nothing the second time.
- [x] Every `fr` field remains hand-editable after import.
- [x] The round trip requires no JSON editing by the author.
- [x] Language codes are used as model keys throughout — nothing assumes exactly two languages.

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

### 2026-07-21 — Built; automated PASS, full browser round trip PASS

**Automated: 108/108** (23 new in `test/translate.test.js`). Prompt contents, Canadian-French
instruction, exclusion of unconfirmed alt text, both return formats, code fences, chat-added bullets,
accents and guillemets, a translation containing the delimiter, empty/prose/duplicate rejection,
unknown-id abort, missing-id reporting, idempotency, immutability, post-import editability, and a
third language proving nothing assumes en→fr.

**In-browser (Chromium 148, real 10-step capture) — a genuine end-to-end round trip:**
- Confirmed all 10 English alt texts; readiness 30 → 20; prompt built with **20 ids** (10 steps +
  10 alt), each `s<n>` / `s<n>a<n>`.
- Wrote real Canadian French for all 20 lines and pasted it back.
- **20 applied.** 10 French step texts and 10 French alt texts populated; English untouched;
  guillemets and accents intact (`Cliquez sur « Guide de l'apprenant »`); readiness 20 → 10.
- **French alt text arrived unconfirmed** — machine translation is a draft in the target language
  too, so the author confirms it separately.
- Failure paths, each leaving French untouched: empty paste, prose with no lines, duplicate id, and
  **unknown id → nothing applied at all**, with the message explaining the reply may belong to a
  different capture.
- Partial reply (2 of 20): applied the 2 and **named all 18 missing ids** — loud, not silent.
- Clipboard write was refused by the browser and the manual-copy fallback engaged correctly.
- axe at 1280×900: **0 violations, 0 incomplete**, contrast passing on **199 nodes**, both languages.

**Three defects found in the browser and fixed:**
1. **Repeating the same error was silent.** `role="alert"` fires on mutation; re-assigning identical
   `textContent` is not one. Now cleared before being set — verified 3 repeats → 3 announcements.
2. **Error text did not follow the language toggle.** `applyStaticStrings` only re-translates
   `data-i18n` markup, and errors are generated. The error is now held as `{code, vars}` and
   regenerated on language change — verified English → French.
3. A phantom third: 31 `color-contrast` results went "incomplete" and looked like a CSS regression.
   The browser pane had collapsed to `0x0`, so nothing had layout. Recorded in
   `docs/failed-approaches.md` so the next person checks the viewport before rewriting CSS.

**Still outstanding:** no screen-reader pass (`help.md` item 6). Nobody has visually looked at the
panel. The prompt has never been run through a real assistant end to end — the French above was
written by hand, so the *format robustness* against a live chat client is still unproven.

### 2026-07-22 — The guide title joins the round trip

The author reported the title still reading in English in every French artifact. Unlike the six
other "still in English" items that session, this one was **not a bug** — it was a model gap.
`capture.title` was a single string parsed from the source document: no French title existed
anywhere, there was no field to type one into, and it was not in the prompt.

**Decided (help.md 9): both an editable field and the round trip.** `capture.title` is now
`{en, fr}` like every other localized field.

- `collectTranslatable` emits it **first**, under the id `title`, so it is easy to spot in a reply.
- `applyTranslation` writes it to the target language only; the source title is never touched.
- A capture with no title simply offers nothing — everything else still translates.
- The prompt explains the id, so the assistant knows it is a guide title rather than a step.

**Verified in a real browser, end to end:** field prefilled from the source document in that
language only → prompt carries `title ||| Testing Windows Audio` as its first line → pasted reply
applied 13 items → the French field filled in → the emitted artifact carried both titles, swapping
with the toggle.

**A bug found on the way, and the same one as last time.** Applying a translation re-rendered the
step list but not the title fields, which live outside it — so the field kept showing an empty
French title while the model held the translated one, and typing into that stale field would have
silently overwritten what had just arrived. `renderTitleFields()` is now called after an apply.
**The suite passed 234/234 both before and after that fix**, exactly as it did for the checkbox
sync defect. Anything rendered outside `rerenderSteps` needs its own refresh, and no test currently
covers that seam.

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

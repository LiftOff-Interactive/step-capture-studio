# Feature: demo-capture
_Stage: stage-4-ship · Status: awaiting verification_

## Goal
Let a stranger use the live site without owning Snagit, without a `.docx`, and without any
internal system on screen. This is the last thing standing between the tool and its own definition
of done: *"a stranger completes the full flow from the live URL."*

## The problem this had to solve
The real capture shows internal departmental systems and can never ship publicly. The synthetic
replacement is a `.docx` — and a `.docx` **cannot go in the repo either**: `.gitignore` excludes it
and the pre-commit hook blocks it, both correctly.

So the demo could not be the source file. It had to be something the app can consume that is safe
to publish.

## Success Criteria
- [x] A demo ships in the repo containing **no internal system imagery**.
- [x] It loads from the live site with **no file for the user to find or supply**.
- [x] It arrives fully authored — both languages, alt text confirmed — so all three artifacts and
      the `.docx` can be exported immediately.
- [x] Everything in it stays editable; it is a starting point, not a locked sample.
- [x] It reuses the ordinary import path, so it cannot rot while normal imports still work.
- [x] The leak guard understands the format the demo ships in.
- [ ] A stranger completes the full flow from the live URL using only the README and the demo.
      — *human, not yet done.*

## How We'll Verify
1. `npm test` — the project-file round trip already covers the format the demo uses.
2. Load the live site, click the demo button, and export all four artifacts without touching
   anything else.
3. Confirm the pre-commit hook blocks the same file from any path outside `assets/demo/`.

## Verification Log

### 2026-07-22 — Shipped as a project file

**It ships as a project file, not a capture.** `assets/demo/testing-windows-audio.project.html`
(0.27 MB, downscaled JPEG) is an ordinary export from `emit-project.js`: screenshots inlined, state on visible
`data-` attributes. The "Try it with a sample capture" button fetches it and hands it to the *same*
importer a user-picked file goes through — one code path, so the demo cannot quietly break while
imports still pass their tests. `.docx` parsing is skipped entirely, which is the point: the demo
never needed to be a capture, only a *state*.

**Authored, not raw.** Six steps, both languages, alt text written and confirmed in each, `why`
narrative for the case study, and a full scenario block. `exportReadiness` reports **ready with zero
blockers** at build time, so a stranger can export all four artifacts on arrival rather than being
met with a list of things to fix.

**Content reviewed:** Windows Sound settings only — taskbar, Settings, Sound, a monitor's audio
device. No internal system, no personal data, no identifiable account.

**The leak guard had a hole, and this feature opened it.** The hook judged files by *name*: it
blocked `.docx` and loose `.png`, but a project file is a `.html` with every screenshot inlined as
base64 — so a project file built from the *internal* capture would have passed straight through into
a public repo. Fixed: check 4 now scans staged file **contents** for a long base64 image payload and
blocks it outside `assets/demo/` and `docs/assets/`. Matched on payload length rather than the
string `data:image`, so the emitters and their tests — which mention data URIs but never contain one
— are not caught; verified zero false positives across the current tree. Tested both directions:
blocked from the repo root, allowed under `assets/demo/`.

## Open Questions
- ~~2.85 MB.~~ **Resolved 2026-07-22: 0.27 MB.** Downscaled to 75% and re-encoded as JPEG at the
  build step — a 91% cut, done with the browser-native canvas API, so no dependency was needed after
  all. Two of the six screenshots showed desktop wallpaper, which PNG stores terribly; at identical
  771×438 dimensions the set was 1455 KB as PNG versus 197 KB as JPEG. This is also what forced the
  image-type detection fix — the pipeline could not honestly carry a JPEG before (see
  `feature-docx-writer.md` and `failed-approaches.md`).
- Should the demo button be more prominent than the file input for a first-time visitor? Currently
  it sits below it, on the assumption that most arrivals have their own capture. Untested.

## Notes & Decisions
**The demo is not a special case in the code.** It would have been simpler to hardcode a sample
capture object, and that is exactly why it was not done: a hardcoded fixture drifts from the real
format silently. Shipping a genuine project file means the demo exercises `parse-project.js` on
every click, and the round-trip tests already guard it.

# Feature: public-polish
_Stage: stage-4-ship · Status: in progress_

## Goal
Make the repo and the live site legible to someone who arrives knowing nothing: what this is, why it
exists, what it will and will not do, and how to try it in under a minute.

## Success Criteria
- [x] README opens with what the tool does and who it is for, before any implementation detail.
- [x] At least one screenshot of the tool itself, in `docs/assets/` — the only place besides
      `assets/demo/` the leak guard permits imagery. `docs/assets/screenshot-landing.png`, the
      landing page (no capture loaded, so no imagery), embedded in the README with descriptive alt.
- [x] The demo is signposted from the README, with the "no file needed" path stated first.
- [x] The privacy claim is prominent and precise: nothing is uploaded; the one network request is
      for the bundled sample, from this same site.
- [x] Known limitations are stated honestly — current Chrome/Edge only, and the French is an
      unreviewed machine draft (`help.md` 7).
- [x] Contribution notes explain the non-negotiables: **never commit a capture**, the pre-commit
      hook (name *and* embedded-image checks), and why the repo carries no runtime dependencies.
- [ ] A stranger can go from the README to an exported artifact without asking a question.
      **Needs a real stranger — human check.**

## How We'll Verify
1. Hand the live URL to someone who has not seen the project and watch where they hesitate.
2. Confirm every README claim against reality — especially the privacy claim and browser support.
3. Confirm screenshots contain no internal system and live only in `docs/assets/`.

## Verification Log

### 2026-07-23 — README rewritten to match the shipped tool

The README was stale: it announced the demo as "still to come" (it ships now), still called the
artifact a "case study", and claimed Chrome/Edge/Firefox/Safari support when the actual decision is
Chromium only (`help.md` 5). Rewritten to describe the four current outputs (worked example, Word
doc per language), the three-phase workflow, the built-in sample, and save/resume via the project
file. Privacy and no-AI sections kept; browser requirement corrected to Chrome/Edge; contribution
notes updated to mention the hook's embedded-image scan.

**One criterion remains, and it is not text:**
- **A stranger completing the flow.** Only a real first-time user can verify that, and it is the
  project's definition of done.

### 2026-07-24 — Screenshot added

`docs/assets/screenshot-landing.png` (the landing page, no capture loaded — so no screenshot
imagery of any system) is embedded at the top of the README. Captured headless over the DevTools
Protocol from the dev server using Node's built-in `WebSocket` — no browser-automation dependency
added — then written to `docs/assets/`, which the leak guard allows. The pre-commit hook was
confirmed to accept it (path-allowed, and the binary PNG trips no embedded-base64 match).

## Open Questions
- Does the README need a short "how it works" section on the AI round trip? The tool never calls a
  model, and that is unusual enough to be worth stating plainly — someone will otherwise assume an
  API key is required.
- Screenshots of the tool will show the demo capture. That is safe, but it does mean the README
  imagery has to be regenerated whenever the demo changes.

## Notes & Decisions
Deliberately last. Polish written before the behaviour settles documents a moving target — the
naming convention, the export gate, and the demo entry point all changed on 2026-07-22, and any
README written earlier in that session would already be wrong.

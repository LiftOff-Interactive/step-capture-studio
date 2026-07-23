# Feature: public-polish
_Stage: stage-4-ship · Status: not started_

## Goal
Make the repo and the live site legible to someone who arrives knowing nothing: what this is, why it
exists, what it will and will not do, and how to try it in under a minute.

## Success Criteria
- [ ] README opens with what the tool does and who it is for, before any implementation detail.
- [ ] At least one screenshot of the tool itself, in `docs/assets/` — the only place besides
      `assets/demo/` the leak guard permits imagery.
- [ ] The demo is signposted from the README, with the "no file needed" path stated first.
- [ ] The privacy claim is prominent and precise: nothing is uploaded; the one network request is
      for the bundled sample, from this same site.
- [ ] Known limitations are stated honestly — current Chrome/Edge only, and the French is an
      unreviewed machine draft (`help.md` 7).
- [ ] Contribution notes explain the non-negotiables: **never commit a capture**, the pre-commit
      hook, and why the repo carries no runtime dependencies.
- [ ] A stranger can go from the README to an exported artifact without asking a question.

## How We'll Verify
1. Hand the live URL to someone who has not seen the project and watch where they hesitate.
2. Confirm every README claim against reality — especially the privacy claim and browser support.
3. Confirm screenshots contain no internal system and live only in `docs/assets/`.

## Verification Log
_Empty. Nothing here is done._

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

---
description: Run the active feature's verification procedure for real and record the evidence
---

Execute the verification protocol on the active feature. **Actually run things.** Reading code and
concluding it looks correct is not verification and must never be recorded as such.

## Procedure

1. **Locate** — read `handoff.md`, follow its 🔗 Pointer to the active feature file. If the user named
   a different feature, use that one instead.

2. **Claim** — state plainly what you believe is complete and which Success Criteria it satisfies.
   Be specific about which criteria you are *not* claiming.

3. **Test** — execute that feature's **How We'll Verify** section step by step, for real:
   - Run the commands. Paste the actual output, not a summary of it.
   - Exercise the behaviour end-to-end the way a real user would.
   - This project's convention requires **both** automated tests and a rendered demo. Neither alone
     is sufficient. See `CLAUDE.md`.
   - Accessibility criteria need real checks: axe-core run, keyboard-only pass, measured contrast
     ratios. "It should be accessible" is not evidence.

4. **Evidence** — append a dated entry to that feature's **Verification Log** containing what you ran,
   the real output, and the environment (browser and version where relevant). Keep it terse but
   concrete enough that someone else could tell whether you actually did it.

5. **Status** — update per the state machine in `CLAUDE.md`:
   - **Pass** → `verified done`. Tick the satisfied criteria and sync the stage `overview.md`.
   - **Fail** → status stays `in progress`. Record the failure. If it was a dead end, append to
     `docs/failed-approaches.md`. Fix, then loop.
   - **Cannot execute** (needs a human, an account, a device you do not have) → status stays
     `awaiting verification`, add the blocker to `help.md`, and tell the user. **Never silently mark
     it done.**

## Rules

- No `verified done` without a Verification Log entry. No exceptions, no "obviously works".
- Never weaken a success criterion to make it pass. Changing criteria requires the user's explicit
  sign-off plus an entry in `docs/decisions.md`.
- Partial passes are reported as partial. Say exactly which criteria are unproven and why.
- If you did not verify something, say so in plain words rather than leaving it ambiguous.

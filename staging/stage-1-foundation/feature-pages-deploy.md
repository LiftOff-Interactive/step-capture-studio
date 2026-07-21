# Feature: pages-deploy
_Stage: stage-1-foundation · Status: not started_

## Goal
Get the site live at a real public URL that redeploys on every push to `main`. Because "done" for
this project means *live*, this ships in Stage 1 — every later stage is then an incremental push
against a proven pipeline instead of a big-bang release at the deadline.

## Success Criteria
- [ ] A public GitHub repo named `step-capture-studio` exists under the user's account.
- [ ] The scaffold and all Stage 1 code are pushed to `main`.
- [ ] GitHub Pages serves the site from `main` at its public URL.
- [ ] Opening that URL in a clean browser profile loads the app shell with no console errors.
- [ ] The real sample parses **at the live URL**, not only from a local file.
- [ ] No build step and no GitHub Action are required for the deploy — Pages serves the repo directly.
- [ ] `.githooks/pre-commit` is active (`git config core.hooksPath` returns `.githooks`) and rejects a
      test commit containing a `.docx`.
- [ ] The repo contains no capture file, and `git log --all --diff-filter=A --name-only` confirms none
      ever did.

## How We'll Verify
1. `gh repo view step-capture-studio --json visibility,url` — confirm it exists and is public.
2. `git log --oneline` and `git status` — confirm the scaffold is committed and the tree is clean.
3. `curl -sSI <pages-url>` — confirm HTTP 200.
4. Open the live URL in a private window, load the real sample, confirm 10 steps render. Screenshot it.
5. **Leak-guard test:** stage a dummy `.docx`, attempt a commit, confirm the hook blocks it with a
   readable message, then unstage. Record the actual hook output.
6. Record all results below with the live URL.

## Verification Log
_Empty. This feature cannot be marked `verified done` until dated evidence appears here._

## Progress — 2026-07-21
Repo created and pushed: **`<your-account>/step-capture-studio`, PRIVATE**.
`git log origin/main` confirms both commits are on the remote.

**Pages has deliberately NOT been enabled.** A Pages site attached to a private repo can be publicly
reachable, which would contradict the explicit decision to stay private until licensing clears.
Enabling it is therefore deferred to the public flip rather than done now and hoped about.

**Consequence:** the "deploy proven in Stage 1" goal is *partially* deferred. Verification will use a
local static server (`npx serve` or equivalent) to prove the app works in a real browser — that
settles the `DecompressionStream` risk, which is the part that actually matters for the
architecture. The Pages pipeline itself gets proven the moment the repo goes public.

## Open Questions
- **Licensing is unresolved and blocks the public push.** The author is a federal employee; the work
  may be subject to Crown copyright or departmental IP policy. No `LICENSE` file has been added
  because guessing at this would be worse than leaving it open. See `help.md` — this is the single
  human to-do gating this feature.
- **Does the account's plan even allow Pages on a private repo?** GitHub Pages for private
  repositories requires a paid plan. The token lacks `user` scope so the plan could not be read.
  Unresolved, and moot if the repo goes public.
- Serve from the repo root or `/docs`? Root is simpler with no build step; decide when creating the
  repo. Root is the current assumption.
- Is a custom domain wanted, or is `<your-account>.github.io/step-capture-studio` fine? Assumed fine.

## Notes & Decisions
Pages serves the repo directly — no Action, no build. That is the entire point of the
no-build-step decision, and it means the deploy has nothing in it that can break independently of
the code.

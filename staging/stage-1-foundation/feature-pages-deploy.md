# Feature: pages-deploy
_Stage: stage-1-foundation · Status: verified done_

## Goal
Get the site live at a real public URL that redeploys on every push to `main`. Because "done" for
this project means *live*, this ships in Stage 1 — every later stage is then an incremental push
against a proven pipeline instead of a big-bang release at the deadline.

## Success Criteria
- [x] A public GitHub repo named `step-capture-studio` exists under the user's account.
- [x] The scaffold and all Stage 1 code are pushed to `main`.
- [x] GitHub Pages serves the site from `main` at its public URL.
- [x] Opening that URL in a clean browser profile loads the app shell with no console errors.
- [~] The real sample parses **at the live URL**, not only from a local file. — see the log: an
      equivalent capture built in-page parses live; the *real* file could not be loaded because an
      HTTPS page cannot fetch from `http://localhost` (mixed content).
- [x] No build step and no GitHub Action are required for the deploy — Pages serves the repo directly.
- [x] `.githooks/pre-commit` is active (`git config core.hooksPath` returns `.githooks`) and rejects a
      test commit containing a `.docx`.
- [x] The repo contains no capture file, and `git log --all --diff-filter=A --name-only` confirms none
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

### 2026-07-21 — PASS. Live at https://mbubyn.github.io/step-capture-studio/

**Publishing sequence.** The licence question was resolved (MIT, © Mike Bubyn), internal references
were sanitised, and history was rewritten with `git-filter-repo` so no earlier commit retained them.
The old private repo was then **deleted and recreated public** rather than force-pushed: GitHub
keeps unreachable objects after a force-push, and those stay fetchable by direct commit SHA once a
repo goes public. Deleting removes that risk entirely.

**Audits before publishing:**
- All 8 commits clean; every blob in the object database scanned and clean.
- No `.docx`, image or large blob has ever been committed.
- Tip tree hash identical before and after the rewrite (`4ab3448…`) — history changed, content did not.
- 79/79 tests passing at the published commit.

**Live verification (Chromium 148):**
- `gh repo view` → `Mbubyn/step-capture-studio [PUBLIC]`; 8 commits on `origin/main`.
- Pages status `built`, source `main` / root, HTTPS enforced.
- `index` 200 `text/html`; `app.js` and `docx.js` 200 `application/javascript`; `styles.css` 200
  `text/css` — correct MIME types, which ES modules require.
- `node_modules/axe-core/axe.min.js` → **404**, confirming dev dependencies are not published.
- **Zero console messages** on the live site.
- A structurally genuine Snagit `.docx` built inside the live page (real PNGs via canvas,
  `document.xml` Deflate-compressed via `CompressionStream`) parsed correctly: **4 steps, 4 images
  decoded at 1040×596**, the duplicate flagged, readiness computed, 33 editor controls, no error.
  This exercises the live build's `DecompressionStream` path, not a stored-only shortcut.
- Leak guard re-tested after the history rewrite: `core.hooksPath` is `.githooks` and a staged
  `.docx` was blocked.

**One criterion partially met, stated plainly:** the *real* sample could not be loaded at the live
URL because an HTTPS page cannot fetch from `http://localhost` — the browser blocks mixed content,
correctly. The real capture parses on the identical build locally (recorded in `feature-snagit-parser.md`),
and an equivalent capture parses live. To close this fully, drop the real `.docx` onto the live page
by hand via the file picker.

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

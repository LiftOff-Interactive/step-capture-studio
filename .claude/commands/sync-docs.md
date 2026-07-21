---
description: Update every doc that this session actually changed, then report what you touched
---

The user said "update all relevant files" (or ran `/sync-docs`). Bring the documentation back in line
with reality.

## 1. Review what actually happened
Go back over this session: what changed, what was decided, what got built, what failed. Check
`git log --oneline` and `git status` against your recollection.

**Only record reality.** If something was not verified, it does not get written down as working. If
you are unsure whether something works, that uncertainty is the fact to record.

## 2. Update what genuinely changed
Infer relevance from the session — do not ask the user a checklist.

- **`handoff.md`** — always. **Rewrite every section in place**: Goals, Current State, Files I'm
  Working On, Things I've Changed, Watch Out, Next Up, Pointer. Nothing accumulates here.
  **Enforce the budget:** ≤ 60 lines total · "Things I've Changed" keeps only the last **5** · "Watch
  Out" at most **3** one-liners, each pointing to its full entry in `docs/failed-approaches.md`.
  If the file is over budget, compressing it is part of this job, not an optional extra.
- **Active feature files** — update Status per the state machine. `verified done` requires a
  Verification Log entry; if there is no evidence, the status does not change no matter how finished
  the code feels. Resolve or append Open Questions.
- **Stage `overview.md`** — if scope, done-criteria, or a feature's status changed.
- **`docs/decisions.md`** — append any decision made this session, with the why and what was rejected.
  Never rewrite existing entries.
- **`docs/failed-approaches.md`** — append any dead end, with root cause and what to do instead.
- **`docs/master_plan.md`** — only if the vision or roadmap genuinely changed.
- **`CLAUDE.md`** — only if a rule, convention, or stack fact changed.
- **`new_session_prompt.md`** / **`.claude/commands/resume.md`** — only if the resume procedure changed.
- **`help.md`** — if new human-only blockers appeared or old ones were cleared.

## 3. Integrity check
- `handoff.md`'s 🔗 Pointer resolves to a stage folder and feature file that actually exist.
- `handoff.md` is within its 60-line budget. Count the lines.
- Every feature marked `verified done` has a dated entry in its Verification Log.
- No file left half-edited.

## 4. Report back in 3–5 lines
Which files you updated and why, plus anything you deliberately did **not** update.

## 5. Offer to commit
`docs: sync session state`. Do not commit without asking. Never use `--no-verify` — the pre-commit
hook is the leak guard and bypassing it is how internal screenshots reach a public repo.

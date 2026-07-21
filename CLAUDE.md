# CLAUDE.md — step-capture-studio

**Read `handoff.md` first, then follow its 🔗 Pointer to the active feature file. Do that before anything else.**

## What this is
A zero-install, zero-upload static web tool that turns one Snagit step-capture `.docx` into three
bilingual, WCAG 2.1 AA training artifacts: quick-steps guide, HTML walkthrough, case study.

## Stack (all deliberate — see docs/decisions.md)
- Vanilla JS, ES modules, **no build step, no runtime dependencies**. Push to `main` = deploy.
- Browser-native only: `DecompressionStream`, `DOMParser`, `Blob`, `localStorage`.
- Dev-only deps (`node:test`, `axe-core`, `jsdom`) are for tests. They never ship.
- Hosted on GitHub Pages from `main`. No server, no API key, no account, ever.

## Document model (linked list)
- `CLAUDE.md` — the constant. Rarely changes.
- `handoff.md` — the HEAD. Where we are right now. ≤ 60 lines, always a snapshot, never a journal.
- `staging/<stage>/feature-*.md` — the list itself. The ordered body of work.
- `docs/` — the full vision, decisions, and dead ends.

## Standing command
When the user says **"update all relevant files"**, run `/sync-docs`.

## Verification protocol
- Status is a state machine: `not started → in progress → awaiting verification → verified done`.
- Finishing code moves a feature to **awaiting verification**, never straight to done.
- **No `verified done` without a dated entry in that feature's Verification Log.** No exceptions.
- Blocked verification (needs a human, a key, a real device) → stays `awaiting verification`,
  blocker goes to `help.md`, tell the user. Never silently mark done.
- Run `/verify` to execute the active feature's procedure and record evidence.
- Never weaken success criteria to make them pass.

## This project's verification convention
Every feature needs BOTH:
1. **Automated** — `npm test` (golden-file tests against real parser output; axe-core on generated HTML).
2. **Rendered demo** — actually open the artifact and show the user what it looks like.
"It compiles" and "the tests I wrote pass" do not count on their own.

Accessibility is verified, not assumed: axe clean + keyboard-only pass + visible focus at every step.
`.docx` output is verified against **Word's own Accessibility Checker**, not by inspection.

## Non-negotiable rules
- **Never commit a real capture.** No `.docx`, `.mht`, `.snagx`, `.pdf`, or screenshot of an internal
  system, ever. The repo is public and the source captures are internal government systems. A pre-commit
  hook in `.githooks/pre-commit` enforces this — never bypass it with `--no-verify`.
- **Accessibility is built in, not retrofitted.** Every UI change ships keyboard-operable and
  AA-contrast from the first commit.
- **Bilingual by construction.** No user-facing string is hardcoded; everything resolves through the
  EN-CA/FR-CA dictionary in `src/lib/i18n.js`. Never key logic off English step verbs — Snagit
  captures may be French (`Cliquez sur`). Strip only the `N.` numbering.
- Zero runtime dependencies. If you reach for a library for shipped code, stop and reconsider.

## Conventions
- Branch `main` directly for now (solo project). Commit at every verified green checkpoint.
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Run `npm test` before every commit.
- ES modules, 2-space indent, no semicolon-free style — match existing files.

## Truth hierarchy
actual code/system state > `handoff.md` > stage files > `docs/master_plan.md`.
When docs and reality disagree, **reality wins** — fix the docs and say you did.

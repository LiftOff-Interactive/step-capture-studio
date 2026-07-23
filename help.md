# help.md — things only you can do

Ordered by urgency. Claude adds to this file whenever it hits a wall only a human can clear, and
tells you at the time. Tick items as you complete them.

---

## 🔴 Blocking now

_Nothing is blocking as of 2026-07-21._

### [x] 1. ~~Resolve licensing~~ — done 2026-07-21
**Decided:** MIT, © 2026 Mike Bubyn. `LICENSE` created, README updated.
**Note:** this was chosen on your instruction. If your department's IP policy later turns out to
assert Crown copyright over this work, the licence line is the thing to revisit — see
`docs/decisions.md`.

### [x] 2. ~~Confirm the GitHub repo can be created and pushed~~ — done 2026-07-21
Authenticated as **<your-account>**. Repo created at `<your-account>/step-capture-studio`, **private**, both commits
pushed. Pages not enabled — see item 2b.

### [x] 2b. ~~Decide how Pages should be exposed~~ — done 2026-07-21
Repo is **public**, Pages enabled from `main` / root, HTTPS enforced.
Live at **https://mbubyn.github.io/step-capture-studio/**

Before publishing: internal references were sanitised, history rewritten with `git-filter-repo`, and
the old private repo **deleted and recreated** rather than force-pushed — GitHub retains unreachable
objects after a force-push, which stay fetchable by SHA once a repo is public.

## 🟡 Needed soon

### [ ] 3b. Re-run Word's Accessibility Checker — **the first attempt could not have worked**
**What:** Export a **fresh** Word document (the old ones will not do), open it, then
Review → Check Accessibility, and confirm zero errors.

**Read this before repeating it:** you tried on 2026-07-22 and Word made you *convert* the file
first — "this document is in an older format with limited functionality". That message was the
finding. The file was opening in **Compatibility Mode**, where Word **disables the Accessibility
Checker entirely**, so what you checked was Word's converted copy rather than the tool's output.
Nothing you did was wrong; the criterion was unreachable.

**Cause, now fixed:** we emitted no `word/settings.xml`, so Word assumed the 2007 format era.
Adding it with `compatibilityMode 15` is verified via COM — `CompatibilityMode` now reports 15 in
both EN and FR. A freshly exported file should open as a modern document with **no conversion
prompt at all**. If it still asks you to convert, stop and tell me: the fix did not take.

**⚠️ Check WHICH file you are opening.** On 2026-07-22 the retest used
`Downloads\microsoft-edge-en.docx`, exported from the **live site** — which still runs the old code,
because none of this session's work is committed or pushed. That file has no `settings.xml` and was
always going to prompt. The old-style filename is the tell: anything named `something-en.docx`
predates the fix. A fixed export is named `Something_Document_EN.docx`.

**What to report back:** whether the conversion prompt appeared, then the checker's verdict —
*errors* specifically, since warnings and tips do not fail this criterion.
**Blocks:** the last unticked criterion in `staging/stage-4-ship/feature-docx-writer.md`.

**⚠️ Privacy note (2026-07-22):** the `TestingWindowsAudio_*.docx`/`.html` files left on your Desktop
for this test embed the *original* step-3 screenshot, which shows your email. They are local only,
but delete them (or re-export fresh from the live site) if you might share them — the repo/live demo
are already redacted, these Desktop copies are not.

### [x] 3c. ~~Print each of the three HTML artifacts to PDF~~ — done 2026-07-22
**Confirmed by you:** the quick-steps guide fits one page with nothing clipped, and screenshots do
appear in both the walkthrough and the case study. The `loading="lazy"` class of failure is retired.

**One defect found in the same pass:** case-study images printed at full page width, orphaning each
step's explanation onto the following page. Fixed — print now caps images at 4.6in × 3.2in with
`break-inside: avoid` on the figure, measured at 29% of a page rather than 100%.

### [ ] 3. Provide a second Snagit capture — ideally a French one
**What:** Record any short procedure in Snagit and export to `.docx`. A capture made with a
French-language interface would be worth considerably more than a second English one.
**Why it's needed:** The parser is currently built against exactly one sample, from one Snagit
version, one theme, one locale. This is risk #1 in the master plan. A second capture — especially
French — turns an assumption into a tested fact.
**Where to put it:** anywhere outside the repo. `<your-downloads-folder>\` is fine. **Do not put
captures inside the project folder**; the pre-commit hook will block them, but keeping them out
entirely is safer.
**Blocks:** nothing outright, but it de-risks `feature-snagit-parser` substantially.

### [x] 4. ~~Record a synthetic demo capture~~ — supplied 2026-07-22
**Supplied:** "Testing Windows Audio" — 6 steps through Windows Sound settings, kept outside the
repo. Content reviewed: Windows Settings only, no internal system, no personal data on screen.

**It parsed clean on the first attempt** — 6/6 steps, declared count matched, zero warnings, title,
author and date all correct. That is worth more than the demo itself: the parser had only ever seen
**one** capture, which was risk #1 in the master plan. A second, independently recorded capture
turns "we assume the format is stable" into a tested fact for English (item 3 — a French capture —
is still open and still the more valuable one).

**Now shipped**, as a *project file* rather than a capture: `assets/demo/` holds a fully authored
export the app loads with one click ("Try it with a sample capture"). The `.docx` itself stays out
of the repo, correctly. Nothing further is needed from you on this item.

### [x] 5. ~~Confirm which browsers must be supported~~ — done 2026-07-21
**Decided:** current Chrome/Edge only. `DecompressionStream('deflate-raw')` is confirmed working in
Chromium 148, so no fallback inflate was needed. If a locked-down older browser ever has to be
supported, that is roughly 200 lines of hand-written inflate — the guard is already in place: the
file input is disabled with a translated "browser too old" message rather than failing silently.

---

## 🟢 Nice to have

### [ ] 6. Check for a screen reader on your machine
**What:** Confirm whether NVDA or Windows Narrator is available to you.
**Why it's needed:** Several accessibility criteria require a real screen-reader pass. Automated
tooling like axe catches missing alt text but cannot tell you whether the guide is actually usable.
Without one, those criteria stay `awaiting verification` rather than being marked done.

### [ ] 7. Confirm terminology guidance for French translation
**What:** Whether the department has an approved French terminology list for the interfaces being documented.
**Why it's needed:** Machine translation will invent plausible French for UI labels that already have
official equivalents. If a list exists, the translation prompt should carry it.

### [x] 9. ~~Decide how a capture gets a French title~~ — decided and built 2026-07-22
**Decided:** both — an editable field per language **and** the title carried by the translation
round trip. `capture.title` is now `{en, fr}` like every other localized field.

**Built and verified in a real browser:** the field appears under Capture, prefilled from the source
document in that language only; the prompt now carries a `title` line first; pasting the reply back
fills the French field; and the artifacts render both titles, swapping with the toggle.

**One judgement call worth knowing about:** where only one language has a title, the artifacts fall
back to the one that exists rather than showing "Untitled capture" — and the heading is then
rendered **once**, not twice. Emitting both blocks would print the same words twice in a row with
JavaScript disabled, which is also the print view.

### [ ] 10. Export before you close the tab — autosave is gone
**What:** Get into the habit of clicking **Export project file** before closing the browser.
**Why it's needed:** you asked for autosave to be replaced by import/export on 2026-07-22, and it
has been deleted. There is no longer any automatic recovery: closing the tab, a crash, or an
accidental refresh loses the session outright, with no warning and nothing in `localStorage`.
The project file is the only copy of your work.
**If that turns out to be uncomfortable in practice**, two things would soften it without bringing
autosave back: a prompt when leaving the page with unsaved changes, or restoring autosave alongside
the project file. Say the word — `staging/stage-2-authoring/feature-autosave.md` records exactly
what was removed, and it is all recoverable from git.

### [ ] 8. Consider moving the project off OneDrive
**What:** The project lives in `OneDrive\Documents\.ClaudeProjects\`. Git repositories in synced
folders occasionally hit file-lock conflicts, and `node_modules` sync is slow.
**Why it's needed:** Low risk, but if you see strange git errors or sluggish installs, this is the
first thing to suspect. Not urgent — your other projects already live here without apparent trouble.

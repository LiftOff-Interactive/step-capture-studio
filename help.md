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

### [ ] 3b. Run Word's Accessibility Checker on an exported .docx
**What:** Export a Word document from the tool, open it, then Review → Check Accessibility, and
confirm zero errors.
**Why it's needed:** it is the one Stage 4 criterion I cannot automate — Word exposes no COM API for
the checker's results. Everything the checker looks for has been verified individually against Word
16.0 (document title, alt text on every image, real heading styles, correct language), and Word
opens the file with no repair prompt. But "every ingredient is present" is not the same as "the
checker passes", and this project does not treat those as equivalent.
**Blocks:** the last unticked criterion in `staging/stage-4-ship/feature-docx-writer.md`.

### [ ] 3c. Print each of the three HTML artifacts to PDF
**What:** Open each generated artifact and print to PDF. Check the quick-steps guide fits one page
with nothing clipped, and that screenshots actually appear in the walkthrough and case study.
**Why it's needed:** printing is untested for all three, and it is the *defining* property of the
quick-steps guide. The walkthrough already had a bug (`loading="lazy"`) whose main symptom would
have been blank screenshots in print — that class of failure is invisible on screen.
**Blocks:** an unticked criterion in `staging/stage-3-generators/feature-quick-steps.md`.

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

### [ ] 4. Record a synthetic demo capture
**What:** A Snagit step capture of something **public and non-sensitive** — a Wikipedia search, a
weather site, anything with no internal system on screen. Five or six steps is plenty.
**Why it's needed:** The live site needs a demo file a stranger can try. Your real capture shows
internal departmental systems and can never ship publicly.
**Blocks:** `stage-4-ship/feature-demo-capture`, and the "a stranger can use it" definition of done.

### [ ] 5. Confirm which browsers must be supported
**What:** Tell Claude the browsers and versions this needs to work in — particularly whatever is
standard on managed departmental machines.
**Why it's needed:** The whole zero-dependency approach rests on `DecompressionStream`, which is
unavailable in older browsers. If a locked-down or older browser must be supported, roughly 200 extra
lines of fallback code are required. Better to know now than after Stage 3.
**Blocks:** nothing yet; changes the scope of `feature-docx-reader` if the answer is restrictive.

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

### [ ] 8. Consider moving the project off OneDrive
**What:** The project lives in `OneDrive\Documents\.ClaudeProjects\`. Git repositories in synced
folders occasionally hit file-lock conflicts, and `node_modules` sync is slow.
**Why it's needed:** Low risk, but if you see strange git errors or sluggish installs, this is the
first thing to suspect. Not urgent — your other projects already live here without apparent trouble.

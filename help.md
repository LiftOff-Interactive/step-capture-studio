# help.md — things only you can do

Ordered by urgency. Claude adds to this file whenever it hits a wall only a human can clear, and
tells you at the time. Tick items as you complete them.

---

## 🔴 Blocking now

### [ ] 1. Resolve licensing before the repo goes public
**What:** Decide what licence this code ships under, or whether it can be published at all.
**Why it's needed:** You are a federal employee. Work created in the course of employment may be
subject to **Crown copyright** or your department's IP policy, and neither Claude nor you should
guess at that. No `LICENSE` file has been created for exactly this reason — an incorrect licence on a
public repo is materially harder to undo than a missing one.
**What to check:** your department's policy on publishing code, and whether this counts as work
product. The Government of Canada commonly uses the MIT licence for open-sourced code, which would be
the obvious choice if publishing is permitted.
**Blocks:** `stage-1-foundation/feature-pages-deploy` — specifically making the repo public. You can
build and deploy privately in the meantime; this only gates the visibility flip.

### [x] 2. ~~Confirm the GitHub repo can be created and pushed~~ — done 2026-07-21
Authenticated as **<your-account>**. Repo created at `<your-account>/step-capture-studio`, **private**, both commits
pushed. Pages not enabled — see item 2b.

### [ ] 2b. Decide how Pages should be exposed when the repo goes public
**What:** Two things to know before Pages is switched on.
1. **Pages on a *private* repo requires a paid GitHub plan.** Your token lacks the `user` scope so
   the plan could not be read. If you are on Free, Pages will only work once the repo is public.
2. **A Pages site on a private repo can still be publicly reachable.** That is why Pages was left
   off rather than enabled quietly — it would have contradicted your "private until licensing
   clears" decision.
**Why it's needed:** Determines whether the live URL arrives before or after item 1 is resolved.
**Blocks:** the full `feature-pages-deploy` definition of done. Browser verification of the app
itself is *not* blocked — that runs against a local static server in the meantime.

---

## 🟡 Needed soon

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

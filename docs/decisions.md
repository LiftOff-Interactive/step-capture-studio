# Decision Log

Append-only. Newest entries go at the bottom. Never rewrite history — if a decision is reversed,
add a new entry that says so and link back.

---

## 2026-07-21 — Input format: Snagit `.docx` export only for v1
**Chose:** Parse the `.docx` Snagit produces from a step capture. ·
**Because:** A `.docx` is a ZIP — step text and original screenshots extract losslessly with no
image-quality loss and no layout guessing. Confirmed against a real sample before committing. ·
**Rejected:** `.pdf` (screenshot extraction is lossy, slow to build, and text order is not
guaranteed); `.snagx` (undocumented proprietary format); Steps Recorder `.mht` (different product,
different structure). ·
**Revisit if:** a second input format is needed — add a parser behind the existing adapter boundary,
do not change the capture model.

## 2026-07-21 — Hosting: GitHub Pages, client-side only
**Chose:** Static site on GitHub Pages, all processing in the browser. ·
**Because:** The source screenshots show internal government systems. Any architecture that uploads a
capture is disqualified on those grounds alone, before cost or complexity enter the discussion.
Client-side also means no key, no account, no cost, no login. ·
**Rejected:** Serverless proxy (still transmits the document); any hosted backend. ·
**Revisit if:** a feature genuinely requires server state — it almost certainly does not.

## 2026-07-21 — No AI inside the tool
**Chose:** Fully deterministic transformation. The tool never calls a model. ·
**Because:** No API key to manage in a public static site, no cost to anyone, and — most importantly
— no fabricated business rationale in training material. A model reading `Click Submit` cannot know
why that submit matters, and a confident wrong *why* in a case study does real damage. ·
**Rejected:** Bring-your-own-key in the browser (key handling is hostile to non-technical trainers);
serverless proxy (someone funds strangers' usage); in-tool inference (hallucination risk). ·
**Revisit if:** the copy-prompt round trip proves too tedious in real use.

## 2026-07-21 — Case-study narrative: editable skeleton plus copy-prompt
**Chose:** A deterministic skeleton with a "Why this matters / What breaks if skipped" field per
step, plus a one-click button that builds a ready-to-paste AI prompt. ·
**Because:** Keeps the AI benefit while leaving AI outside the trust boundary. The author stays
accountable for what reaches learners. ·
**Rejected:** Pure manual authoring (too slow); pure AI inference (see above); cutting the case study
from v1 (it is one of the three requested artifacts). ·
**Revisit if:** authors consistently ship the skeleton unedited — that would mean the prompt path is
not being used and the design has failed.

## 2026-07-21 — Stack: vanilla JS, no build step, zero runtime dependencies
**Chose:** Hand-written ES modules using only browser-native APIs. Dev-only test dependencies are
permitted and never ship. ·
**Because:** Push to `main` is the deploy — no CI to break, no toolchain to re-learn in a year, and
an outside contributor can read the whole thing without installing anything. Verified feasible: the
`.docx` XML parts are Deflate (`DecompressionStream` handles natively) and the PNGs are Stored, so
they slice straight out of the byte buffer. ·
**Rejected:** Vite (build step for no benefit at this size); React (largest dependency surface for a
tool this small); JSZip (unnecessary once the compression methods were confirmed). ·
**Revisit if:** the authoring UI's state management becomes genuinely unmanageable by hand.

## 2026-07-21 — Deploy in Stage 1, not at the end
**Chose:** GitHub Pages deployment is a Stage 1 deliverable. ·
**Because:** The user's definition of done is "live on Pages." Proving the deploy path on day one
makes every later stage an incremental push instead of a big-bang release with an unproven pipeline. ·
**Rejected:** Deploying last (standard, and standard is wrong here — it back-loads the risk that
defines "done"). ·
**Revisit if:** never. This one is just correct.

## 2026-07-21 — Bilingual EN-CA / FR-CA is a v1 requirement
**Chose:** Every artifact ships bilingual; the HTML walkthrough carries a language toggle that swaps
content and the `lang` attribute. ·
**Because:** The user is at a Canadian federal department; Official Languages obligations are not
optional. Building it in from the start is far cheaper than retrofitting a language dimension
through a finished content model. ·
**Rejected:** English-only v1 with French later (would require rewriting the model, the editor, and
all three emitters). ·
**Revisit if:** never for the requirement. The *mechanism* is open — see the next entry.

## 2026-07-21 — French content via copy-prompt translation, with English screenshots
**Chose:** The tool builds a translation prompt containing all step text and alt text; the author
runs it externally and pastes the French back. Screenshots remain the English capture in both
language versions. ·
**Because:** The tool cannot translate deterministically and will not call a model. This is the
cheapest path to a French artifact. ·
**Rejected:** Two-capture pairing — record the procedure in both the EN and FR interface and pair by
step index. This is the *correct* answer, since a francophone user needs screenshots of the French
interface, and was recommended. Deferred because it requires recording every procedure twice. ·
**Known limitation:** French guides show English UI screenshots. A francophone following the guide
sees an interface that does not match their screen. ·
**Revisit if:** a francophone pilot flags the mismatch, or an OL review challenges it. The content
model is already per-language, so two-capture pairing stays a small change — keep it that way.

## 2026-07-21 — WCAG 2.1 AA applies to artifacts, the tool UI, and the `.docx`
**Chose:** All three surfaces conform. Accessibility is built in from the first commit and verified,
never assumed. ·
**Because:** A Government of Canada tool that trainers cannot operate by keyboard is its own
compliance problem, and retrofitting accessibility is how these projects die. ·
**Rejected:** Artifacts-only conformance (what was originally asked for — the tool UI was added
because its marginal cost is low and its absence would be conspicuous). ·
**Revisit if:** never. Scope may grow but this floor does not move.

## 2026-07-21 — Alt text is required before export
**Chose:** Two alt-text fields per screenshot (EN + FR), seeded from step text as a draft the author
must actively confirm. Export is blocked until every image has confirmed alt text. ·
**Because:** WCAG 1.1.1 requires meaningful alt text, and Snagit supplies none. Auto-generating
`"Screenshot: Click 'Open in Word'"` and shipping it unreviewed is a weak pass that reviewers flag. ·
**Rejected:** Auto-generated alt text with no confirmation (fails review); optional alt text (would
be skipped under deadline pressure, which is exactly when it matters). ·
**Revisit if:** authors find the gate so onerous they stop using the tool — but soften the UX, not
the requirement.

## 2026-07-21 — `localStorage` autosave added to v1
**Chose:** In-progress work persists to `localStorage` automatically. ·
**Because:** Authoring a 10-step capture means 20+ hand-entered fields once alt text and French are
counted. Losing that to an accidental refresh would make the authoring stage hostile to use. Still
zero-server, so it costs nothing architecturally. ·
**Rejected:** Session-only state (originally scoped out; reversed once the alt-text and bilingual
requirements landed and the manual input burden became clear). ·
**Revisit if:** capture sizes exceed the `localStorage` quota (~5 MB) — screenshots may need to stay
out of the persisted draft.

## 2026-07-21 — Repo is public, protected by a pre-commit hook
**Chose:** Public repo named `step-capture-studio`, with `.githooks/pre-commit` hard-failing on any
staged capture file or stray screenshot. ·
**Because:** The tool is worth sharing, but the source captures are internal government systems and
git history is permanent. Enforcement belongs in a hook, not in a good intention or a CLAUDE.md line
that a future session might not read. ·
**Rejected:** Private repo (safer, but the user chose open source); `.gitignore` alone (does not stop
`git add -f`). ·
**Revisit if:** a real capture ever does land in history — that requires history rewriting and an
immediate visibility flip, not a follow-up commit.

## 2026-07-21 — Accessibility testing: axe-core in jsdom AND in a real browser
**Chose:** axe-core 4.12.1 as a dev dependency, run automatically under jsdom in `npm test` across
four page states in both languages, plus manual in-browser runs for the rules jsdom cannot execute.
Assertions cover axe's `incomplete` bucket, not only `violations`, and are backed by bespoke tests
for what axe cannot check at all. ·
**Because:** the first version of this suite passed while failing to detect three of six deliberately
injected defects. A green accessibility suite that catches nothing is worse than no suite, because it
manufactures false confidence. Mutation testing is now the standard for any new a11y assertion. ·
**Rejected:** violations-only assertions (silently drop dangling ARIA references, which axe files
under "needs review"); jsdom alone (cannot run `color-contrast` — no layout engine); a real browser
alone (not automatable in `npm test`, so it cannot guard against regressions). ·
**Known gaps, deliberately accepted:** axe cannot judge alt-text *quality* (`alt=""` is valid for
decorative images) and axe 4.x removed the `duplicate-id` rule — both are covered by bespoke
assertions instead. ·
**Revisit if:** a headless-browser test runner is added, which would let `color-contrast` run in CI
and remove the manual step.

## 2026-07-21 — Split DOM building out of app.js into src/ui/render.js
**Chose:** Pure builder functions that take an explicit `document` and return detached nodes;
`app.js` keeps events, state and side effects. ·
**Because:** accessibility tests need to construct the *rendered* state without a file picker or a
real browser — testing only the empty shell would have missed every defect that appears once a
capture is loaded. Stage 2's editor also has to re-render these regions after every edit. ·
**Rejected:** testing only the static HTML (misses the states that matter); driving a headless
browser for every assertion (slow, and not needed for structural rules). ·
**Revisit if:** the render layer grows enough state that pure functions stop fitting.

## 2026-07-21 — Licence: MIT, © Mike Bubyn
**Chose:** MIT, with the copyright line naming Mike Bubyn personally. ·
**Because:** the user instructed MIT for open-sourced code and chose personal attribution over Crown
copyright. MIT is also the licence the Government of Canada most commonly uses when open-sourcing
code, so it is unlikely to be the point of friction if this is ever reviewed. ·
**Rejected:** Crown copyright ("His Majesty the King in Right of Canada"), and dual attribution —
both were offered and personal attribution was chosen. ·
**Revisit if:** the department's IP policy turns out to assert ownership over work created in the
course of employment. That would change the copyright line, not necessarily the licence.

## 2026-07-21 — Sanitised internal references before going public
**Chose:** Replace every named internal system, the author's work username, and local Windows paths
with neutral equivalents across code, tests and docs — before the repo's visibility changes. Fixture
step text became a generic course-portal example while preserving the exact structure the tests
depend on (five steps with an identical consecutive pair at positions 3 and 4). ·
**Because:** a public repo is a permanent, indexed record. An audit found no capture file, image or
large blob had ever been committed, but committed *text* named internal systems and identified the
author's employer. That is a disclosure decision the author should make deliberately, not discover
afterwards. ·
**Rejected:** publishing as-is (the names are not secret, but git history cannot be walked back);
rewriting history (would have discarded the whole commit history, and was unnecessary since the repo
had never been public). ·
**Revisit if:** a real capture is ever committed by accident — that requires history rewriting and an
immediate visibility flip, not a follow-up commit.

## 2026-07-21 — Delete and recreate the repo instead of force-pushing the scrubbed history
**Chose:** After rewriting history with `git-filter-repo`, delete the private repo on GitHub and
create it fresh as public, then push the clean 8 commits. ·
**Because:** a force-push does not remove anything from GitHub. The old commits survive as
unreachable objects and stay fetchable by direct SHA URL until GitHub garbage-collects — on no
schedule the owner controls. Once the repo went public those objects would have been readable by
anyone who knew a SHA, defeating the entire scrub. The repo was one day old with no issues, PRs,
stars or forks, and the full history existed locally plus in two backup bundles. ·
**Rejected:** force-push (leaves the old objects; purging needs a GitHub Support request); squashing
to one commit (would have discarded the commit narrative, and the author chose to keep all 8). ·
**Revisit if:** never — this is the correct order of operations any time history is scrubbed before
a repo becomes public.

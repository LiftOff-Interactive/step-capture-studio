# Feature: all-in-one
_Stage: stage-4-ship · Status: **awaiting verification** — built 2026-07-24_

## Goal
One export that bundles every other artifact into a single self-contained file: a dashboard/launcher
with the walkthrough-style header and a card per output, so a recipient gets everything in "one
destination" without juggling separate files. Requested with a mockup 2026-07-24.

## The shape, and why
`emitAllInOne(capture, {languages})` composes the other emitters — it *is* their sum:
- The three HTML artifacts (Walkthrough, Worked Example, Quick Reference) are each embedded **whole,
  in an isolated `<iframe srcdoc>`**. That was the key call: inlining three full documents into one
  page would collide on CSS, ids, and scripts, and the walkthrough is interactive. An iframe gives
  each artifact its own document — its own styling, its own bilingual toggle, its own behaviour —
  with zero cross-talk, using nothing but a browser-native attribute.
- The Word document rides along as base64 **English / French download links**, placed under the
  Worked Example card (author's choice, 2026-07-24, matching the mockup).
- Reveal is **CSS-only, via `:target`**: a card links to its panel, panels are hidden until targeted,
  and the menu collapses (`:has`) while one is open. So it degrades with no JavaScript — the cards
  become in-page jumps to the artifacts stacked below — and the file needs no script of its own
  beyond the shared language toggle.
- Async only because the Word document is (`emitDocx` builds a zip).

## Success Criteria
- [x] A single self-contained HTML file — no external files, links, or fetches.
- [x] Same header as the other artifacts (title, author, date, language toggle), reused verbatim.
- [x] Four cards (2026-07-24 redesign): three open an artifact in-page, isolated and fully
      functional; **Step Guide is download-only** (the Word EN/FR links, no panel), visually flat
      while the "open" cards carry the light panel.
- [x] **One language control** (2026-07-24): the single top-right toggle drives the dashboard AND the
      embedded artifacts; each artifact's own toggle is hidden.
- [x] **A Print button** on each sub-page (2026-07-24) that prints just that artifact, with its own
      print styling.
- [x] Works with JavaScript disabled (CSS-only reveal; cards jump to stacked panels).
- [x] Gated exactly like the Worked Example — the strictest input — so everything it bundles is
      guaranteed exportable.
- [x] Keyboard-operable, visible focus, axe-clean (real browser, contrast included).
- [ ] Screen-reader pass over the dashboard and the reveal (`help.md` 6) — *human, shared with the
      rest of the project.*

## How We'll Verify
1. `npm test` — structure (cards ↔ panels), embedded artifacts present, two base64 Word links,
   bilingual chrome, axe under jsdom.
2. In a browser: build from the real demo, open it, reveal each artifact, toggle language, confirm
   the Word links and the export gate.

## Verification Log

### 2026-07-24 (later) — Redesign: 4 cards, one language control, print buttons

On a revised mockup: a fourth **Step Guide** card that is **download-only** (the Word EN/FR links move
here from the Worked Example, no panel to reveal), a **single** language control that drives the whole
page, and a **Print** button on each sub-page.

**Design.** The Word links now live in a flat `.aio-card--download` card; the three artifact cards
keep the light `.aio-card--panel`. A small controller script (passed as `renderDocument`'s `script`,
after the shared toggle) does what needs JavaScript: on every `artifact:langchange` the dashboard
announces, it sets `data-lang`/`lang` on each same-origin srcdoc iframe and re-dispatches the event
inside it (so per-language alt text follows), and it hides each artifact's own `#lang-toggle` — so one
control drives everything. Each panel gained a bar with Back + a Print button that calls the iframe's
own `contentWindow.print()`, giving the artifact's real print styling rather than the dashboard's.

**Automated: 272/272** (was 270). `emit-all-in-one.test.js` updated to the new shape: four cards
(three open a panel, Step Guide is download-only with no panel), the Word links now assert *inside*
the Step Guide card and *absent* from the Worked Example, exactly one dashboard `#lang-toggle`, and a
Print button per panel wired to its own iframe.

**In-browser (dev server, real demo, ~1.1 MB):**
- Renders to the new mockup: Interactive Walkthrough / Step Guide (flat, Word EN/FR) / Worked Example
  (no Word links) / Quick Reference; the three panel cards carry the light background, Step Guide is
  flat.
- Open a panel → a Back + **Print** bar; the Print button calls the iframe's own `print()` (verified
  by stubbing it), and the embedded artifact's **own toggle is hidden**.
- **One control:** toggling the single top-right button switched the dashboard header, the Back/Print
  bar ("Retour au menu" / "Imprimer"), AND the open walkthrough (steps, viewer, buttons) to French,
  and back — every iframe followed, including closed panels.
- axe in the real browser (contrast): dashboard **0/0**; open panel **0 violations**, one incomplete
  `frame-tested` — axe cannot cross into the srcdoc iframe, so it flags the embedding, not a defect;
  the embedded artifact is axe-clean on its own (its emitter's tests). Expected for iframe embedding.

### 2026-07-24 — Built; automated PASS, browser PASS

**Automated: 270/270** (was 262). 8 new in `emit-all-in-one.test.js`: one self-contained document;
header carries the title; three cards link to three panels that exist; each panel embeds its artifact
whole in a titled iframe (asserted by a marker unique to each emitter); two base64 `.docx` links named
`_EN`/`_FR`; the Word links sit in the worked-example card, not their own; card titles carry both
languages; axe clean. One test-writing snag fixed: `axe.run` returns arrays from the jsdom realm, so
`deepStrictEqual` faulted two *empty* arrays for differing prototypes — assert on `.length`, as the
other a11y tests do.

**In-browser (dev server, real demo):** built the dashboard from the demo project file (**~1.1 MB** —
about 4× the 0.27 MB project, since three artifacts each inline the screenshots plus two `.docx`;
expected and acceptable for a bundle) and rendered it.
- Renders to the mockup: header + Français toggle, three cards (Interactive Walkthrough / Worked
  Example / Quick Reference), "Use when" lines, and "Download Word file: English Français" under the
  Worked Example.
- Clicking a card reveals that artifact (`:target`): the menu hides and the walkthrough appears in its
  iframe **with its own header, its own toggle, the step rail, and the screenshot** — fully isolated.
  "Back to menu" returns.
- The dashboard's own toggle switches all chrome to French (title "Test du son de Windows", cards
  "Visite interactive / Exemple pratique / Référence rapide", "Télécharger le fichier Word :"),
  independently of the iframes.
- axe in the real browser (contrast included): **0 violations, 0 incomplete**. Card links and Word
  links keyboard-focusable with a visible focus ring; the `.docx` link is named
  `TestingWindowsAudio_Steps_EN.docx`, matching the standalone Word export.
- Export gate: the button is disabled until the capture is worked-example-ready, then enabled — the
  same gate as the Worked Example, because the all-in-one contains it.

**Re-verified on the live site (2026-07-24), after push.** `a42a03f` deployed to Pages; the app was
loaded fresh (cache-busted) and the dashboard built from the *deployed* `emit-all-in-one.js` against
the live demo. Same cycle passed: renders to the mockup; the export button is enabled once the demo
loads; a card reveals its artifact in the iframe and back-to-menu returns; both Word links are base64
`.docx` named `TestingWindowsAudio_Steps_EN.docx` and `TestDuSonDeWindows_Steps_FR.docx` (the FR name
correctly uses the French title); the toggle swaps all chrome to French. axe was local-only (dev-only
axe-core is not deployed) but on assets byte-identical to the live build.

**Outstanding:** no screen-reader pass (`help.md` 6). Status stays **awaiting verification**.

## Notes & Decisions
- **`<iframe srcdoc>`, not inlined sections.** The whole point of the tool's artifacts is that each is
  a finished, self-contained document; embedding them whole preserves that and sidesteps every
  collision. `escapeHtml` already escapes `"`, so a full document drops safely into the attribute.
- **Gated on the Worked Example, not general readiness.** "All in one" should mean *all*; gating on
  the strictest input guarantees no card is ever missing or broken. A looser gate would have forced
  per-card conditional logic and a decision about where the Word links go when the worked example is
  absent — avoided entirely.
- **Size is the honest cost.** Bundling multiplies the inlined image payload. Acceptable for a
  download; if it ever bites, the lever is shared image storage across the embedded artifacts, which
  the iframe isolation currently trades away on purpose.

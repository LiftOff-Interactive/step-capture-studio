# Failed Approaches

Append-only graveyard. Every dead end gets an entry so nobody pays for it twice. **Never prune this
file** — `handoff.md` links here instead of carrying the stories itself.

Format:

```markdown
## <date> — <What we tried>
**Why it failed:** <root cause> · **Do instead:** <the working direction, if known>
```

---


## 2026-07-21 — Using `focusId: null` as a "ignore current focus" sentinel
**Why it failed:** `??` treats `null` as nullish, so `focusId ?? document.activeElement?.id` fell
straight through to the active element — the exact opposite of the intent. After merging or deleting
a step, focus stayed on whichever button had last been pressed instead of moving to the affected
step. Silent, and invisible to anyone using a mouse. ·
**Do instead:** use an explicit boolean flag (`preserveFocus: false`). Never encode "absent" as
`null` when `??`/`||` will see it — reserve nullish for genuinely absent values.

## 2026-07-21 — Updating a model without syncing the control that displays it
**Why it failed:** editing alt text correctly reset `altConfirmed` in the model, but the confirm
checkbox was left ticked because field edits deliberately skip a re-render (re-rendering would yank
focus out of the field being typed in). The UI therefore asserted a confirmation the author had
never given — in the one feature whose entire purpose is a confirmation gate. Tests passed
throughout: they checked the model, and the model was right. ·
**Do instead:** when skipping a re-render for focus reasons, sync the specific affected control by
id (`fieldId(...)` is exported from `editor.js` for this). And treat "the model is correct" as
insufficient evidence — check what the user can actually see.

## 2026-07-21 — Putting a live region inside a container that gets rebuilt
**Why it failed:** the first instinct for announcing the readiness count was to give the summary
`role="status"` where it already sat — inside `#readiness-body`, which `replaceChildren` rebuilds on
every edit. A live region that is created at the same moment its content changes is **not
announced**: assistive tech only reports changes to regions already present in the accessibility
tree. The page would look completely correct and announce nothing, and no visual check would reveal
it. ·
**Do instead:** keep the live region as a persistent element outside anything that gets rebuilt, and
update only its `textContent`. Make it structural rather than a convention — `readinessSummaryText()`
returns a *string*, so no caller is able to rebuild the node even by accident. Add `aria-atomic="true"`
whenever only part of a message changes, or a screen reader may announce the bare digit with no context.

## 2026-07-21 — Trusting axe `color-contrast` results from a zero-size viewport
**Why it failed:** an axe run reported 31 `color-contrast` results as "incomplete — unable to
determine contrast ratio", across elements that had not been touched in weeks. It looked exactly
like a CSS regression from the panel just added. The real cause: the browser pane had collapsed to
`0x0`, so nothing had layout and axe could not measure any background. Chasing it as a styling bug
would have meant "fixing" CSS that was never broken. ·
**Do instead:** assert `innerWidth`/`innerHeight` are non-zero before trusting any layout-dependent
axe rule. A sudden crop of `incomplete` results on untouched elements is a measurement failure, not
a code failure — check the viewport first.

## 2026-07-21 — Assigning identical textContent to a live region
**Why it failed:** `role="alert"` only fires on a DOM mutation. Setting the same string again is not
a mutation, so a user who made the same mistake twice — pasting bad input, correcting nothing,
pasting again — got silence the second time. Precisely when they most needed confirmation that
something had happened. ·
**Do instead:** clear the region (`textContent = ''`) before setting the new message, exactly as the
polite status region already did. Any live region written to more than once needs this.

## 2026-07-21 — Generated text left out of the language switch
**Why it failed:** `applyStaticStrings` re-translates everything carrying `data-i18n`, which covers
markup but not text generated at runtime. Error messages are generated, so a francophone who hit an
error and then switched language kept reading English. ·
**Do instead:** keep generated text as data (`state.lastError = {code, vars}`) rather than as a
rendered string, and regenerate it on every language change. If a string is not in the DOM with a
`data-i18n` attribute, something has to re-render it deliberately.

## 2026-07-21 — Autosaving over a draft that had not been restored yet
**Why it failed:** on load, the app saves a draft. If a draft was already waiting for its file and
the author dropped the *wrong* file, the mismatch was reported correctly — and then the autosave
timer fired and overwrote the waiting draft with the wrong capture. Dropping the wrong file
destroyed the work autosave existed to protect. The code comment two lines above literally called
this outcome unforgivable. ·
**Do instead:** suspend autosave entirely while a draft is pending. Saving resumes only once the
draft is restored or deliberately discarded. Where a feature protects something, enumerate every
path that writes to it — the guard belongs at the write, not at the decision that precedes it.

## 2026-07-21 — `display: none` on an empty live region
**Why it failed:** `.status:empty { display: none }` existed to avoid a blank gap. Once the status
element's fallback text moved into JS, it started life empty — and therefore `display: none`, which
removes it from the accessibility tree. Since a live region that re-enters the tree at the same
moment it gains content is not announced, the first message after every empty state would have been
silent. The same rule had just been added for `#save-state`, reproducing the bug immediately. ·
**Do instead:** never `display: none` (or `visibility: hidden`) a live region. Collapse its margin
if the gap is the problem. This is the third variant of the same trap in this project — a live
region must exist, and keep existing, before its content changes.

## 2026-07-21 — `data-i18n` on the status live region
**Why it failed:** `applyStaticStrings` rewrites every `data-i18n` element on each render. The
status region carried `data-i18n="status.empty"`, so any announcement made just before a re-render
was silently overwritten with "No capture loaded yet." The draft-mismatch warning never appeared. ·
**Do instead:** keep live regions out of the static-string sweep. Track the current message as
`{key, vars}` and re-translate it explicitly on a language change. Generated text — errors, the
draft banner, the status — all need this; if it is not in the DOM with `data-i18n`, something must
re-render it deliberately.

## 2026-07-21 — `loading="lazy"` on inlined screenshots
**Why it failed:** the walkthrough's images are data URIs, already present in the file, so deferring
them buys nothing — there is no network request to save. But a lazy image that is never scrolled
into view can print blank, and stayed undecoded entirely while its step was hidden by the viewer.
Caught only because a browser check reported `imagesDecoded: 0` against 10 inlined images. ·
**Do instead:** never lazy-load inlined images. `loading="lazy"` is a network optimisation; applying
it where there is no network trades a real risk for no benefit.

## 2026-07-21 — Unguarded `history.replaceState` in a click handler
**Why it failed:** the walkthrough's rail links update the fragment so a step can be linked to. In a
context with an opaque URL — an `about:srcdoc` iframe, some sandboxes — `replaceState` throws, and
because the call sat before the navigation it took the whole handler with it. The rail silently
stopped working: clicks did nothing at all. ·
**Do instead:** guard optional side effects so they cannot take the feature down with them. Keeping
the URL in sync is a nicety; changing the step is the feature, and it must happen either way.

## 2026-07-22 — `<dc:language>` in docProps/core.xml
**Why it failed:** including `<dc:language>en-CA</dc:language>` in the core properties part made Word
**discard the entire part**. A Word re-save came back with an empty `dc:title` AND an empty
`dc:creator`, so nothing in core.xml was being read — and the document title is an explicit Word
Accessibility Checker requirement. Nothing about the file looked wrong: it was well-formed XML, the
content type and relationship type were correct, and the element was in schema order. ·
**How it was found:** by bisection against Word 16.0 via COM, with a control proving Word *does*
preserve these fields when re-saving its own files (so the measurement was sound). Two plausible
fixes — matching Word's exact core.xml shape, and using Word's `rId1/2/3` relationship convention —
changed nothing. Removing `dc:language` fixed it outright. ·
**Do instead:** never put `dc:language` in core.xml. The document language belongs in `w:lang` on
runs and in `docDefaults`, which Word reads correctly (it reports LanguageID 4105 for en-CA, 3084
for fr-CA). A regression test in `test/emit-docx.test.js` asserts the element is absent. ·
**Wider lesson:** "well-formed and schema-plausible" is not "accepted". For a format defined by
someone else's parser, the parser is the specification — and a silent discard looks exactly like
success until something downstream is missing.

## 2026-07-22 — Omitting `word/settings.xml` to keep the package minimal
**Why it failed:** the package deliberately shipped only the parts "genuinely required", on the
reasoning that every part omitted is one that cannot be got subtly wrong. But Word infers the format
era from `compatibilityMode` in `settings.xml`, and with the part **absent** it assumes the 2007 era
and opens the document in **Compatibility Mode**. One of the functions Word limits in that mode is
the **Accessibility Checker**, which it disables outright. So the export could not satisfy its own
accessibility criterion by any amount of human care — the checker could not be run on our file at
all, only on a converted copy of it. Every structural test passed throughout. ·
**How it was found:** by a human trying to run the checker and reporting the message they had to
click through — *"This document is in an older format with limited functionality."* The prompt was
treated as noise on the way to the real task; it **was** the finding. Confirmed by
`Document.CompatibilityMode` over COM, which reports 12/14 for compatibility mode and 15 for
Word 2013+. ·
**Do instead:** emit `word/settings.xml` with `compatibilityMode` = 15, plus its content-type
override and a relationship from `document.xml` — a part that is present but unreferenced is inert.
Pinned by a regression test that asserts all three. ·
**Wider lesson:** the sibling of the `dc:language` defect above, and the more dangerous direction.
There, a part we *added* was silently discarded. Here, a part we *omitted* silently changed how the
consumer interpreted everything else. **Minimalism is not neutral: absence is an input.** Ask not
only "can this part be malformed?" but "what does the consumer assume when it is missing?"
**And when a human reports friction on the way to a verification, that friction is data** — the
result obtained after clicking through a conversion prompt is a result about a different file.

## 2026-07-22 — Rendering artifact chrome with `t(key, languages[0])`
**Why it failed:** the emitters rendered step text per language through `langBlock`, but headings,
button labels and the metadata line were resolved **once** against `languages[0]`. Toggling to
French swapped the content and left every label in English. The French translations were present in
`i18n.js` the whole time — they were simply being asked for in the wrong language, so nothing looked
missing from either the dictionary or the tests. The case study had the same bug in a worse place:
`altFor(image, primary)` meant every image described itself in English in French mode — a WCAG 1.1.1
failure that axe cannot catch, because axe checks that alt text *exists*, not what language it is
in. Printing cannot reveal it either. ·
**How it was found:** by the author reading the French output and listing six "still in English"
items across three artifacts — which turned out to be one bug, not six. ·
**Do instead:** use `langLabel()` from `emit-common.js` for every user-facing string in an emitter.
It renders real `lang-block`s, so chrome swaps with the toggle and both languages still show with
JavaScript disabled. Pinned by per-heading symmetry assertions; note that *content* is legitimately
asymmetric (an unwritten French explanation is omitted, not blanked), so symmetry is asserted on
chrome only. ·
**Wider lesson:** a bilingual document is not proven by the presence of both languages somewhere in
it. The tests counted lang-blocks and found them; they never asked whether the *labels* were among
them.

## 2026-07-22 — A control whose `disabled` state only updates on re-render
**Why it failed:** the new per-step verification checkbox is disabled while any alt text in the step
is empty, because the model refuses to confirm empty alt text and offering the control would be
offering something that silently does nothing. But `onAlt` deliberately does **not** re-render —
re-rendering would pull focus out of the field being typed in. So filling in the last empty alt
field left the checkbox disabled forever, and the step could never be verified. ·
**How it was found:** only by driving the real app and clicking the thing. **The suite passed
233/233 both before and after the fix** — it builds the editor in isolation and asserts on the
returned nodes, so it never exercises the in-place sync that `app.js` performs between renders. ·
**Do instead:** when a control is updated in place rather than rebuilt, sync *every* property that
depends on the model — `checked`, `disabled`, and any describing text — in one function
(`syncStepVerification`), not just the one that prompted the fix. ·
**Wider lesson:** "we chose not to re-render here" is a decision that has to be paid for at every
property, not just the obvious one. And an isolated builder test can be fully green while the live
UI is unusable — the same gap that `feature-app-shell.md` and the print checks keep re-teaching.

## 2026-07-22 — Driving Word by COM without process hygiene
**Why it failed:** a PowerShell script that errored mid-way left an invisible WINWORD process holding
a document open. Every subsequent `Documents.Open` blocked forever, and two 120-second tool timeouts
were burnt before the cause was obvious. ·
**Do instead:** run each Word interaction inside `Start-Job` with `Wait-Job -Timeout`, and always
kill leftover invisible instances afterwards (`MainWindowTitle` empty identifies automation
instances; never kill one with a title, which would be the user's own session). Check
`%APPDATA%\Microsoft\Word\*.asd` afterwards so a killed instance does not leave recovery prompts
behind for the user.

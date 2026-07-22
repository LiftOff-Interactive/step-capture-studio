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

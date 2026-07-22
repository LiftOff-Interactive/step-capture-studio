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

# Feature: autosave
_Stage: stage-2-authoring · Status: not started_

## Goal
Make authoring safe to do in more than one sitting. A 10-step capture needs 20+ hand-entered fields
once alt text and French are counted; losing that to an accidental refresh would make the tool
hostile to use.

## Success Criteria
- [ ] Edits persist to `localStorage` automatically, without an explicit save action.
- [ ] Closing the browser and reopening restores the draft — steps, edits, alt text, and French.
- [ ] The user is told when the draft was last saved, in text, not just an icon.
- [ ] An explicit "discard draft" action exists and requires confirmation.
- [ ] Exceeding the storage quota degrades gracefully with a clear warning — it never fails silently
      and never corrupts an existing draft.
- [ ] Screenshots are handled deliberately with respect to quota (see Open Questions).
- [ ] A draft from an older model version is either migrated or rejected with an explanation —
      never loaded into a shape the code no longer expects.

## How We'll Verify
1. `npm test` — save/restore round trip; quota-exceeded simulation; version-mismatch handling.
2. Manually: author several fields with the real sample, close the browser entirely, reopen, confirm
   everything is intact. Record exactly which fields were entered and which came back.
3. Fill storage to the quota and confirm the warning appears and the existing draft survives.
4. Confirm "discard" clears storage and cannot be triggered accidentally by keyboard.
5. axe-core zero violations; the save-status region must not be an intrusive `aria-live` announcement
   on every keystroke.

## Verification Log
_Empty. Cannot be `verified done` until dated evidence appears here._

## Open Questions
- **Do screenshots go in the draft?** `localStorage` is ~5 MB; the real sample's images alone are
  843 KB and one PNG is 343 KB. A larger capture would blow the quota immediately. Options: persist
  only text and require re-dropping the `.docx` on resume (simple, slightly annoying); or use
  IndexedDB for image bytes (no practical quota, more code). **Decide before writing this feature** —
  it changes the storage layer, not just a setting.
- Should multiple drafts be kept, or just one? One is simpler; multiple matters if authors work on
  several captures in a week. Assume one for v1.

## Notes & Decisions
Debounce writes — persisting on every keystroke will make the editor feel sluggish and will thrash
storage. Save on field blur plus a short idle timer.

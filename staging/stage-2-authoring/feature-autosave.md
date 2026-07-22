# Feature: autosave
_Stage: stage-2-authoring · Status: **REMOVED 2026-07-22** — superseded by `feature-project-file`_

## ⚠️ This feature was built, worked, and was then deliberately deleted

Autosave shipped and did its job: it was observed restoring a session across a page reload during
the 2026-07-22 working session. It was removed on the author's explicit instruction, after the
portable project file gave the tool an alternative way to preserve work.

**The two were not equivalent, and the difference was stated before the decision was made:**
autosave was *crash recovery* — automatic, requiring nothing of the author. The project file is
*portability* — explicit, requiring the author to remember to export. Closing the tab without
exporting now loses the session, with no warning and no recovery.

The author was told this plainly and chose it anyway; that is their call to make. It is recorded
here so that a future session finds the reasoning rather than assuming autosave was never built,
and so the cost is visible if the decision is ever revisited.

**What was deleted:** `src/lib/draft.js`, `test/draft.test.js`, the draft-pending and save-state UI,
the `draft.*` and storage-error strings, and `capture.fingerprint` in `parse-snagit.js` (which
existed only to reunite a draft with its source recording). All recoverable from git history at
`bcb68fa` if the decision is reversed.

---

_Original record below, unchanged._

## Goal
Make authoring safe to do in more than one sitting. A 10-step capture needs 20+ hand-entered fields
once alt text and French are counted; losing that to an accidental refresh would make the tool
hostile to use.

## Success Criteria
- [x] Edits persist to `localStorage` automatically, without an explicit save action.
- [x] Closing the browser and reopening restores the draft — steps, edits, alt text, and French.
- [x] The user is told when the draft was last saved, in text, not just an icon.
- [x] An explicit "discard draft" action exists and requires confirmation.
- [x] Exceeding the storage quota degrades gracefully with a clear warning — it never fails silently
      and never corrupts an existing draft.
- [x] Screenshots are handled deliberately with respect to quota (see Open Questions).
- [x] A draft from an older model version is either migrated or rejected with an explanation —
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

### 2026-07-21 - Built as text-only + re-drop; automated PASS, browser PASS

**Decision:** screenshots are not stored. The real capture's images are 843 KB against a ~5 MB quota,
so a longer recording would fail - and autosave that fails on large captures is worse than none,
because authors stop being careful once they believe their work is safe. The author re-drops the
same `.docx` to restore images. Measured draft size for the real 10-step capture: **3.3 KB**, with
no image bytes present.

**Automated: 129/129** (20 in `test/draft.test.js`). Fingerprint stability, no bytes stored, size
bound, round trip of text/alt/French, version mismatch, corrupt draft, quota and storage-unavailable
as distinct codes, quota failure leaving the previous draft intact, discard, rehydration, edits
surviving, wrong-file refusal, path-based matching across merge and delete, and immutability.

**The fingerprint design was itself a bug the tests caught.** It originally hashed step text - which
the author edits - so any edited draft could never be reunited with its own file. The API invited
that by taking the fingerprint as a parameter. It is now attached by the parser and carried forward
by every authoring operation, so it cannot be recomputed from an edited capture.

**In-browser (Chromium 148, real capture) - a genuine restart cycle:**
- Edited a step (EN + FR), confirmed an alt text, merged a duplicate -> draft saved, announced in text.
- **Reloaded the page.** Banner appeared: "Saved draft from ... - drop the same .docx file to continue".
- Re-dropped the file -> "Draft restored: 9 steps, 10 screenshots." Every edit back, the merge intact
  with both screenshots on the merged step, all 10 images decoded at 1040x596.
- **Dropped the WRONG file:** refused, explained, draft preserved **byte for byte** with its edit,
  banner still shown, autosave suspended, and the wrong file still usable.
- Discarded -> announced, storage cleared, autosave resumed on the next drop.
- Language toggle: banner, status and save state all follow, with correct Canadian French date
  formatting (`21 juill. 2026, 23 h 11`).
- axe at 1280x900: **0 violations, 0 incomplete**, both languages.

**Four defects found in the browser and fixed - none visible to the tests:**
1. **Dropping the wrong file destroyed the saved draft.** The autosave timer fired after the mismatch
   and overwrote the very work it existed to protect. Autosave is now suspended while a draft is
   pending, resuming only on restore or discard.
2. **The mismatch warning never appeared.** `#status` carried `data-i18n`, so `applyStaticStrings`
   overwrote any announcement made just before a re-render.
3. **`display: none` on the empty status region** removed a live region from the accessibility tree -
   the same trap as the readiness summary, in a third disguise.
4. **The draft banner and error text ignored the language toggle**, being generated rather than
   `data-i18n` markup. Both are now regenerated on language change.

Also fixed: a doubled period where a locale timestamp already ended in "p.m.".

**Still outstanding:** no screen-reader pass (`help.md` item 6). Nobody has visually looked at the
banner or save-state text.

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

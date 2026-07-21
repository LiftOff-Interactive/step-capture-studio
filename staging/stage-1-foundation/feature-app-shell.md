# Feature: app-shell
_Stage: stage-1-foundation · Status: not started_

## Goal
The page a user actually lands on: pick or drop a `.docx`, see the parsed capture rendered, and do
all of it by keyboard at WCAG 2.1 AA. This is where the project's accessibility floor is set — every
later UI inherits these patterns, so getting them right here is worth more than getting them fast.

## Success Criteria
- [ ] A user can load a capture by **both** a visible file input and drag-and-drop. Drag-and-drop is
      an enhancement only — the file input alone is fully sufficient (WCAG 2.1.1).
- [ ] Every interactive element is reachable by <kbd>Tab</kbd> in a logical order, with a focus
      indicator meeting 3:1 non-text contrast (WCAG 2.4.7, 1.4.11).
- [ ] Parse completion is announced to assistive tech via an `aria-live` region (WCAG 4.1.3).
- [ ] Errors are announced the same way and describe what to do next, never just what went wrong.
- [ ] The page has one `h1`, a correct heading hierarchy with no skipped levels, and a skip link
      (WCAG 1.3.1, 2.4.1).
- [ ] All text meets 4.5:1 contrast; UI components and focus rings meet 3:1 (WCAG 1.4.3, 1.4.11).
- [ ] The page reflows to a 320 px viewport with no horizontal scrolling (WCAG 1.4.10).
- [ ] `<html lang>` is set and updates when the language toggle changes (WCAG 3.1.1).
- [ ] Every user-facing string comes from `src/lib/i18n.js` in both `en-CA` and `fr-CA` — zero
      hardcoded text anywhere in the shell.
- [ ] Rendered steps show the screenshot at its native aspect ratio with the step text as **real
      text**, never baked into an image.
- [ ] Respects `prefers-reduced-motion`; no animation is required to understand state.
- [ ] Zero network requests after initial page load.

## How We'll Verify
1. `npm test` — axe-core (via jsdom) against the rendered shell in both empty and loaded states.
   Assert **zero violations**, not "no serious violations."
2. **Keyboard-only pass:** unplug the mouse. Tab through the entire flow — load a file, read the
   result, trigger an error. Confirm nothing is unreachable, nothing traps focus, and the focus ring
   is visible at every stop. Record what was tabbed through, in order.
3. **Contrast check:** verify every foreground/background pair against 4.5:1 (text) and 3:1
   (components) with an actual contrast tool. Record the measured ratios, not "looks fine."
4. **Reflow check:** DevTools at 320 px width. Confirm no horizontal scrollbar.
5. **Screen reader smoke test:** NVDA or Windows Narrator. Confirm the load control is announced with
   its purpose and the completion message is spoken.
6. **Network check:** DevTools Network tab, filter to XHR/Fetch, load a capture, confirm zero requests.
7. **Rendered demo:** screenshot the loaded state and show it to the user.

## Verification Log
_Empty. This feature cannot be marked `verified done` until dated evidence appears here._

## Open Questions
- Which browsers must this support? Assumed current Chrome/Edge as the primary target given a
  Windows-and-Edge environment, but no explicit requirement has been set. Affects how much
  `DecompressionStream` fallback work is justified.
- Is a screen reader available on the user's machine for criterion 5? If not, that check is blocked
  and the feature stays `awaiting verification` with an entry in `help.md` — it does not get quietly
  marked done. See CLAUDE.md.
- Does the departmental context impose a visual identity (Canada.ca / FIP) on tooling? Not assumed;
  the shell ships neutral and themeable.

## Notes & Decisions
Build the `aria-live` announcement plumbing now even though Stage 1 has little to announce. Stage 2's
alt-text gate and Stage 3's language toggle both depend on it, and bolting it on later means
re-testing every state.

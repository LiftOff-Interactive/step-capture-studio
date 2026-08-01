# step-capture-studio

Turn one Snagit step-capture `.docx` into ready-to-use, bilingual training artifacts — without
uploading anything, anywhere.

**→ [Try it](https://liftoff-interactive.github.io/step-capture-studio/)** — nothing to install, nothing uploaded.
No Snagit file handy? Click **“Try it with a sample capture”** on the page.

![The Step Capture Studio landing page: a “Load a file” panel to choose a Snagit .docx or resume a
saved project file, a “Try it with a sample capture” button, and a note that nothing is
uploaded.](docs/assets/screenshot-landing.png)

> **Status: live.** All outputs work and there is a built-in sample so you can try the whole flow
> without Snagit. A couple of verification steps still need a human — running Word’s own
> Accessibility Checker and a screen-reader pass (see [`help.md`](help.md)).

## What it does

Record a procedure once in Snagit, export it to Word, and drop that file here. You get back:

1. **Quick-steps guide** — a one-page cheat sheet for people who know the system and need a reminder.
2. **HTML walkthrough** — an interactive guide: a screenshot pane, an instruction box, and every step
   listed alongside, with keyboard navigation.
3. **Worked example** — a narrative artifact explaining *why* each step matters and what breaks if it
   is skipped, not just what to click.
4. **Word document** — an accessible `.docx`, one button per language (English and French), with real
   heading styles and alt text on every image.

The HTML artifacts are bilingual (English / French) in a single self-contained file you can email or
open offline — and they stay readable with JavaScript turned off. Everything targets **WCAG 2.1 AA**:
alt text must be confirmed before you can export, headings are real headings, and each language is
tagged so a screen reader pronounces it correctly.

## How it works

The editor walks through three phases, then exports:

1. **Worked example** — describe who the procedure is for and, per step, why it matters.
2. **Edit** — fix the auto-generated step text and write the alt text for each screenshot. Snagit
   often repeats itself and never includes alt text; this is where you put both right.
3. **Translation** — the tool builds a ready-to-paste prompt covering *every* field you have filled
   in (title, step text, alt text, and the worked-example explanations). Run it in whatever assistant
   you already use and paste the result back; the French comes in for you to review.

Then export any of the four artifacts. You can also **save your progress**: *Export project file*
writes a single self-contained `.html` with everything — screenshots included — that you reload later
with *Or resume a saved project file*.

## Your files never leave your computer

There is no server, no account, no API key, and no upload. The tool is a static page; your `.docx` is
parsed in your own browser using built-in browser APIs, and the results are generated there too. You
can disconnect from the network after the page loads and everything still works.

This is a hard design constraint, not a nicety — the tool was built for documenting internal systems
whose screenshots must not be transmitted anywhere.

## No AI runs inside the tool

The tool never calls a model. It converts your recording deterministically, then — for the parts a
machine genuinely cannot know, like *why* a step matters or how to say it in French — it builds a
prompt you run in your own assistant and paste back. Machine-drafted text is marked unreviewed and
cannot be exported until you confirm it, so nothing is invented behind your back.

## Requirements

- A current **Chromium browser (Chrome or Edge)**. The tool uses `DecompressionStream('deflate-raw')`
  to read `.docx` files; older or non-Chromium browsers are detected and told they are unsupported
  rather than failing silently.
- Optionally, a Snagit step capture exported to `.docx`. Without one, use the built-in sample.

Nothing to install.

## Development

No build step and no runtime dependencies: the site is plain ES modules served as-is, and pushing to
`main` deploys it to GitHub Pages. The `.docx` reader and writer are hand-written against
`DecompressionStream` / `CompressionStream` rather than a ZIP library.

```sh
npm install    # dev-only test tooling (node:test, jsdom, axe-core)
npm test       # parser, authoring, artifact, accessibility, and round-trip tests
```

The design decisions and the dead ends that shaped them are written up in
[`docs/decisions.md`](docs/decisions.md) and [`docs/failed-approaches.md`](docs/failed-approaches.md).

## Contributing

**Never commit a capture file or a screenshot of a real system.** The repository is public and the
source captures document internal systems. A pre-commit hook enforces this — it blocks capture and
document files by name *and* scans text files for embedded (base64) screenshots, because a generated
artifact or project file inlines every image. Only genuinely synthetic material belongs in
`assets/demo/` or `docs/assets/`. Never bypass the hook with `--no-verify`.

## Licence

[MIT](LICENSE) © 2026 Mike Bubyn.

<!--
`.nojekyll` disables GitHub Pages' Jekyll processing. This is a plain static
site with no build step; Jekyll would otherwise ignore any path beginning with
an underscore and was erroring on the legacy Pages builder.
-->

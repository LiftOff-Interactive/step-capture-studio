# step-capture-studio

Turn one Snagit step-capture `.docx` into three ready-to-use training artifacts — without uploading
anything, anywhere.

**→ [Try it](https://mbubyn.github.io/step-capture-studio/)** — nothing to install, nothing uploaded.

> **Status: pre-release.** All four outputs work. Still to come: a demo capture so you can try it
> without Snagit, and a few checks that need a human (see `help.md`).

## What it does

Record a procedure once in Snagit, export it to Word, and drop that file here. You get back:

1. **Quick-steps guide** — a one-page cheat sheet for people who know the system and need a reminder.
2. **HTML walkthrough** — an interactive guide: screenshot pane, instruction box, and every step
   listed alongside it.
3. **Case study** — a narrative artifact explaining *why* each step matters, not just what to click.
4. **Word document** — an accessible `.docx`, one per language, for people who live in Word.

The HTML artifacts are bilingual (English / French) in a single self-contained file you can email or
open offline — and they stay readable with JavaScript turned off. Everything targets WCAG 2.1 AA:
alt text is required before you can export, and the Word file carries real heading styles and alt
text on every image.

## Your files never leave your computer

There is no server, no account, no API key, and no upload. The tool is a static page; your `.docx` is
parsed in your own browser using built-in browser APIs, and the results are generated there too. You
can disconnect from the network after the page loads and everything still works.

This is a hard design constraint, not a feature — the tool was built for documenting internal systems
whose screenshots must not be transmitted anywhere.

## No AI runs inside the tool

The tool never calls a model. It converts your recording deterministically, then — for the parts a
machine genuinely cannot know, like *why* a step matters or how to say it in French — it builds a
ready-to-paste prompt you can run in whatever assistant you already use, and paste the result back.

You stay in control of what reaches your learners, and nothing is invented behind your back.

## Requirements

- A Snagit step capture exported to `.docx`
- A current browser (Chrome, Edge, Firefox, or Safari)

Nothing to install.

## Development

No build step and no runtime dependencies: the site is plain ES modules served as-is. The `.docx`
reader and writer are hand-written against `DecompressionStream`/`CompressionStream` rather than a
ZIP library.

```sh
npm install    # dev-only test tooling
npm test       # parser, authoring, artifact and accessibility tests
```

Contributions welcome once v1 ships. **Never commit a capture file or a screenshot of a real system** —
a pre-commit hook enforces this, and it exists for a reason.

## Licence

[MIT](LICENSE) © 2026 Mike Bubyn.

<!--
`.nojekyll` disables GitHub Pages' Jekyll processing. This is a plain static
site with no build step; Jekyll would otherwise ignore any path beginning with
an underscore and was erroring on the legacy Pages builder.
-->

/**
 * The portable project file — a working save, not a deliverable.
 *
 * The three artifacts are for readers. This one is for the author: a single
 * self-contained `.html` that carries the *whole* capture, can be opened and
 * read on any machine, hand-edited in a text editor, and loaded straight back
 * into the app.
 *
 * **Everything the model knows is in visible markup.** There is no JSON blob.
 * Confirmation flags, decorative markers and drafted-vs-authored state ride on
 * the elements they describe, as `data-` attributes, so the file can be read
 * back by parsing what is actually there — and a person editing it can see and
 * change every one of them. The alternative, a hidden state block, round-trips
 * just as well but quietly makes the visible document a lie: edit the prose and
 * nothing happens on import. Here the prose *is* the data.
 *
 * The pairing rule for `parse-project.js`: every attribute written here is read
 * there, and the round-trip test asserts a full capture survives unchanged.
 * Change one file and you must change the other.
 */

import {
  escapeHtml,
  toDataUri,
  localeTag,
  artifactName,
  captureTitle,
  LOCALE_TAGS,
} from './emit-common.js'
import { NARRATIVE_FIELDS, SCENARIO_FIELDS } from './case-study.js'

/** Bumped only when the shape changes incompatibly; the parser checks it. */
export const PROJECT_FORMAT_VERSION = '1'

const PROJECT_CSS = `
:root {
  --bg: #ffffff; --surface: #f4f6f8; --text: #1a1d21; --muted: #565b62;
  --accent: #0b5cab; --border-subtle: #d7dce2; --radius: 8px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14171a; --surface: #1e2226; --text: #eceef1; --muted: #b3b9c0;
    --accent: #7fb4ef; --border-subtle: #363c43;
  }
}
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0; padding: 0 1rem 3rem; background: var(--bg); color: var(--text);
  font: 1rem/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
}
main, header { max-width: 60rem; margin-inline: auto; }
h1, h2, h3 { line-height: 1.25; margin: 0 0 .5rem; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

.banner {
  background: var(--surface); border-left: 4px solid var(--accent);
  border-radius: var(--radius); padding: .75rem 1rem; margin: 1rem 0 2rem;
}
.banner p { margin: .25rem 0; }

.project-steps { list-style: none; margin: 0; padding: 0; }
.project-step {
  padding: 1.5rem 0; border-top: 1px solid var(--border-subtle);
}
.project-step img {
  display: block; width: 100%; height: auto; max-width: 40rem;
  border: 1px solid var(--border-subtle); border-radius: var(--radius);
}
figure { margin: 0 0 1rem; }
figcaption { margin-top: .5rem; }
.label {
  font-size: .8rem; text-transform: uppercase; letter-spacing: .04em;
  color: var(--muted); margin: 1rem 0 .25rem;
}
[data-lang-block] { margin: .15rem 0; }
[data-confirmed="false"], [data-drafted="true"] { border-left: 3px solid var(--muted); padding-left: .5rem; }
.flag { font-size: .8rem; color: var(--muted); }
@media print { body { padding: 0; } }
`.trim()

/** One language's copy of a field, carrying whatever state belongs to it. */
function block(code, text, extra = {}) {
  const attrs = Object.entries(extra)
    .map(([key, value]) => ` ${key}="${escapeHtml(String(value))}"`)
    .join('')
  return (
    `<div data-lang-block="${code}" lang="${localeTag(code)}"${attrs}>` +
    `${escapeHtml(text ?? '')}</div>`
  )
}

/**
 * Render a capture as a portable project file.
 *
 * @param {object} capture
 * @returns {string} a complete, self-contained HTML document
 */
export function emitProject(capture) {
  const languages = capture.languages ?? ['en']
  // Resolved per language so the file is readable, plus the raw map below so
  // an unauthored language round-trips as genuinely empty rather than as the
  // fallback text.
  const titles = Object.fromEntries(languages.map((code) => [code, captureTitle(capture, code)]))
  const title = titles[languages[0]]
  const rawTitle = typeof capture.title === 'string' ? { [capture.sourceLang ?? languages[0]]: capture.title } : capture.title ?? {}

  const scenario = capture.scenario ?? {}
  const scenarioBlocks = SCENARIO_FIELDS.map((field) => {
    const bodies = languages.map((code) => block(code, scenario[field]?.[code])).join('')
    return `    <div class="scenario-field" data-scenario-field="${field}">
      <p class="label">${escapeHtml(field)}</p>
${bodies}
    </div>`
  }).join('\n')

  const steps = capture.steps
    .map((step) => {
      const figures = step.images
        .map((image) => {
          // Alt text is shown, not hidden in an attribute: in a working file
          // the author needs to *see* what each screenshot claims to say.
          const captions = languages
            .map((code) =>
              block(code, image.alt?.[code], {
                'data-field': 'alt',
                'data-confirmed': String(Boolean(image.altConfirmed?.[code])),
              })
            )
            .join('')

          const dims =
            image.width && image.height
              ? ` data-width="${image.width}" data-height="${image.height}"`
              : ''

          return `      <figure data-image-id="${escapeHtml(image.id)}"${
            image.path ? ` data-image-path="${escapeHtml(image.path)}"` : ''
          } data-decorative="${String(Boolean(image.decorative))}"${dims}>
        <img src="${toDataUri(image.bytes)}" alt="${escapeHtml(
          image.decorative ? '' : image.alt?.[capture.sourceLang] ?? ''
        )}" decoding="sync">
        <figcaption class="alt-text"><p class="label">alt text</p>${captions}</figcaption>
      </figure>`
        })
        .join('\n')

      const texts = languages
        .map((code) => block(code, step.text?.[code], { 'data-field': 'text' }))
        .join('')

      const notes = NARRATIVE_FIELDS.map((field) => {
        const bodies = languages
          .map((code) => {
            const passage = step.narrative?.[field]?.[code]
            return block(code, passage?.text, {
              'data-drafted': String(Boolean(passage?.drafted)),
            })
          })
          .join('')
        return `      <div class="note" data-narrative-field="${field}">
        <p class="label">${escapeHtml(field)}</p>
${bodies}
      </div>`
      }).join('\n')

      return `    <li class="project-step" data-step-index="${step.index}">
      <h2>Step ${step.index}</h2>
${figures}
      <div class="step-text"><p class="label">step text</p>${texts}</div>
${notes}
    </li>`
    })
    .join('\n')

  // Capture-level metadata lives on <html>, where it cannot be confused with
  // any step's own attributes.
  const root =
    `<html lang="${localeTag(languages[0])}"` +
    ` data-project="step-capture-studio"` +
    ` data-project-version="${PROJECT_FORMAT_VERSION}"` +
    ` data-source-lang="${escapeHtml(capture.sourceLang ?? languages[0])}"` +
    ` data-languages="${escapeHtml(languages.join(' '))}"` +
    ` data-capture-title="${escapeHtml(title)}"` +
    languages
      .map((code) => ` data-title-${code}="${escapeHtml(rawTitle[code] ?? '')}"`)
      .join('') +
    ` data-author="${escapeHtml(capture.author ?? '')}"` +
    ` data-date="${escapeHtml(capture.date ?? '')}"` +
    ` data-created-at="${escapeHtml(capture.createdAt ?? '')}"` +
    ` data-duration="${escapeHtml(capture.duration ?? '')}"` +
    ` data-declared-step-count="${escapeHtml(
      capture.declaredStepCount == null ? '' : String(capture.declaredStepCount)
    )}">`

  return `<!doctype html>
${root}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(artifactName(title, 'Project'))}</title>
<style>
${PROJECT_CSS}
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <div class="banner">
    <p><strong>This is a project file, not a finished guide.</strong></p>
    <p>Load it back into Step Capture Studio with <em>Import project</em> to carry on working.
       You can edit any text below in a plain text editor and the changes will come back with it.</p>
    <p class="flag">Boxes marked unconfirmed still need checking before the guide can be exported.</p>
  </div>
</header>
<main>
  <section class="scenario">
    <h2>About this procedure</h2>
${scenarioBlocks}
  </section>

  <ol class="project-steps">
${steps}
  </ol>
</main>
</body>
</html>
`
}

export { LOCALE_TAGS }

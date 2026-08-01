/**
 * Artifact 1 — the quick-steps cheat sheet.
 *
 * For someone who already knows the system and needs the sequence, not the
 * explanation. Terse, scannable, and printable on one page: no screenshots by
 * default, since a thumbnail per step is what pushes it to three pages.
 *
 * Both languages are rendered side by side in print, which is genuinely useful
 * on a bilingual desk and costs nothing — the content is already there for the
 * no-JavaScript case.
 */

import {
  escapeHtml,
  langBlock,
  langLabel,
  artifactName,
  captureTitle,
  renderDocument,
  documentHeader,
} from './emit-common.js'
import { t } from './i18n.js'
import { brandingCss, brandingLogo } from './branding.js'

const QUICK_CSS = `
.quick-list { counter-reset: step; list-style: none; padding: 0; margin: 1.5rem 0 0; }
.quick-list > li {
  counter-increment: step;
  display: grid; grid-template-columns: 2.25rem 1fr; gap: .75rem;
  padding: .45rem 0; border-bottom: 1px solid var(--border-subtle);
  max-width: none;
}
.quick-list > li::before {
  content: counter(step) ".";
  font-variant-numeric: tabular-nums; font-weight: 700; color: var(--muted);
  text-align: right;
}
.quick-step__text { font-size: 1rem; }
.quick-empty { color: var(--muted); font-style: italic; }

/* One page is the whole point of this artifact. */
@media print {
  @page { margin: 12mm; }
  body { font-size: 10.5pt; }
  h1 { font-size: 16pt; }
  .quick-list > li { padding: .2rem 0; break-inside: avoid; }
  .doc-header { padding-top: 0; }
}
`.trim()

/**
 * @param {object} capture   a fully authored capture
 * @param {object} [options]
 * @param {string[]} [options.languages] language codes; first is the default
 */
export function emitQuickSteps(capture, { languages = capture.languages ?? ['en'] } = {}) {
  const primary = languages[0]

  const items = capture.steps
    .map((step) => {
      const blocks = languages
        .map((code) => {
          const text = step.text?.[code]
          return text?.trim()
            ? langBlock(code, escapeHtml(text), { className: 'quick-step__text' })
            : langBlock(
                code,
                `<span class="quick-empty">${escapeHtml(t('step.noText', code))}</span>`,
                { className: 'quick-step__text' }
              )
        })
        .join('\n      ')
      return `    <li>\n      <div>${blocks}</div>\n    </li>`
    })
    .join('\n')

  const title = captureTitle(capture, primary)
  const titles = Object.fromEntries(languages.map((code) => [code, captureTitle(capture, code)]))
  // An author may have overridden the displayed count (declaredStepCount);
  // fall back to the real number of steps when they have not.
  const meta = {
    author: capture.author,
    date: capture.date,
    stepCount: capture.declaredStepCount ?? capture.steps.length,
  }

  const body = `${documentHeader({ title, titles, meta, languages, logo: brandingLogo(capture, primary) })}
<main>
  <h2 class="visually-hidden">${langLabel('steps.heading', languages)}</h2>
  <ol class="quick-list">
${items}
  </ol>
</main>`

  return renderDocument({
    branding: brandingCss(capture),
    title,
    docTitle: artifactName(title, 'QuickStep'),
    languages,
    body,
    css: QUICK_CSS,
  })
}

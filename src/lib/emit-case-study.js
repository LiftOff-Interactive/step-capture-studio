/**
 * Artifact 3 — the case study.
 *
 * Context and reasoning, not just clicks: the scenario the author supplied,
 * then each step with its screenshot, what it does, why it matters, and what
 * breaks if it is skipped.
 *
 * **This emitter refuses to render unreviewed text.** Anything a model drafted
 * and nobody confirmed throws rather than being written out. The export gate
 * in the UI should already have prevented it; this is the second lock, because
 * an artifact that silently launders a machine guess into apparent authority
 * is the specific failure this whole feature exists to avoid.
 *
 * Fields the author left empty are simply omitted. An absent explanation
 * claims nothing, which is always safe; an unchecked one is not.
 */

import { escapeHtml, langBlock, toDataUri, altFor, renderDocument, documentHeader } from './emit-common.js'
import { t } from './i18n.js'
import { NARRATIVE_FIELDS, SCENARIO_FIELDS, caseStudyReadiness, hasNarrative } from './case-study.js'

const CASE_STUDY_CSS = `
.scenario { background: var(--surface); border: 1px solid var(--border-subtle);
  border-radius: var(--radius); padding: 1.25rem; margin: 1.5rem 0 2rem; }
.scenario dl { display: grid; gap: .35rem 1rem; margin: 0; }
@media (min-width: 40rem) { .scenario dl { grid-template-columns: auto 1fr; } }
.scenario dt { font-weight: 700; color: var(--muted); }
.scenario dd { margin: 0; }

.case-steps { list-style: none; margin: 0; padding: 0; }
.case-step { padding: 0 0 2.5rem; max-width: none; }
.case-step + .case-step { border-top: 1px solid var(--border-subtle); padding-top: 2rem; }
.case-step h3 { font-size: 1.15rem; }
.case-step figure { margin: 0 0 1rem; }
.case-step img { display: block; width: 100%; height: auto; max-width: 46rem;
  border: 1px solid var(--border-subtle); border-radius: var(--radius); }
.case-action { padding: .75rem 1rem; background: var(--surface);
  border-left: 4px solid var(--accent); border-radius: var(--radius); margin-bottom: 1rem; }
.case-note { margin: 0 0 1rem; }
.case-note h4 { font-size: .9rem; text-transform: uppercase; letter-spacing: .04em;
  color: var(--muted); margin: 0 0 .25rem; }

@media print {
  .case-step { break-inside: avoid; }
  .scenario { break-inside: avoid; }
}
`.trim()

/**
 * @param {object} capture   a fully authored capture
 * @param {object} [options]
 * @param {string[]} [options.languages] language codes; first is the default
 */
export function emitCaseStudy(capture, { languages = capture.languages ?? ['en'] } = {}) {
  const primary = languages[0]

  // Second lock. The UI gate is the first; this one makes it impossible to
  // produce the artifact by any other path.
  const readiness = caseStudyReadiness(capture, languages)
  if (!readiness.ready) {
    const where = readiness.blockers
      .map((b) => `step ${b.stepIndex} ${b.field} (${b.lang})`)
      .join(', ')
    throw new Error(`refusing to emit unreviewed drafted narrative: ${where}`)
  }
  if (!hasNarrative(capture, languages)) {
    throw new Error('refusing to emit a case study with no explanations')
  }

  const scenario = capture.scenario ?? {}
  const scenarioRows = SCENARIO_FIELDS.filter((field) =>
    languages.some((code) => scenario[field]?.[code]?.trim())
  )
    .map((field) => {
      const labels = languages
        .map((code) => langBlock(code, escapeHtml(t(`caseStudy.${field}`, code)), { tag: 'span' }))
        .join('')
      const values = languages
        .filter((code) => scenario[field]?.[code]?.trim())
        .map((code) => langBlock(code, escapeHtml(scenario[field][code].trim())))
        .join('')
      return `      <dt>${labels}</dt>\n      <dd>${values}</dd>`
    })
    .join('\n')

  const scenarioBlock = scenarioRows
    ? `  <section class="scenario" aria-labelledby="scenario-heading">
    <h2 id="scenario-heading">${escapeHtml(t('caseStudy.scenarioHeading', primary))}</h2>
    <dl>
${scenarioRows}
    </dl>
  </section>`
    : ''

  const steps = capture.steps
    .map((step) => {
      const heading = languages
        .map((code) =>
          langBlock(
            code,
            escapeHtml(t('step.label', code, { index: step.index, total: capture.steps.length })),
            { tag: 'span' }
          )
        )
        .join('')

      const figures = step.images
        .map((image) => {
          const dims = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : ''
          return `      <figure><img src="${toDataUri(image.bytes)}" alt="${escapeHtml(altFor(image, primary))}"${dims} decoding="sync"></figure>`
        })
        .join('\n')

      const action = languages
        .map((code) => langBlock(code, escapeHtml(step.text?.[code]?.trim() || t('step.noText', code))))
        .join('')

      // Omit a note entirely when nobody wrote one — an absent explanation
      // claims nothing, which is the honest default.
      const notes = NARRATIVE_FIELDS.map((field) => {
        const written = languages.filter((code) => step.narrative?.[field]?.[code]?.text?.trim())
        if (!written.length) return ''
        const labels = languages
          .map((code) => langBlock(code, escapeHtml(t(`caseStudy.${field}`, code)), { tag: 'span' }))
          .join('')
        const bodies = written
          .map((code) => langBlock(code, escapeHtml(step.narrative[field][code].text.trim())))
          .join('')
        return `      <div class="case-note">\n        <h4>${labels}</h4>\n        ${bodies}\n      </div>`
      })
        .filter(Boolean)
        .join('\n')

      return `    <li class="case-step">
      <h3>${heading}</h3>
${figures}
      <div class="case-action">${action}</div>
${notes}
    </li>`
    })
    .join('\n')

  const title = capture.title || t('capture.untitled', primary)
  const subtitle = [capture.author, capture.date].filter(Boolean).join(' · ')

  const body = `${documentHeader({ title, subtitle, languages })}
<main>
${scenarioBlock}
  <h2>${escapeHtml(t('caseStudy.heading', primary))}</h2>
  <ol class="case-steps">
${steps}
  </ol>
</main>`

  return renderDocument({ title, languages, body, css: CASE_STUDY_CSS })
}

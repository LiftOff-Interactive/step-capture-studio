/**
 * The "all in one" dashboard — every artifact in a single self-contained file.
 *
 * A launcher page with the same header as the other artifacts (title, author,
 * date, language toggle) and a card per output. Each HTML artifact is embedded
 * *whole* in an isolated `<iframe srcdoc>`, so it keeps its own styling, its own
 * bilingual toggle, and its interactivity with zero collision — the dashboard
 * cannot restyle a walkthrough by accident, and two artifacts cannot fight over
 * an id. The Word document rides along as base64 download links.
 *
 * Reveal is CSS-only, via `:target`: a card is a link to its panel, the panel
 * is hidden until targeted, and the menu collapses while one is open. So it
 * works with JavaScript disabled — the cards become in-page jumps to the
 * artifacts stacked below — and needs no script of its own beyond the shared
 * language toggle.
 *
 * This is the one emitter that composes the others, which is inherent: it *is*
 * their sum. It is async only because the Word document is (`emitDocx` builds a
 * zip). The caller gates it exactly like the worked example — the strictest of
 * the artifacts — so everything it bundles is guaranteed exportable.
 */

import {
  escapeHtml,
  langBlock,
  langLabel,
  artifactName,
  captureTitle,
  renderDocument,
  documentHeader,
  toDataUri,
} from './emit-common.js'
import { t, LANGUAGE_NAMES } from './i18n.js'
import { emitWalkthrough } from './emit-walkthrough.js'
import { emitCaseStudy } from './emit-case-study.js'
import { emitQuickSteps } from './emit-quick-steps.js'
import { emitDocx } from './emit-docx.js'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const AIO_CSS = `
.aio-menu { margin-top: 1.5rem; }
.aio-grid {
  display: grid; gap: 1.5rem; margin: 0; padding: 0; list-style: none;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.aio-card {
  display: flex; flex-direction: column; gap: .5rem; padding: 1.25rem;
  border: 1px solid var(--border-subtle); border-radius: var(--radius);
  background: var(--surface);
}
.aio-card > *, .aio-card p { max-width: none; }
.aio-card__open {
  display: flex; flex-direction: column; align-items: center; gap: .85rem;
  text-decoration: none; color: inherit;
}
.aio-card__open:hover .aio-card__title,
.aio-card__open:focus-visible .aio-card__title { text-decoration: underline; }
.aio-card__icon {
  width: 96px; height: 80px; border-radius: 14px; background: var(--accent);
}
.aio-card__title { font-size: 1.15rem; font-weight: 700; text-align: center; }
.aio-card__desc, .aio-card__usewhen, .aio-word {
  text-align: center; margin: 0; font-size: .95rem;
}
.aio-card__usewhen em { font-style: italic; }
.aio-word { margin-top: .35rem; }
.aio-word a { color: var(--accent); font-weight: 600; }
.aio-word a + a { margin-left: .5rem; }

/* CSS-only reveal. Panels are hidden until the URL targets one; the menu
   collapses while a panel is open (progressive — without :has the menu simply
   stays visible above the stacked panel). */
.aio-panel { display: none; }
.aio-panel:target { display: block; margin-top: 1.5rem; }
body:has(.aio-panel:target) .aio-menu { display: none; }
.aio-back {
  display: inline-block; min-height: 44px; padding: .5rem 1rem; margin-bottom: 1rem;
  color: var(--accent); text-decoration: none;
  border: 1px solid var(--border); border-radius: var(--radius);
}
.aio-frame {
  width: 100%; height: 82vh; background: var(--bg);
  border: 1px solid var(--border-subtle); border-radius: var(--radius);
}

@media print {
  /* A launcher does not print; each artifact prints on its own. */
  .aio-frame, .aio-back { display: none; }
  .aio-panel:target { display: none; }
  .aio-menu { display: block !important; }
}
`.trim()

/** One "Use when: …" line, per language, so it swaps with the toggle. */
function useWhenLine(useWhenKey, languages) {
  const spans = languages
    .map((code) =>
      langBlock(
        code,
        `<em>${escapeHtml(t('allInOne.useWhen', code))}</em> ${escapeHtml(t(useWhenKey, code))}`,
        { tag: 'span' }
      )
    )
    .join('')
  return `<p class="aio-card__usewhen">${spans}</p>`
}

/** A card whose title/icon link opens the artifact panel below. */
function card(panelId, keys, languages, extra = '') {
  return `      <li>
        <article class="aio-card">
          <a class="aio-card__open" href="#panel-${panelId}">
            <span class="aio-card__icon" aria-hidden="true"></span>
            <span class="aio-card__title">${langLabel(keys.title, languages, { tag: 'span' })}</span>
          </a>
          <p class="aio-card__desc">${langLabel(keys.desc, languages, { tag: 'span' })}</p>
          ${useWhenLine(keys.useWhen, languages)}
          ${extra}
        </article>
      </li>`
}

/** A revealed panel: a back link and the artifact, isolated in an iframe. */
function panel(panelId, titleKey, artifactHtml, languages, primary) {
  const label = escapeHtml(t(titleKey, primary))
  return `  <section id="panel-${panelId}" class="aio-panel" tabindex="-1" aria-label="${label}">
    <a class="aio-back no-print" href="#aio-menu">${langLabel('allInOne.back', languages, { tag: 'span' })}</a>
    <iframe class="aio-frame" title="${label}" srcdoc="${escapeHtml(artifactHtml)}"></iframe>
  </section>`
}

/**
 * @param {object} capture   a fully authored, worked-example-ready capture
 * @param {object} [options]
 * @param {string[]} [options.languages] language codes; first is the default
 */
export async function emitAllInOne(capture, { languages = capture.languages ?? ['en'] } = {}) {
  const primary = languages[0]
  const title = captureTitle(capture, primary)
  const titles = Object.fromEntries(languages.map((code) => [code, captureTitle(capture, code)]))
  const meta = {
    author: capture.author,
    date: capture.date,
    stepCount: capture.declaredStepCount ?? capture.steps.length,
  }

  // The three HTML artifacts, each a complete document.
  const walkthroughHtml = emitWalkthrough(capture, { languages })
  const workedExampleHtml = emitCaseStudy(capture, { languages })
  const quickHtml = emitQuickSteps(capture, { languages })

  // The Word document, one per language, as base64 download links.
  const wordLinks = []
  for (const code of languages) {
    const bytes = await emitDocx(capture, { lang: code })
    const name = `${artifactName(captureTitle(capture, code), 'Steps')}_${code.toUpperCase()}.docx`
    wordLinks.push(
      `<a class="aio-word__link" download="${escapeHtml(name)}" href="${toDataUri(bytes, DOCX_MIME)}">${escapeHtml(LANGUAGE_NAMES[code] ?? code)}</a>`
    )
  }
  const wordBlock = `<p class="aio-word">${langLabel('allInOne.downloadWord', languages, { tag: 'span' })} ${wordLinks.join(' ')}</p>`

  const body = `${documentHeader({ title, titles, meta, languages })}
<main id="aio-top">
  <div id="aio-menu" class="aio-menu">
    <h2 class="visually-hidden">${langLabel('allInOne.chooseFormat', languages, { tag: 'span' })}</h2>
    <ul class="aio-grid">
${card('walkthrough', { title: 'allInOne.walkthrough.title', desc: 'allInOne.walkthrough.desc', useWhen: 'allInOne.walkthrough.useWhen' }, languages)}
${card('worked-example', { title: 'allInOne.workedExample.title', desc: 'allInOne.workedExample.desc', useWhen: 'allInOne.workedExample.useWhen' }, languages, wordBlock)}
${card('quick-reference', { title: 'allInOne.quickReference.title', desc: 'allInOne.quickReference.desc', useWhen: 'allInOne.quickReference.useWhen' }, languages)}
    </ul>
  </div>
${panel('walkthrough', 'allInOne.walkthrough.title', walkthroughHtml, languages, primary)}
${panel('worked-example', 'allInOne.workedExample.title', workedExampleHtml, languages, primary)}
${panel('quick-reference', 'allInOne.quickReference.title', quickHtml, languages, primary)}
</main>`

  return renderDocument({
    title,
    docTitle: artifactName(title, 'AllInOne'),
    languages,
    body,
    css: AIO_CSS,
  })
}

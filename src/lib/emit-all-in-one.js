/**
 * The "all in one" dashboard — every artifact in a single self-contained file.
 *
 * A launcher page with the same header as the other artifacts (title, author,
 * date, language toggle) and a card per output. The three HTML artifacts each
 * open in-page in an isolated `<iframe srcdoc>`, so each keeps its own styling
 * and interactivity with zero collision. The **Step Guide** card is different:
 * it is download-only — the Word document (EN/FR) — with no panel to reveal.
 *
 * Reveal is CSS-only, via `:target`: an "open" card is a link to its panel, the
 * panel is hidden until targeted, and the menu collapses while one is open. So
 * it works with JavaScript disabled — the cards become in-page jumps to the
 * artifacts stacked below.
 *
 * A small controller script adds two things that need JavaScript:
 *   - **One language control.** The dashboard's single toggle drives the whole
 *     page AND every embedded artifact (srcdoc iframes are same-origin, so their
 *     language can be set directly); each artifact's own toggle is hidden.
 *   - **A Print button** on each sub-page that prints just that artifact, using
 *     the artifact's own print styling.
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
  border-radius: 18px;
}
/* Cards that open an artifact get the light panel; the download-only Step Guide
   card stays flat, so the two behaviours read differently at a glance. */
.aio-card--panel { background: var(--surface); }
.aio-card > *, .aio-card p { max-width: none; }
.aio-card__head {
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
.aio-panel__bar { display: flex; gap: .75rem; align-items: center; margin-bottom: 1rem; }
.aio-back, .aio-print {
  display: inline-block; min-height: 44px; padding: .5rem 1rem; font: inherit;
  color: var(--accent); text-decoration: none; cursor: pointer;
  background: none; border: 1px solid var(--border); border-radius: var(--radius);
}
.aio-frame {
  width: 100%; height: 82vh; background: var(--bg);
  border: 1px solid var(--border-subtle); border-radius: var(--radius);
}

@media print {
  /* Printing the dashboard prints nothing useful; each artifact is printed from
     its own Print button, which prints the iframe with the artifact's styling. */
  .aio-frame, .aio-panel__bar { display: none; }
  .aio-panel:target { display: none; }
  .aio-menu { display: block !important; }
}
`.trim()

/*
 * One control for the whole page. LANG_TOGGLE_JS drives the dashboard's own
 * toggle and announces every change on the document; this mirrors that into the
 * embedded artifacts and silences their toggles, and wires the Print buttons.
 * No template literals or backticks in here — it lives inside one.
 */
const AIO_SCRIPT = `
(function () {
  var root = document.documentElement;
  var locales = JSON.parse(root.getAttribute('data-locales') || '{}');
  function frames() { return Array.prototype.slice.call(document.querySelectorAll('.aio-frame')); }

  function applyToFrame(frame, lang) {
    var doc = frame.contentDocument;
    if (!doc || !doc.documentElement) return;
    var btn = doc.getElementById('lang-toggle');
    if (btn) btn.hidden = true;
    doc.documentElement.setAttribute('data-lang', lang);
    doc.documentElement.setAttribute('lang', locales[lang] || lang);
    doc.dispatchEvent(new CustomEvent('artifact:langchange', { detail: { lang: lang } }));
  }

  function syncAll(lang) { frames().forEach(function (f) { applyToFrame(f, lang); }); }

  // The dashboard toggle announces every change; carry it into the artifacts.
  document.addEventListener('artifact:langchange', function (e) {
    if (e && e.detail && e.detail.lang) syncAll(e.detail.lang);
  });

  // Each artifact adopts the dashboard's language as soon as it is available.
  frames().forEach(function (f) {
    var adopt = function () { applyToFrame(f, root.getAttribute('data-lang') || 'en'); };
    f.addEventListener('load', adopt);
    if (f.contentDocument && f.contentDocument.readyState === 'complete') adopt();
  });

  // Print the open artifact, with its own print styling, not the dashboard.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.aio-print') : null;
    if (!btn) return;
    var panel = document.getElementById(btn.getAttribute('data-panel'));
    var frame = panel && panel.querySelector('.aio-frame');
    if (frame && frame.contentWindow) frame.contentWindow.print();
  });
})();
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

/** The icon + title block, shared by both card kinds. */
function cardHead(titleKey, languages) {
  return `<span class="aio-card__icon" aria-hidden="true"></span>
            <span class="aio-card__title">${langLabel(titleKey, languages, { tag: 'span' })}</span>`
}

/** A card whose title/icon link opens the artifact panel below. */
function openCard(panelId, keys, languages) {
  return `      <li>
        <article class="aio-card aio-card--panel">
          <a class="aio-card__head aio-card__open" href="#panel-${panelId}">
            ${cardHead(keys.title, languages)}
          </a>
          <p class="aio-card__desc">${langLabel(keys.desc, languages, { tag: 'span' })}</p>
          ${useWhenLine(keys.useWhen, languages)}
        </article>
      </li>`
}

/** The download-only card: no panel, no reveal — just the Word links. */
function downloadCard(keys, languages, wordBlock) {
  return `      <li>
        <article class="aio-card aio-card--download">
          <div class="aio-card__head">
            ${cardHead(keys.title, languages)}
          </div>
          <p class="aio-card__desc">${langLabel(keys.desc, languages, { tag: 'span' })}</p>
          ${useWhenLine(keys.useWhen, languages)}
          ${wordBlock}
        </article>
      </li>`
}

/** A revealed panel: a bar (back + print) and the artifact, isolated in an iframe. */
function panel(panelId, titleKey, artifactHtml, languages, primary) {
  const label = escapeHtml(t(titleKey, primary))
  return `  <section id="panel-${panelId}" class="aio-panel" tabindex="-1" aria-label="${label}">
    <div class="aio-panel__bar no-print">
      <a class="aio-back" href="#aio-menu">${langLabel('allInOne.back', languages, { tag: 'span' })}</a>
      <button type="button" class="aio-print" data-panel="panel-${panelId}">${langLabel('allInOne.print', languages, { tag: 'span' })}</button>
    </div>
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

  const walkthroughKeys = {
    title: 'allInOne.walkthrough.title',
    desc: 'allInOne.walkthrough.desc',
    useWhen: 'allInOne.walkthrough.useWhen',
  }
  const stepGuideKeys = {
    title: 'allInOne.stepGuide.title',
    desc: 'allInOne.stepGuide.desc',
    useWhen: 'allInOne.stepGuide.useWhen',
  }
  const workedExampleKeys = {
    title: 'allInOne.workedExample.title',
    desc: 'allInOne.workedExample.desc',
    useWhen: 'allInOne.workedExample.useWhen',
  }
  const quickKeys = {
    title: 'allInOne.quickReference.title',
    desc: 'allInOne.quickReference.desc',
    useWhen: 'allInOne.quickReference.useWhen',
  }

  const body = `${documentHeader({ title, titles, meta, languages })}
<main id="aio-top">
  <div id="aio-menu" class="aio-menu">
    <h2 class="visually-hidden">${langLabel('allInOne.chooseFormat', languages, { tag: 'span' })}</h2>
    <ul class="aio-grid">
${openCard('walkthrough', walkthroughKeys, languages)}
${downloadCard(stepGuideKeys, languages, wordBlock)}
${openCard('worked-example', workedExampleKeys, languages)}
${openCard('quick-reference', quickKeys, languages)}
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
    script: AIO_SCRIPT,
  })
}

/**
 * Artifact 2 — the interactive HTML walkthrough. The one learners actually use.
 *
 * One DOM serves both modes, which is what keeps the no-JavaScript state
 * honest rather than a stub:
 *
 *   - **Without scripting:** a navigation list of every step followed by every
 *     step in full — screenshot, instruction, both languages. The rail links
 *     are ordinary fragment anchors, so jumping to a step works natively.
 *   - **With scripting:** the same markup becomes a two-pane viewer. All but
 *     the current step is hidden, the rail gains `aria-current`, Previous/Next
 *     and arrow keys appear, and the fragment stays in sync so a link to
 *     `#step-4` still lands on step 4.
 *
 * The fragment is what reconciles deep-linking with the no-JS fallback — the
 * open question in the feature file. The same URL works in both modes because
 * the step ids are real ids on real elements.
 *
 * Alt text is swapped by script from `data-alt-*` attributes rather than
 * emitting one image per language: duplicating a data URI would double the
 * file size and decode every screenshot twice. Without scripting the image
 * carries the primary language's alt text, which is a deliberate, documented
 * trade rather than an oversight.
 */

import { escapeHtml, langBlock, toDataUri, altFor, renderDocument, documentHeader, localeTag } from './emit-common.js'
import { t } from './i18n.js'

const WALKTHROUGH_CSS = `
.viewer { display: grid; gap: 1.5rem; margin-top: 1.5rem; }
@media (min-width: 60rem) {
  .viewer { grid-template-columns: 17rem minmax(0, 1fr); align-items: start; }
  html.js .rail { position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto; }
}

.rail h2 { font-size: 1rem; color: var(--muted); }
.rail ol { list-style: none; margin: 0; padding: 0; }
.rail li + li { margin-top: .15rem; }
.rail a {
  display: block; padding: .5rem .6rem; border-radius: var(--radius);
  color: inherit; text-decoration: none; border-left: 4px solid transparent;
  min-height: 44px;
}
.rail a:hover { background: var(--surface); }
/* Current step: border weight, background, weight AND aria-current — never
   colour alone (WCAG 1.4.1). */
.rail a[aria-current="step"] {
  background: var(--surface); border-left-color: var(--accent); font-weight: 700;
}
.rail a[aria-current="step"]::before { content: "▸ "; color: var(--accent); }
.rail-index { color: var(--muted); font-variant-numeric: tabular-nums; }

.steps { list-style: none; margin: 0; padding: 0; }
.step { padding: 0 0 2rem; max-width: none; }
.step:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }
.step h3 { font-size: .95rem; color: var(--muted); margin-bottom: .35rem; }
.step figure { margin: 0 0 .85rem; }
.step img {
  display: block; width: 100%; height: auto; max-width: 60rem;
  border: 1px solid var(--border-subtle); border-radius: var(--radius); background: var(--bg);
}
.step__instruction {
  padding: .85rem 1rem; background: var(--surface);
  border: 1px solid var(--border-subtle); border-left: 4px solid var(--accent);
  border-radius: var(--radius); font-size: 1.05rem;
}

.step-nav { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-top: 1rem; }
.step-nav button {
  min-height: 44px; padding: .5rem 1rem; font: inherit; cursor: pointer;
  color: var(--on-accent); background: var(--accent);
  border: 1px solid var(--accent); border-radius: var(--radius);
}
.step-nav button[disabled] { opacity: .55; cursor: default; }
.step-progress { margin: 0; color: var(--muted); font-variant-numeric: tabular-nums; }

/* Enhanced mode only: show one step at a time. */
html.js .step[hidden] { display: none; }
html:not(.js) .step { border-bottom: 1px solid var(--border-subtle); }

@media print {
  .rail, .step-nav { display: none !important; }
  .step { break-inside: avoid; }
  html.js .step[hidden] { display: block !important; }
}
`.trim()

const WALKTHROUGH_JS = `
(function () {
  var root = document.documentElement;
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  if (!steps.length) return;

  var links = Array.prototype.slice.call(document.querySelectorAll('.rail a'));
  var prev = document.getElementById('step-prev');
  var next = document.getElementById('step-next');
  var progress = document.getElementById('step-progress');
  var current = 0;

  function template() {
    return progress.getAttribute('data-template-' + (root.getAttribute('data-lang') || 'en')) || 'Step {index} of {total}';
  }

  function show(index, moveFocus) {
    current = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach(function (step, i) { step.hidden = i !== current; });
    links.forEach(function (link, i) {
      if (i === current) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    prev.disabled = current === 0;
    next.disabled = current === steps.length - 1;
    progress.textContent = template()
      .replace('{index}', String(current + 1))
      .replace('{total}', String(steps.length));
    if (moveFocus) steps[current].focus();
  }

  function indexFromHash() {
    var id = (location.hash || '').replace('#', '');
    for (var i = 0; i < steps.length; i++) if (steps[i].id === id) return i;
    return -1;
  }

  links.forEach(function (link, i) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      // Keeping the fragment truthful is a nicety; navigating is the feature.
      // replaceState throws in contexts with an opaque URL (an about:srcdoc
      // iframe, some sandboxes), and an unguarded call there killed the click
      // handler outright — the rail simply stopped working.
      try {
        history.replaceState(null, '', '#' + steps[i].id);
      } catch (e) {
        /* URL cannot be updated here; navigation still must work */
      }
      show(i, true);
    });
  });

  prev.addEventListener('click', function () { show(current - 1, true); });
  next.addEventListener('click', function () { show(current + 1, true); });

  document.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var tag = (event.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); show(current - 1, true); }
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); show(current + 1, true); }
    else if (event.key === 'Home') { event.preventDefault(); show(0, true); }
    else if (event.key === 'End') { event.preventDefault(); show(steps.length - 1, true); }
  });

  window.addEventListener('hashchange', function () {
    var i = indexFromHash();
    if (i >= 0) show(i, true);
  });

  // Alt text is per-language; swap it the moment the language changes.
  function syncAlt() {
    var lang = root.getAttribute('data-lang') || 'en';
    Array.prototype.forEach.call(document.querySelectorAll('.step img'), function (img) {
      var value = img.getAttribute('data-alt-' + lang);
      if (value !== null) img.setAttribute('alt', value);
    });
    // The progress string is language-specific too.
    if (progress.textContent) show(current, false);
  }
  document.addEventListener('artifact:langchange', syncAlt);
  syncAlt();

  root.className += ' js';
  prev.hidden = false;
  next.hidden = false;
  show(Math.max(indexFromHash(), 0), false);
})();
`.trim()

/**
 * @param {object} capture   a fully authored capture
 * @param {object} [options]
 * @param {string[]} [options.languages] language codes; first is the default
 */
export function emitWalkthrough(capture, { languages = capture.languages ?? ['en'] } = {}) {
  const primary = languages[0]
  const total = capture.steps.length

  const railItems = capture.steps
    .map((step) => {
      const labels = languages
        .map((code) =>
          langBlock(code, escapeHtml(step.text?.[code] ?? t('step.noText', code)), { tag: 'span' })
        )
        .join('')
      return `      <li><a href="#step-${step.index}"><span class="rail-index">${step.index}.</span> ${labels}</a></li>`
    })
    .join('\n')

  const stepItems = capture.steps
    .map((step) => {
      const heading = languages
        .map((code) =>
          langBlock(code, escapeHtml(t('step.label', code, { index: step.index, total })), { tag: 'span' })
        )
        .join('')

      const figures = step.images
        .map((image) => {
          const altAttrs = languages
            .map((code) => `data-alt-${code}="${escapeHtml(altFor(image, code))}"`)
            .join(' ')
          const dims = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : ''
          // No loading="lazy". The bytes are already inline, so deferring gains
          // nothing — and a lazy image that was never scrolled into view can
          // come out blank when printed, or stay undecoded while its step is
          // hidden. Both are silent failures in the artifact learners receive.
          return `        <figure><img src="${toDataUri(image.bytes)}" alt="${escapeHtml(altFor(image, primary))}" ${altAttrs}${dims} decoding="sync"></figure>`
        })
        .join('\n')

      const instruction = languages
        .map((code) => {
          const text = step.text?.[code]
          return langBlock(code, escapeHtml(text?.trim() || t('step.noText', code)))
        })
        .join('')

      return `      <li class="step" id="step-${step.index}" tabindex="-1" aria-labelledby="step-${step.index}-heading">
        <h3 id="step-${step.index}-heading">${heading}</h3>
${figures}
        <div class="step__instruction">${instruction}</div>
      </li>`
    })
    .join('\n')

  // Both language templates travel with the element so the script can rebuild
  // the progress string without carrying a translation table of its own.
  const progressTemplates = languages
    .map((code) => `data-template-${code}="${escapeHtml(t('step.label', code, { index: '{index}', total: '{total}' }))}"`)
    .join(' ')

  const title = capture.title || t('capture.untitled', primary)
  const subtitle = [capture.author, capture.date].filter(Boolean).join(' · ')

  const body = `${documentHeader({ title, subtitle, languages })}
<main>
  <div class="viewer">
    <nav class="rail" aria-labelledby="rail-heading">
      <h2 id="rail-heading">${escapeHtml(t('steps.heading', primary))}</h2>
      <ol>
${railItems}
      </ol>
    </nav>

    <div>
      <ol class="steps">
${stepItems}
      </ol>

      <div class="step-nav">
        <button type="button" id="step-prev" hidden>${escapeHtml(t('walkthrough.previous', primary))}</button>
        <button type="button" id="step-next" hidden>${escapeHtml(t('walkthrough.next', primary))}</button>
        <p class="step-progress" id="step-progress" role="status" aria-live="polite" ${progressTemplates}></p>
      </div>
    </div>
  </div>
</main>`

  return renderDocument({ title, languages, body, css: WALKTHROUGH_CSS, script: WALKTHROUGH_JS })
}

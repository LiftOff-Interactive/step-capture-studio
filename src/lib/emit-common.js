/**
 * Shared machinery for the three artifact emitters.
 *
 * Every artifact is a single self-contained HTML file: screenshots inlined as
 * data URIs, CSS and JS embedded, no external request of any kind. It has to
 * open from a USB stick, survive being emailed, and print sensibly.
 *
 * **Progressive enhancement is a hard requirement, not a nicety.** The content
 * must be readable with JavaScript disabled — for printing, for archiving, and
 * for locked-down managed browsers. So both languages are rendered into the
 * document, and the default stylesheet shows *both*. JavaScript then sets
 * `data-lang` on the root, which hides the inactive one. Disable scripting and
 * you get a bilingual document rather than a blank page.
 */

import { t } from './i18n.js'

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escape for HTML text and double-quoted attribute values alike. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])
}

/**
 * The image format of a byte array, from its signature — never its filename.
 *
 * Everything downstream used to assume PNG: `data:image/png`, `image{n}.png`,
 * `ContentType="image/png"`. Snagit usually emits PNG, but a capture with a
 * JPEG in it would then produce broken data URIs and a `.docx` Word could
 * reject, because the bytes and the label disagreed. The consumer is the spec,
 * so read what the bytes actually are.
 *
 * @returns {{mime: string, ext: string}}
 */
export function imageType(bytes) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) {
    return { mime: 'image/png', ext: 'png' }
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpeg' }
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' }
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { mime: 'image/gif', ext: 'gif' }
  }
  // Fall back to PNG rather than throw: the parser already vets what it accepts,
  // and a wrong-but-plausible label is what this function exists to prevent, not
  // to reintroduce at the boundary.
  return { mime: 'image/png', ext: 'png' }
}

/**
 * Bytes -> data URI.
 *
 * The MIME type is detected from the bytes when not given, so a JPEG is never
 * served as `data:image/png` (which some engines refuse to decode).
 *
 * Chunked deliberately: `String.fromCharCode(...bytes)` overflows the argument
 * limit and throws on anything above a few hundred kilobytes, and these are
 * full-resolution screenshots.
 */
export function toDataUri(bytes, mime = imageType(bytes).mime) {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64')
  return `data:${mime};base64,${base64}`
}

/**
 * The capture's title in one language.
 *
 * Falls back to the source language rather than to the placeholder: a French
 * artifact showing the English title is imperfect, but showing "Untitled
 * capture" when a title plainly exists is worse.
 *
 * Tolerates a plain string, which is what `capture.title` was before it became
 * bilingual — project files and tests written against the old shape still load.
 */
export function captureTitle(capture, lang) {
  const title = capture?.title
  if (typeof title === 'string') return title.trim() || t('capture.untitled', lang)
  return (
    title?.[lang]?.trim() ||
    title?.[capture?.sourceLang]?.trim() ||
    t('capture.untitled', lang)
  )
}

/**
 * PascalCase, ASCII-safe stem for an artifact name: "Testing Windows Audio"
 * becomes "TestingWindowsAudio".
 *
 * Accents are folded rather than dropped (é -> e) so a French title still
 * yields a readable name that is safe on every filesystem and in a URL.
 */
export function nameStem(title, fallback = 'Capture') {
  const stem = String(title ?? '')
    .normalize('NFD')
    // Combining diacritics, written as escapes so the source stays ASCII-safe.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
  return stem || fallback
}

/**
 * The name an artifact is known by — used for BOTH the download filename and
 * the document `<title>`.
 *
 * These must agree: browsers derive the print header and the "Save as PDF"
 * filename from `<title>`, not from the name the file was downloaded under.
 * Deriving both from one function is what stops a file called
 * `TestingWindowsAudio_CaseStudy.html` printing to `Testing Windows Audio.pdf`.
 */
export function artifactName(title, suffix) {
  return `${nameStem(title)}_${suffix}`
}

/** BCP 47 tags. Kept here so emitted artifacts never hardcode a language pair. */
export const LOCALE_TAGS = { en: 'en-CA', fr: 'fr-CA' }

export const localeTag = (code) => LOCALE_TAGS[code] ?? code

/**
 * A run of text in one language, tagged so assistive tech pronounces it
 * correctly and so the toggle can hide it.
 */
export function langBlock(code, html, { tag = 'div', className = '' } = {}) {
  const classes = ['lang-block', `lang-block--${code}`, className].filter(Boolean).join(' ')
  return `<${tag} class="${classes}" lang="${localeTag(code)}" data-lang-block="${code}">${html}</${tag}>`
}

/** Base stylesheet shared by every artifact. Light and dark, print-aware. */
export const BASE_CSS = `
:root {
  --bg: #ffffff; --surface: #f4f6f8; --text: #1a1d21; --muted: #565b62;
  --accent: #0b5cab; --on-accent: #ffffff; --border: #6b7280; --border-subtle: #d7dce2;
  --radius: 8px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14171a; --surface: #1e2226; --text: #eceef1; --muted: #b3b9c0;
    --accent: #7fb4ef; --on-accent: #10131a; --border: #8b939c; --border-subtle: #363c43;
  }
}
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0; padding: 0 1rem 3rem; background: var(--bg); color: var(--text);
  font: 1rem/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
}
main, header { max-width: 60rem; margin-inline: auto; }
h1, h2, h3 { line-height: 1.25; margin: 0 0 .5rem; }
h1 { font-size: clamp(1.4rem, 1.1rem + 1.2vw, 2rem); }
p, li { max-width: 68ch; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

/* In the accessibility tree, absent from the page. Never display:none. */
.visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
}

.doc-header {
  display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-start;
  justify-content: space-between; padding: 1.5rem 0 1rem;
  border-bottom: 1px solid var(--border-subtle);
}
.doc-meta { color: var(--muted); margin: 0; font-size: .9rem; }

.lang-toggle {
  min-height: 44px; padding: .5rem 1rem; font: inherit; cursor: pointer;
  color: var(--accent); background: none;
  border: 1px solid var(--border); border-radius: var(--radius);
}

/*
 * No JavaScript: no data-lang, so BOTH languages render. The document stays
 * fully readable rather than half-empty. Once JS sets data-lang, the inactive
 * language is hidden.
 */
html[data-lang="en"] [data-lang-block="fr"],
html[data-lang="fr"] [data-lang-block="en"] { display: none; }

/* Chrome blocks are inline spans so they sit inside a heading. With no
 * JavaScript both languages render, and margin-top does nothing to an inline
 * box — the two ran together as "StepsEtapes" and "6 stepsTraining Tester".
 * Stack them explicitly; this is also the print path.
 * (No backticks in this comment — it lives inside a template literal.) */
html:not([data-lang]) .lang-block { display: block; }
html:not([data-lang]) .lang-block + .lang-block { margin-top: .35rem; }
html:not([data-lang]) .lang-toggle { display: none; }

@media print {
  body { padding: 0; }
  .lang-toggle, .no-print { display: none !important; }
  a[href]::after { content: ""; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important; transition-duration: .01ms !important;
  }
}
`.trim()

/** The language toggle, and only that. Everything else works without it. */
export const LANG_TOGGLE_JS = `
(function () {
  var root = document.documentElement;
  var order = JSON.parse(root.getAttribute('data-languages') || '[]');
  if (order.length < 2) return;
  var tags = JSON.parse(root.getAttribute('data-locales') || '{}');
  var names = JSON.parse(root.getAttribute('data-language-names') || '{}');
  var button = document.getElementById('lang-toggle');
  if (!button) return;

  function apply(code) {
    root.setAttribute('data-lang', code);
    root.setAttribute('lang', tags[code] || code);
    var next = order[(order.indexOf(code) + 1) % order.length];
    button.textContent = names[next] || next;
    button.setAttribute('aria-label', button.textContent);
    // Synchronous, explicit contract for artifact scripts that must react —
    // swapping per-language alt text, for instance. An earlier version observed
    // the attribute with MutationObserver, which fires a microtask later; that
    // left the alt text momentarily describing the wrong language.
    document.dispatchEvent(new CustomEvent('artifact:langchange', { detail: { lang: code } }));
  }

  // Only now does the document become monolingual; without this it shows both.
  apply(order[0]);
  button.hidden = false;
  button.addEventListener('click', function () {
    var current = root.getAttribute('data-lang');
    apply(order[(order.indexOf(current) + 1) % order.length]);
  });
})();
`.trim()

/**
 * A translated piece of *chrome* — a heading, a button label, a field name —
 * rendered once per language so it swaps with the toggle.
 *
 * ⚠️ **Never render chrome with `t(key, primary)`.** That was the original bug:
 * step text was correctly emitted per language via `langBlock`, but headings
 * and buttons were resolved once against `languages[0]`. Toggling to French
 * swapped the content and left every label in English. The translations were
 * never missing — they were being asked for in the wrong language.
 *
 * Because these are real `lang-block`s, they also do the right thing with
 * JavaScript disabled: both languages show, like the rest of the document.
 *
 * @param {string} key         i18n key
 * @param {string[]} languages language codes
 * @param {object} [options]
 * @param {string} [options.tag]    wrapper element; `span` for inline labels
 * @param {object} [options.params] interpolation params passed through to `t`
 */
export function langLabel(key, languages, { tag = 'span', params = {} } = {}) {
  return languages
    .map((code) => langBlock(code, escapeHtml(t(key, code, params)), { tag }))
    .join('')
}

/**
 * Wrap body content in a complete, self-contained HTML document.
 *
 * @param {object} options
 * @param {string} options.title       document title, already plain text
 * @param {string} [options.docTitle]  what goes in `<title>`; defaults to `title`.
 *   This is deliberately separable: the `<h1>` should read as prose, while
 *   `<title>` carries the artifact name so the printed PDF is filed correctly.
 * @param {string[]} options.languages language codes, first is the default
 * @param {string} options.body        body HTML
 * @param {string} [options.css]       artifact-specific CSS, appended to BASE_CSS
 * @param {string} [options.script]    artifact-specific JS, appended to the toggle
 */
export function renderDocument({ title, docTitle, languages, body, css = '', script = '' }) {
  const names = Object.fromEntries(languages.map((code) => [code, code === 'fr' ? 'Français' : 'English']))
  const locales = Object.fromEntries(languages.map((code) => [code, localeTag(code)]))

  return `<!doctype html>
<html lang="${localeTag(languages[0])}"
      data-languages="${escapeHtml(JSON.stringify(languages))}"
      data-locales="${escapeHtml(JSON.stringify(locales))}"
      data-language-names="${escapeHtml(JSON.stringify(names))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(docTitle || title)}</title>
<style>
${BASE_CSS}
${css}
</style>
</head>
<body>
${body}
<script>
${LANG_TOGGLE_JS}
${script}
</script>
</body>
</html>
`
}

/**
 * Header shared by the artifacts: title, metadata, and the toggle.
 *
 * The metadata line is built here rather than by each emitter, because all
 * three built the identical string and all three built it in one language.
 * Author and date are language-neutral; only the word "steps" is translated.
 *
 * @param {object} options
 * @param {string} options.title       document title, plain text — the fallback
 *   when no per-language map is supplied
 * @param {object} [options.titles]    `{ en, fr }` resolved titles. When given,
 *   the heading is rendered per language like any other content, so it swaps
 *   with the toggle instead of being fixed to `languages[0]`.
 * @param {object} [options.meta]      `{ author, date, stepCount }`, all optional
 * @param {string[]} options.languages language codes
 */
export function documentHeader({ title, titles = null, meta = null, languages }) {
  const toggle =
    languages.length > 1
      ? `<button type="button" id="lang-toggle" class="lang-toggle" hidden>Français</button>`
      : ''

  const subtitle = meta
    ? languages
        .map((code) => {
          const parts = [
            meta.author,
            meta.date,
            meta.stepCount != null
              ? `${meta.stepCount} ${t('capture.stepCount', code).toLowerCase()}`
              : null,
          ].filter(Boolean)
          return parts.length ? langBlock(code, escapeHtml(parts.join(' · ')), { tag: 'span' }) : ''
        })
        .join('')
    : ''

  // The title is content, not chrome, so it gets real lang-blocks — but only
  // when the languages actually differ.
  //
  // Where one language has no title, `captureTitle` falls back to the other, so
  // both blocks would carry identical text. Two lang-blocks then render the
  // same words twice with JavaScript disabled, which is also the print view:
  // "Testing Windows AudioTesting Windows Audio". A single untagged heading is
  // correct in that case — it is the same title in both languages.
  const resolved = titles ? languages.map((code) => titles[code] ?? title) : null
  const allSame = resolved ? resolved.every((value) => value === resolved[0]) : true

  const heading =
    resolved && !allSame
      ? languages
          .map((code) => langBlock(code, escapeHtml(titles[code] ?? title), { tag: 'span' }))
          .join('')
      : escapeHtml(resolved ? resolved[0] : title)

  return `<header class="doc-header">
  <div>
    <h1>${heading}</h1>
    ${subtitle ? `<p class="doc-meta">${subtitle}</p>` : ''}
  </div>
  ${toggle}
</header>`
}

/**
 * The alt text an image should carry in a given language.
 *
 * A decorative image gets `alt=""` — explicitly empty, never missing, so
 * assistive tech skips it deliberately rather than announcing a filename.
 * Unconfirmed alt text is refused: the export gate should already have stopped
 * this, and silently shipping a draft would defeat the gate entirely.
 */
export function altFor(image, lang) {
  if (image.decorative) return ''
  const text = image.alt?.[lang]
  if (!text?.trim()) {
    throw new Error(`missing alt text for ${image.id} (${lang}) — export should have been blocked`)
  }
  return text
}

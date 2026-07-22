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

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escape for HTML text and double-quoted attribute values alike. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])
}

/**
 * Bytes -> data URI.
 *
 * Chunked deliberately: `String.fromCharCode(...bytes)` overflows the argument
 * limit and throws on anything above a few hundred kilobytes, and these are
 * full-resolution screenshots.
 */
export function toDataUri(bytes, mime = 'image/png') {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64')
  return `data:${mime};base64,${base64}`
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
 * Wrap body content in a complete, self-contained HTML document.
 *
 * @param {object} options
 * @param {string} options.title       document title, already plain text
 * @param {string[]} options.languages language codes, first is the default
 * @param {string} options.body        body HTML
 * @param {string} [options.css]       artifact-specific CSS, appended to BASE_CSS
 * @param {string} [options.script]    artifact-specific JS, appended to the toggle
 */
export function renderDocument({ title, languages, body, css = '', script = '' }) {
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
<title>${escapeHtml(title)}</title>
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

/** Header shared by the artifacts: title, metadata, and the toggle. */
export function documentHeader({ title, subtitle, languages }) {
  const toggle =
    languages.length > 1
      ? `<button type="button" id="lang-toggle" class="lang-toggle" hidden>Français</button>`
      : ''

  return `<header class="doc-header">
  <div>
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="doc-meta">${escapeHtml(subtitle)}</p>` : ''}
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

/**
 * Tests for the quick-steps artifact.
 *
 * These check the properties that make an artifact actually usable once it has
 * left this tool: it must open with no network, stay readable with JavaScript
 * disabled, and pass axe as a document in its own right. A generated file that
 * only works inside a dev server is not a deliverable.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { JSDOM } from 'jsdom'
import axe from 'axe-core'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, confirmAltText, setStepText } from '../src/lib/authoring.js'
import { emitQuickSteps } from '../src/lib/emit-quick-steps.js'
import { escapeHtml, toDataUri, altFor } from '../src/lib/emit-common.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const AXE_OPTIONS = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
  // jsdom has no layout, so contrast cannot be evaluated here. The emitted
  // palette is the same one measured in-browser for the tool itself.
  rules: { 'color-contrast': { enabled: false } },
}
const KNOWN_INCOMPLETE = new Set(['landmark-one-main', 'page-has-heading-one'])

/** A capture authored to completion in both languages. */
async function authored() {
  let capture = seedAltText(await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS })))
  for (const step of capture.steps) {
    capture = setStepText(capture, step.index, 'fr', `Étape ${step.index} en français`)
    for (const image of step.images) {
      capture = confirmAltText(capture, step.index, image.id, 'en')
    }
  }
  return capture
}

/** Load emitted HTML as a real document. `scripts` enables the lang toggle. */
function open(html, { scripts = false } = {}) {
  return new JSDOM(html, {
    runScripts: scripts ? 'dangerously' : 'outside-only',
    pretendToBeVisual: true,
  })
}

async function axeClean(dom, label) {
  dom.window.eval(axe.source)
  const results = await dom.window.axe.run(dom.window.document, AXE_OPTIONS)
  const describe = (rs) => rs.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n  ')
  assert.equal(results.violations.length, 0, `${label} violations:\n  ${describe(results.violations)}`)
  const unexpected = results.incomplete.filter((r) => !KNOWN_INCOMPLETE.has(r.id))
  assert.equal(unexpected.length, 0, `${label} needs-review:\n  ${describe(unexpected)}`)
}

// ------------------------------------------------------------ self-contained ---

test('the artifact makes no external request of any kind', async () => {
  const html = emitQuickSteps(await authored())

  assert.ok(!/<link\b/i.test(html), 'no stylesheet links')
  assert.ok(!/<script[^>]+src=/i.test(html), 'no external scripts')
  assert.ok(!/https?:\/\//i.test(html.replace(/xmlns[^"]*"[^"]*"/g, '')), 'no absolute URLs')
  assert.ok(!/@import/i.test(html), 'no CSS imports')
  assert.ok(!/url\((?!['"]?data:)/i.test(html), 'no url() outside data URIs')
})

test('it is a complete standalone document', async () => {
  const html = emitQuickSteps(await authored())

  assert.match(html, /^<!doctype html>/i)
  assert.match(html, /<html lang="en-CA"/)
  assert.match(html, /<meta charset="utf-8">/)
  assert.match(html, /<title>/)
  assert.match(html, /<\/html>\s*$/)
})

// ------------------------------------------------------------------ content ---

test('every step appears, in order', async () => {
  const capture = await authored()
  const dom = open(emitQuickSteps(capture))
  const items = [...dom.window.document.querySelectorAll('.quick-list > li')]

  assert.equal(items.length, ENGLISH_STEPS.length)
  items.forEach((li, i) => {
    assert.match(li.textContent, new RegExp(escapeRegex(ENGLISH_STEPS[i])), `step ${i + 1}`)
  })
  dom.window.close()
})

test('it carries no screenshots — that is what keeps it to one page', async () => {
  const html = emitQuickSteps(await authored())
  assert.ok(!/<img\b/i.test(html), 'no images in the cheat sheet')
})

test('content is escaped, not injected', async () => {
  const capture = await parseSnagitDocx(
    makeCapture({ steps: ['Click "Save & Close" <script>alert(1)</script>'] })
  )
  const html = emitQuickSteps(capture, { languages: ['en'] })

  assert.ok(!/<script>alert\(1\)<\/script>/.test(html), 'the payload is not live markup')
  assert.match(html, /&lt;script&gt;/, 'it is escaped instead')

  const dom = open(html)
  assert.match(dom.window.document.body.textContent, /Click "Save & Close" <script>alert\(1\)<\/script>/)
  dom.window.close()
})

// ---------------------------------------------------------------- bilingual ---

test('both languages are in the document', async () => {
  const dom = open(emitQuickSteps(await authored()))
  const { document } = dom.window

  assert.equal(document.querySelectorAll('[data-lang-block="en"]').length, ENGLISH_STEPS.length)
  assert.equal(document.querySelectorAll('[data-lang-block="fr"]').length, ENGLISH_STEPS.length)
  dom.window.close()
})

test('each language block declares its own lang (WCAG 3.1.2)', async () => {
  const dom = open(emitQuickSteps(await authored()))
  const { document } = dom.window

  for (const el of document.querySelectorAll('[data-lang-block="fr"]')) {
    assert.equal(el.getAttribute('lang'), 'fr-CA')
  }
  for (const el of document.querySelectorAll('[data-lang-block="en"]')) {
    assert.equal(el.getAttribute('lang'), 'en-CA')
  }
  dom.window.close()
})

test('with JavaScript disabled the document is still fully readable', async () => {
  // Progressive enhancement, and the reason both languages are emitted. With
  // no script there is no data-lang, so the stylesheet shows both rather than
  // leaving a half-empty page.
  const dom = open(emitQuickSteps(await authored()), { scripts: false })
  const { document } = dom.window

  assert.equal(document.documentElement.hasAttribute('data-lang'), false, 'no script ran')
  const text = document.body.textContent
  assert.match(text, /Click on the web browser/, 'English present')
  assert.match(text, /Étape 1 en français/, 'French present')
  assert.equal(document.getElementById('lang-toggle').hidden, true, 'the toggle stays hidden')
  dom.window.close()
})

test('with JavaScript the toggle activates and switches language', async () => {
  const dom = open(emitQuickSteps(await authored()), { scripts: true })
  const { document } = dom.window
  const root = document.documentElement
  const button = document.getElementById('lang-toggle')

  assert.equal(root.getAttribute('data-lang'), 'en', 'defaults to the first language')
  assert.equal(root.getAttribute('lang'), 'en-CA')
  assert.equal(button.hidden, false, 'the toggle is revealed only when it works')
  assert.equal(button.textContent, 'Français', 'it names the language it switches TO')

  button.dispatchEvent(new dom.window.Event('click', { bubbles: true }))
  assert.equal(root.getAttribute('data-lang'), 'fr')
  assert.equal(root.getAttribute('lang'), 'fr-CA', 'the document language follows')
  assert.equal(button.textContent, 'English')
  dom.window.close()
})

// ------------------------------------------------------------ accessibility ---

test('the emitted artifact is axe clean', async () => {
  await axeClean(open(emitQuickSteps(await authored()), { scripts: true }), 'quick-steps')
})

test('it is axe clean with scripting disabled too', async () => {
  // The no-JS state is a real state a reader will encounter, so it is tested
  // as one rather than assumed to be a degraded copy of the other.
  await axeClean(open(emitQuickSteps(await authored()), { scripts: false }), 'quick-steps (no JS)')
})

test('heading structure is sound', async () => {
  const dom = open(emitQuickSteps(await authored()))
  const levels = [...dom.window.document.querySelectorAll('h1,h2,h3,h4')].map((h) => +h.tagName[1])

  assert.equal(levels.filter((l) => l === 1).length, 1, 'exactly one h1')
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] - levels[i - 1] <= 1, 'no skipped heading levels')
  }
  dom.window.close()
})

// ---------------------------------------------------------- shared helpers ---

test('toDataUri handles payloads too large for spread', () => {
  // String.fromCharCode(...bytes) throws on large inputs, and screenshots are
  // large. The chunked implementation is the point.
  const big = new Uint8Array(300_000).fill(65)
  const uri = toDataUri(big)

  assert.match(uri, /^data:image\/png;base64,/)
  assert.ok(uri.length > 300_000, 'the whole payload is encoded')
})

test('altFor returns empty string for decorative images, never undefined', () => {
  assert.equal(altFor({ decorative: true, alt: {} }, 'en'), '')
})

test('altFor refuses unconfirmed or missing alt text', () => {
  // The export gate should have stopped this. If it somehow did not, failing
  // loudly beats shipping an inaccessible artifact.
  assert.throws(() => altFor({ decorative: false, alt: { en: '' } }, 'en'), /missing alt text/)
  assert.throws(() => altFor({ decorative: false, alt: {} }, 'en'), /missing alt text/)
})

test('escapeHtml covers attribute-breaking characters', () => {
  assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
})

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

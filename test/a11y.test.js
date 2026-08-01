/**
 * Automated accessibility regressions with axe-core.
 *
 * ⚠️ What this can and cannot cover.
 *
 * jsdom has no layout engine and does not paint, so axe's `color-contrast`
 * rule cannot run here — it needs real computed colours over real backgrounds.
 * That rule is disabled below and covered instead by direct measurement in a
 * real browser, recorded in staging/stage-1-foundation/feature-app-shell.md
 * (22 pairs across light and dark, zero failures).
 *
 * Everything axe CAN decide without paint — alt text, labels, ARIA validity,
 * heading order, landmarks, document language, duplicate ids — is asserted at
 * zero violations, in both languages, in both the empty and loaded states.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { JSDOM } from 'jsdom'
import axe from 'axe-core'

import { applyStaticStrings, buildEditableMeta, buildWarnings, buildSteps } from '../src/ui/render.js'
import { LANGUAGES } from '../src/lib/i18n.js'
import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const AXE_OPTIONS = {
  // WCAG 2.1 AA is the project's conformance target — run exactly those rules
  // plus axe's best-practice set, not the whole catalogue. 99 rules in total.
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
  rules: {
    // Cannot run without layout. Measured in-browser instead — see file header.
    'color-contrast': { enabled: false },
  },
}

/**
 * axe returns four buckets, and `violations` is only one of them.
 * `incomplete` means "needs review" — axe could not decide. Ignoring that
 * bucket silently discards real findings: a bad `aria-labelledby` reference,
 * for example, lands in `incomplete`, not `violations`.
 *
 * So every incomplete result must be either fixed or listed here with a reason.
 * A new one fails the suite rather than passing unnoticed.
 *
 * These two are artefacts of jsdom having no layout: axe cannot confirm an
 * element is visible, so it cannot confirm the landmark or the h1 — both of
 * which ARE present and are asserted directly by other tests below.
 */
const KNOWN_INCOMPLETE = new Set(['landmark-one-main', 'page-has-heading-one'])

/** A 1x1 transparent PNG — enough for an <img> in a DOM with no renderer. */
const STUB_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

async function makeDom() {
  const html = await readFile(resolve(projectRoot, 'index.html'), 'utf8')
  const css = await readFile(resolve(projectRoot, 'src/ui/styles.css'), 'utf8')

  const dom = new JSDOM(html, {
    url: 'http://localhost:8080/',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
  })

  // Inline the stylesheet; jsdom does not fetch the <link> and axe inspects
  // computed styles for several non-contrast rules.
  const style = dom.window.document.createElement('style')
  style.textContent = css
  dom.window.document.head.append(style)

  dom.window.eval(axe.source)
  return dom
}

async function run(dom) {
  const results = await dom.window.axe.run(dom.window.document, AXE_OPTIONS)
  return results
}

/** Readable failure output — axe's raw objects are unreadable in assertions. */
function describe(results) {
  return results
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`
    )
    .join('\n  ')
}

/**
 * Assert an axe run is clean — no violations AND no unexpected "needs review".
 * Also asserts axe actually executed rules, so a misconfiguration cannot pass
 * as a green result.
 */
function assertAxeClean(results, label) {
  assert.equal(results.violations.length, 0, `${label} — violations:\n  ${describe(results.violations)}`)

  const unexpected = results.incomplete.filter((r) => !KNOWN_INCOMPLETE.has(r.id))
  assert.equal(
    unexpected.length,
    0,
    `${label} — unreviewed "needs review" results:\n  ${describe(unexpected)}`
  )

  assert.ok(results.passes.length > 5, `${label} — axe did not actually run rules`)
}

/** Populate the page the way app.js does, minus events and object URLs. */
function renderInto(dom, capture, lang) {
  const { document } = dom.window
  applyStaticStrings(document, lang)
  document
    .getElementById('capture-meta')
    .replaceChildren(...buildEditableMeta(document, capture, lang, () => {}))
  document
    .getElementById('warnings-list')
    .replaceChildren(...buildWarnings(document, capture, lang))
  document
    .getElementById('steps-list')
    .replaceChildren(...buildSteps(document, capture, lang, () => STUB_IMAGE))

  for (const id of ['capture', 'steps', ...(capture.warnings.length ? ['warnings'] : [])]) {
    document.getElementById(id).hidden = false
  }
}

// ------------------------------------------------------------------ tests ---

test('empty state is axe clean', async () => {
  const dom = await makeDom()
  assertAxeClean(await run(dom), 'empty state')
  dom.window.close()
})

test('loaded state is axe clean (English)', async () => {
  const dom = await makeDom()
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))
  renderInto(dom, capture, 'en')

  assertAxeClean(await run(dom), 'loaded state (en)')
  dom.window.close()
})

test('loaded state is axe clean (French)', async () => {
  const dom = await makeDom()
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))
  renderInto(dom, capture, 'fr')

  assertAxeClean(await run(dom), 'loaded state (fr)')
  dom.window.close()
})

test('error state is axe clean', async () => {
  const dom = await makeDom()
  const { document } = dom.window
  document.getElementById('error').hidden = false
  document.getElementById('error-detail').textContent = 'This does not look like a Word file.'

  assertAxeClean(await run(dom), 'error state')
  dom.window.close()
})

test('a broken ARIA reference is caught, not silently tolerated', async () => {
  // Meta-test: proves assertAxeClean inspects axe's `incomplete` bucket.
  // A dangling aria-labelledby lands in "needs review", not "violations", so a
  // suite that only checks violations would pass while the page is broken.
  const dom = await makeDom()
  dom.window.document.getElementById('status').setAttribute('aria-labelledby', 'does-not-exist')
  const results = await run(dom)

  assert.equal(results.violations.length, 0, 'axe files this under incomplete, not violations')
  assert.throws(
    () => assertAxeClean(results, 'deliberately broken'),
    /aria-valid-attr-value/,
    'the helper must fail on it anyway'
  )
  dom.window.close()
})

test('element ids are unique — axe 4.x no longer checks this', async () => {
  // axe removed `duplicate-id`; only `duplicate-id-aria` survives, and it fires
  // only for ARIA-referenced ids. Duplicate ids break label associations and
  // `aria-labelledby`, so this is asserted directly.
  const dom = await makeDom()
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))
  renderInto(dom, capture, 'en')

  const ids = [...dom.window.document.querySelectorAll('[id]')].map((el) => el.id)
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)

  assert.deepEqual(duplicates, [], 'no duplicate element ids')
  dom.window.close()
})

test('every screenshot carries non-empty alt text', async () => {
  const dom = await makeDom()
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))
  renderInto(dom, capture, 'en')

  const images = [...dom.window.document.querySelectorAll('.step img')]
  assert.equal(images.length, ENGLISH_STEPS.length)
  for (const img of images) {
    assert.ok(img.getAttribute('alt')?.trim(), 'alt is present and non-empty')
  }
  dom.window.close()
})

test('untranslated text declares its own language (WCAG 3.1.2)', async () => {
  // Regression test. Falling back to English inside a fr-CA page without a lang
  // attribute makes a screen reader pronounce English with French phonetics.
  const dom = await makeDom()
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))
  renderInto(dom, capture, 'fr')

  const { document } = dom.window
  assert.equal(document.documentElement.lang, 'fr-CA', 'page is French')

  const texts = [...document.querySelectorAll('.step__text')]
  for (const el of texts) {
    assert.equal(el.lang, 'en-CA', 'English fallback text is marked as English')
  }
  dom.window.close()
})

test('translated text carries no redundant lang attribute', async () => {
  const dom = await makeDom()
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))
  // Pretend Stage 2 has supplied French for every step.
  for (const step of capture.steps) step.text.fr = 'Cliquez sur « Détails »'
  renderInto(dom, capture, 'fr')

  for (const el of dom.window.document.querySelectorAll('.step__text')) {
    assert.equal(el.getAttribute('lang'), null, 'no lang override once translated')
  }
  dom.window.close()
})

test('document language is set and changes with the toggle', async () => {
  const dom = await makeDom()
  const { document } = dom.window

  applyStaticStrings(document, 'en')
  assert.equal(document.documentElement.lang, 'en-CA')

  applyStaticStrings(document, 'fr')
  assert.equal(document.documentElement.lang, 'fr-CA')
  assert.equal(document.querySelector('h1').textContent, 'Studio de captures d’étapes')
  dom.window.close()
})

test('heading hierarchy has exactly one h1 and no skipped levels', async () => {
  const dom = await makeDom()
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))
  renderInto(dom, capture, 'en')

  const levels = [...dom.window.document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
    Number(h.tagName[1])
  )

  assert.equal(levels.filter((l) => l === 1).length, 1, 'exactly one h1')
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] - levels[i - 1] <= 1, `no skip at ${levels[i - 1]} -> ${levels[i]}`)
  }
  dom.window.close()
})

test('live regions are never display:none, even when empty', async () => {
  // Regression test. `.status:empty { display: none }` removed the region from
  // the accessibility tree whenever it had no text — and a live region that
  // re-enters the tree at the same moment it gains content is not announced.
  // Every message following an empty state would have been silent.
  const dom = await makeDom()
  const { document, getComputedStyle } = dom.window

  // `save-state` was the autosave indicator and went with that feature; the
  // rule it was guarding still applies to every remaining live region.
  for (const id of ['status', 'readiness-summary']) {
    const el = document.getElementById(id)
    assert.ok(el, `#${id} exists`)
    assert.equal(el.textContent.trim(), '', 'starts empty, which is the risky case')
    assert.notEqual(
      getComputedStyle(el).display,
      'none',
      `#${id} must stay in the accessibility tree while empty`
    )
  }
  dom.window.close()
})

test('status is a polite live region and errors are a separate alert', async () => {
  const dom = await makeDom()
  const { document } = dom.window
  const status = document.getElementById('status')
  const errorDetail = document.getElementById('error-detail')

  // role="status" implies polite; pairing it with assertive is contradictory
  // and handled inconsistently across screen readers.
  assert.equal(status.getAttribute('role'), 'status')
  assert.equal(status.getAttribute('aria-live'), 'polite')
  assert.equal(errorDetail.getAttribute('role'), 'alert')
  dom.window.close()
})

test('the header save button is labelled as a project-file save, not the Export phase', async () => {
  // Regression test. The header button originally jumped to the Export phase
  // and shared the phase tab's `nav.export` string, so the page carried two
  // controls named "Export" that did different things. It is a save — the same
  // action as the Edit toolbar's twin — and must say so in both languages.
  const dom = await makeDom()
  const { document } = dom.window

  const header = document.getElementById('header-export')
  const twin = document.getElementById('export-project')
  const phaseTab = document.querySelector('[data-phase-target="export"]')

  assert.equal(
    header.dataset.i18n,
    twin.dataset.i18n,
    'header button and toolbar twin are the same action, so the same string'
  )
  assert.notEqual(
    header.dataset.i18n,
    phaseTab.dataset.i18n,
    'header button must not reuse the phase tab string'
  )

  for (const lang of LANGUAGES) {
    applyStaticStrings(document, lang)
    assert.notEqual(
      header.textContent.trim(),
      phaseTab.textContent.trim(),
      `distinguishable accessible names in ${lang}`
    )
    assert.ok(header.textContent.trim().length > 0, `header button has a label in ${lang}`)
  }
  dom.window.close()
})

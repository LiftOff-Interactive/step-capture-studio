/**
 * Tests for the all-in-one dashboard.
 *
 * Its contract is composition: one self-contained page that carries every other
 * artifact whole, plus the Word documents as downloads. The failure that would
 * matter most is a card that looks present but points at nothing, or an iframe
 * whose artifact silently did not make it in — so these assert the links, the
 * panels, and the embedded content actually line up.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { JSDOM } from 'jsdom'
import axe from 'axe-core'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, confirmAltText, setStepText, setAltText } from '../src/lib/authoring.js'
import { setNarrative, setScenario } from '../src/lib/case-study.js'
import { emitAllInOne } from '../src/lib/emit-all-in-one.js'
import { captureTitle } from '../src/lib/emit-common.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const AXE_OPTIONS = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
  rules: { 'color-contrast': { enabled: false } },
}
const KNOWN_INCOMPLETE = new Set(['landmark-one-main', 'page-has-heading-one'])

/** A fully authored, worked-example-ready capture — the all-in-one's precondition. */
async function authored() {
  let c = seedAltText(await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS })))
  for (const step of c.steps) {
    c = setStepText(c, step.index, 'fr', `Étape ${step.index} en français`)
    for (const img of step.images) {
      c = confirmAltText(c, step.index, img.id, 'en')
      c = setAltText(c, step.index, img.id, 'fr', `Capture ${step.index}`)
      c = confirmAltText(c, step.index, img.id, 'fr')
    }
    c = setNarrative(c, step.index, 'why', 'en', `Step ${step.index} matters because of X`)
    c = setNarrative(c, step.index, 'ifSkipped', 'en', `Skipping step ${step.index} breaks Y`)
  }
  c = setScenario(c, 'audience', 'en', 'New staff in their first week')
  c = setScenario(c, 'context', 'en', 'Opening the course handbook')
  return c
}

const build = async () => emitAllInOne(await authored(), { languages: ['en', 'fr'] })
const open = (html) => new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true })

test('it is one self-contained HTML document', async () => {
  const html = await build()
  assert.match(html, /^<!doctype html>/i)
  assert.match(html, /<\/html>\s*$/i)
})

test('the header carries the capture title', async () => {
  const c = await authored()
  const doc = open(await emitAllInOne(c, { languages: ['en', 'fr'] })).window.document
  assert.ok(
    doc.querySelector('h1').textContent.includes(captureTitle(c, 'en')),
    'the dashboard shows the same title as every other artifact'
  )
})

test('four cards: three open a panel, Step Guide is download-only', async () => {
  const doc = open(await build()).window.document

  assert.equal(doc.querySelectorAll('.aio-card').length, 4, 'four cards')

  // The three "open" cards link to panels that exist.
  for (const id of ['walkthrough', 'worked-example', 'quick-reference']) {
    const link = doc.querySelector(`.aio-card__open[href="#panel-${id}"]`)
    assert.ok(link, `a card links to #panel-${id}`)
    assert.ok(doc.getElementById(`panel-${id}`), `#panel-${id} exists`)
  }

  // Step Guide is a download card: no panel link, no panel of its own.
  const stepGuide = doc.querySelector('.aio-card--download')
  assert.ok(stepGuide, 'the Step Guide card exists')
  assert.equal(stepGuide.querySelector('.aio-card__open'), null, 'it does not link to a panel')
  assert.ok(!doc.getElementById('panel-step-guide'), 'and has no panel to reveal')
  assert.equal(doc.querySelectorAll('.aio-panel').length, 3, 'only three panels')
})

test('each panel embeds its artifact, whole, in a titled iframe', async () => {
  const doc = open(await build()).window.document

  // getAttribute decodes the srcdoc entities back to the real artifact HTML.
  const srcdoc = (id) => doc.querySelector(`#panel-${id} iframe`).getAttribute('srcdoc')

  // A marker unique to each emitter proves the right artifact landed in the right frame.
  assert.match(srcdoc('quick-reference'), /quick-list/, 'quick-steps went into the quick panel')
  assert.match(srcdoc('walkthrough'), /<!doctype html>/i, 'the walkthrough is a whole document')
  assert.match(srcdoc('worked-example'), /matters because of X/, 'the worked example carries its narrative')

  for (const id of ['walkthrough', 'worked-example', 'quick-reference']) {
    assert.ok(doc.querySelector(`#panel-${id} iframe`).getAttribute('title'), `iframe ${id} has a title`)
  }
})

test('the Word document rides along as two base64 download links', async () => {
  const doc = open(await build()).window.document
  const links = [...doc.querySelectorAll('.aio-word a[download]')]

  assert.equal(links.length, 2, 'one Word link per language')
  for (const link of links) {
    assert.match(link.getAttribute('href'), /^data:application\/vnd\.openxmlformats.*base64,/)
  }
  const names = links.map((l) => l.getAttribute('download'))
  assert.ok(names.some((n) => n.endsWith('_EN.docx')), 'an English .docx')
  assert.ok(names.some((n) => n.endsWith('_FR.docx')), 'a French .docx')
})

test('the Word links live in the Step Guide (download) card', async () => {
  const doc = open(await build()).window.document

  const wordCard = doc.querySelector('.aio-word').closest('.aio-card')
  assert.ok(wordCard.classList.contains('aio-card--download'), 'the Word links are the Step Guide card')
  assert.ok(
    wordCard.textContent.includes('Step Guide') && wordCard.textContent.includes('Guide des étapes'),
    'and it is titled Step Guide'
  )
  // They must not have leaked back onto the worked-example card.
  const workedExample = doc.querySelector('.aio-card__open[href="#panel-worked-example"]').closest('.aio-card')
  assert.equal(workedExample.querySelector('.aio-word'), null, 'no Word links on the worked example')
})

test('one language control drives the whole page — a single dashboard toggle', async () => {
  const doc = open(await build()).window.document
  // The iframes carry their own toggles inside srcdoc (not in this DOM); at the
  // dashboard level there must be exactly one.
  assert.equal(doc.querySelectorAll('#lang-toggle').length, 1, 'exactly one dashboard toggle')
})

test('each open panel has a Print button targeting its own iframe', async () => {
  const doc = open(await build()).window.document
  for (const id of ['walkthrough', 'worked-example', 'quick-reference']) {
    const btn = doc.querySelector(`#panel-${id} .aio-print`)
    assert.ok(btn, `panel ${id} has a Print button`)
    assert.equal(btn.getAttribute('data-panel'), `panel-${id}`, 'wired to its own panel')
  }
})

test('chrome is bilingual — card titles carry both languages', async () => {
  const doc = open(await build()).window.document
  const title = doc.querySelector('.aio-card__title')

  assert.ok(title.querySelector('[data-lang-block="en"]'), 'an English block')
  assert.ok(title.querySelector('[data-lang-block="fr"]'), 'a French block')
  const text = title.textContent
  assert.ok(text.includes('Interactive Walkthrough') && text.includes('Visite interactive'))
})

test('the dashboard is axe clean', async () => {
  const dom = open(await build())
  dom.window.eval(axe.source)
  const results = await dom.window.axe.run(dom.window.document, AXE_OPTIONS)

  // Assert on lengths, not array identity: axe.run returns arrays from the
  // jsdom realm, and deepStrictEqual would fault two empty arrays for having
  // different prototypes.
  const describe = (rs) => rs.map((v) => v.id).join(', ')
  assert.equal(results.violations.length, 0, `violations: ${describe(results.violations)}`)
  const surprises = results.incomplete.filter((v) => !KNOWN_INCOMPLETE.has(v.id))
  assert.equal(surprises.length, 0, `unexpected incomplete: ${describe(surprises)}`)
  dom.window.close()
})

test('the viewport takeover is screen-only, so print still gets the menu', async () => {
  // Regression test, two halves.
  //
  // At a fixed 82vh the frame was shorter than the window while the page behind
  // it still scrolled, so the artifact sat in a nested scroll region with less
  // height than one of its own steps. An open panel now fills what is left
  // below the header and the body stops scrolling.
  //
  // That second part is why this must not reach print: a body pinned to 100vh
  // with overflow:hidden clips the printed menu to a single page. The print
  // block deliberately hides panels and prints the menu instead.
  const dom = open(await build())
  const { CSSRule } = dom.window

  const media = [...dom.window.document.styleSheets[0].cssRules].filter(
    (r) => r.type === CSSRule.MEDIA_RULE
  )
  const textOf = (blocks) => blocks.map((b) => [...b.cssRules].map((r) => r.cssText).join(' ')).join(' ')

  const screenText = textOf(media.filter((r) => r.conditionText === 'screen'))
  const printText = textOf(media.filter((r) => r.conditionText.includes('print')))

  assert.match(screenText, /\.aio-panel:target[\s\S]*\.aio-frame/, 'the takeover sizes the open frame')
  assert.match(screenText, /100vh/, 'and pins the body to the viewport')

  assert.doesNotMatch(printText, /body:has/, 'the takeover never reaches print')
  assert.doesNotMatch(printText, /100vh|overflow:\s*hidden/, 'print is never clipped to one screen')

  // What print does instead, unchanged.
  assert.match(printText, /\.aio-menu[^{]*\{[^}]*display:\s*block/, 'print keeps the menu')
  assert.match(printText, /\.aio-panel:target[^{]*\{[^}]*display:\s*none/, 'print drops the panels')

  dom.window.close()
})

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

test('three cards link to three panels that exist', async () => {
  const doc = open(await build()).window.document

  for (const id of ['walkthrough', 'worked-example', 'quick-reference']) {
    const link = doc.querySelector(`.aio-card__open[href="#panel-${id}"]`)
    assert.ok(link, `a card links to #panel-${id}`)
    const panel = doc.getElementById(`panel-${id}`)
    assert.ok(panel, `#panel-${id} exists`)
    assert.equal(panel.classList.contains('aio-panel'), true)
  }
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

test('the Word links sit inside the worked-example card, not their own', async () => {
  const doc = open(await build()).window.document
  const cards = [...doc.querySelectorAll('.aio-card')]
  assert.equal(cards.length, 3, 'three cards, not four')

  const wordCard = doc.querySelector('.aio-word').closest('.aio-card')
  const openLink = wordCard.querySelector('.aio-card__open').getAttribute('href')
  assert.equal(openLink, '#panel-worked-example', 'the Word links live under the worked example')
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

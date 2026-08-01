/**
 * Tests for choosing what the all-in-one bundles.
 *
 * The load-bearing ones: that unticking a part never stops that artifact being
 * downloadable on its own, and that the worked example's master switch on its
 * own phase wins over this one.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { JSDOM } from 'jsdom'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, confirmAltText, setStepText, setAltText } from '../src/lib/authoring.js'
import { setNarrative, setScenario, setIncludeWorkedExample } from '../src/lib/case-study.js'
import {
  AIO_PARTS,
  allInOneParts,
  defaultParts,
  hasAnyPart,
  setAllInOnePart,
} from '../src/lib/all-in-one.js'
import { emitAllInOne } from '../src/lib/emit-all-in-one.js'
import { emitWalkthrough } from '../src/lib/emit-walkthrough.js'
import { emitProject } from '../src/lib/emit-project.js'
import { parseProject } from '../src/lib/parse-project.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const dom = new JSDOM('')
const parse = (html) => parseProject(html, dom.window.DOMParser)
const open = (html) => new JSDOM(html).window.document

async function authored() {
  let c = seedAltText(await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS })))
  for (const step of c.steps) {
    c = setStepText(c, step.index, 'fr', `Étape ${step.index}`)
    for (const img of step.images) {
      c = confirmAltText(c, step.index, img.id, 'en')
      c = setAltText(c, step.index, img.id, 'fr', `Capture ${step.index}`)
      c = confirmAltText(c, step.index, img.id, 'fr')
    }
    c = setNarrative(c, step.index, 'why', 'en', `Step ${step.index} matters`)
  }
  return setScenario(c, 'audience', 'en', 'New staff')
}

test('everything is bundled by default, which is what the dashboard always did', async () => {
  const c = await authored()
  assert.deepEqual(allInOneParts(c), defaultParts())
  assert.deepEqual(Object.keys(defaultParts()), AIO_PARTS)
})

test('unticking a part drops its card and its panel', async () => {
  const c = setAllInOnePart(await authored(), 'quickReference', false)
  const doc = open(await emitAllInOne(c, { languages: ['en'] }))

  assert.equal(doc.getElementById('panel-quick-reference'), null)
  assert.equal(doc.querySelectorAll('a[href="#panel-quick-reference"]').length, 0)
  assert.equal(doc.querySelectorAll('.aio-grid > li').length, 3)
  assert.ok(doc.getElementById('panel-walkthrough'), 'the rest survive')
})

test('unticking a part never stops it being downloaded on its own', async () => {
  // The whole point: this chooses what goes in the bundle, not what exists.
  const c = setAllInOnePart(await authored(), 'walkthrough', false)
  const html = emitWalkthrough(c, { languages: ['en'] })
  assert.match(html, /^<!doctype html>/i)
  assert.ok(open(html).querySelector('.step'), 'the walkthrough is unaffected')
})

test('the Word links go with the Step Guide card', async () => {
  const c = setAllInOnePart(await authored(), 'stepGuide', false)
  const html = await emitAllInOne(c, { languages: ['en'] })
  assert.doesNotMatch(html, /wordprocessingml\.document/, 'no docx is embedded at all')
})

test('the worked example’s own switch wins over this one', async () => {
  // Its master switch lives on its phase. Ticking it here cannot conjure a
  // worked example the capture does not produce.
  let c = setIncludeWorkedExample(await authored(), false)
  c = setAllInOnePart(c, 'workedExample', true)

  assert.equal(allInOneParts(c).workedExample, false)
  assert.equal(open(await emitAllInOne(c, { languages: ['en'] })).getElementById('panel-worked-example'), null)
})

test('an empty selection is reported rather than emitted as an empty shell', async () => {
  let c = await authored()
  for (const part of AIO_PARTS) c = setAllInOnePart(c, part, false)
  assert.equal(hasAnyPart(c), false)
})

test('one part left is still a dashboard', async () => {
  let c = await authored()
  for (const part of AIO_PARTS) c = setAllInOnePart(c, part, part === 'walkthrough')
  assert.equal(hasAnyPart(c), true)

  const doc = open(await emitAllInOne(c, { languages: ['en'] }))
  assert.equal(doc.querySelectorAll('.aio-grid > li').length, 1)
  assert.ok(doc.getElementById('panel-walkthrough'))
})

test('an unknown part is refused rather than silently stored', async () => {
  const c = await authored()
  assert.throws(() => setAllInOnePart(c, 'nope', true), /unknown all-in-one part/)
})

test('the selection survives the project-file round trip', async () => {
  const c = setAllInOnePart(await authored(), 'quickReference', false)
  const back = parse(emitProject(c))
  assert.equal(back.allInOne.quickReference, false)
  assert.equal(back.allInOne.walkthrough, true)
})

test('a project file written before this existed bundles everything', async () => {
  const html = emitProject(await authored()).replace(/ data-all-in-one-parts="[^"]*"/, '')
  assert.deepEqual(parse(html).allInOne, defaultParts())
})

test('a file that names no parts is honoured as none, not reset to all', async () => {
  // Unticking everything is a legitimate thing to have done, and a round trip
  // that quietly put it all back would undo the author's choice.
  const html = emitProject(await authored()).replace(
    / data-all-in-one-parts="[^"]*"/,
    ' data-all-in-one-parts=""'
  )
  assert.equal(hasAnyPart(parse(html)), false)
})

test('each card carries a standard icon, and it is decorative', async () => {
  // The card's own title sits directly underneath, so describing the artwork
  // would make a screen reader announce the same card twice.
  const doc = open(await emitAllInOne(await authored(), { languages: ['en'] }))
  const tiles = [...doc.querySelectorAll('.aio-card__icon')]

  assert.equal(tiles.length, 4, 'one per card')
  for (const tile of tiles) {
    assert.equal(tile.getAttribute('aria-hidden'), 'true')
    const svg = tile.querySelector('svg')
    assert.ok(svg, 'carries a standard glyph rather than an empty tile')
    assert.equal(svg.getAttribute('focusable'), 'false', 'and is not a tab stop in IE-era engines')
  }
  // Four distinct drawings, not one repeated.
  const shapes = new Set(tiles.map((tile) => tile.querySelector('svg').innerHTML))
  assert.equal(shapes.size, 4)
})

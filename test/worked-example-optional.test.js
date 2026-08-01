/**
 * Tests for making the worked example optional.
 *
 * The load-bearing ones are the two that decide whether this is safe: that
 * opting out DELETES NOTHING, and that a capture written before the choice
 * existed still gets its worked example. Everything else is the consequences
 * fanning out — the gate, the step form, the prompt, and the dashboard.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { JSDOM } from 'jsdom'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, confirmAltText, setStepText, setAltText, stepVerification, exportReadiness } from '../src/lib/authoring.js'
import {
  setNarrative,
  setScenario,
  caseStudyReadiness,
  includesWorkedExample,
  setIncludeWorkedExample,
} from '../src/lib/case-study.js'
import { collectTranslatable } from '../src/lib/translate.js'
import { emitAllInOne } from '../src/lib/emit-all-in-one.js'
import { emitProject } from '../src/lib/emit-project.js'
import { parseProject } from '../src/lib/parse-project.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

/** Alt text and both languages complete — export-ready, no worked example yet. */
async function exportReady() {
  let c = seedAltText(await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS })))
  for (const step of c.steps) {
    c = setStepText(c, step.index, 'fr', `Étape ${step.index} en français`)
    for (const img of step.images) {
      c = confirmAltText(c, step.index, img.id, 'en')
      c = setAltText(c, step.index, img.id, 'fr', `Capture ${step.index}`)
      c = confirmAltText(c, step.index, img.id, 'fr')
    }
  }
  return c
}

/** The same, plus scenario and narrative — a full worked example. */
async function withWorkedExample() {
  let c = await exportReady()
  for (const step of c.steps) {
    c = setNarrative(c, step.index, 'why', 'en', `Step ${step.index} matters because of X`)
    c = setNarrative(c, step.index, 'ifSkipped', 'en', `Skipping step ${step.index} breaks Y`)
  }
  return setScenario(c, 'audience', 'en', 'New staff in their first week')
}

const dom = new JSDOM('')
const parse = (html) => parseProject(html, dom.window.DOMParser)
const open = (html) => new JSDOM(html).window.document

test('a freshly parsed capture includes a worked example', async () => {
  const c = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))
  assert.equal(c.includeWorkedExample, true)
  assert.equal(includesWorkedExample(c), true)
})

test('a capture from before the choice existed still includes one', () => {
  // The field simply will not be there on an older model or project file.
  // Defaulting to "excluded" would silently drop work already done.
  assert.equal(includesWorkedExample({}), true)
  assert.equal(includesWorkedExample({ includeWorkedExample: undefined }), true)
  assert.equal(includesWorkedExample({ includeWorkedExample: false }), false)
})

test('opting out deletes nothing', async () => {
  // The whole safety argument. Switching back has to restore the work, so the
  // flag must be the only thing that changes.
  const before = await withWorkedExample()
  const off = setIncludeWorkedExample(before, false)
  const backOn = setIncludeWorkedExample(off, true)

  assert.equal(off.scenario.audience.en, 'New staff in their first week')
  assert.equal(off.steps[0].narrative.why.en.text, 'Step 1 matters because of X')

  const strip = (x) => JSON.stringify(x, (k, v) => (v instanceof Uint8Array ? '<bytes>' : v))
  assert.equal(strip(backOn), strip(before), 'off then on is the identity')
})

test('unreviewed drafts stop being blockers when it is switched off', async () => {
  let c = await exportReady()
  c = setNarrative(c, 1, 'why', 'en', 'A drafted explanation', { drafted: true })

  assert.equal(caseStudyReadiness(c, c.languages).ready, false, 'blocked while included')
  const off = setIncludeWorkedExample(c, false)
  assert.deepEqual(caseStudyReadiness(off, off.languages), { ready: true, blockers: [] })
})

test("the step's single verification check stops asking about the prose", async () => {
  let c = await exportReady()
  c = setNarrative(c, 1, 'why', 'en', 'A drafted explanation', { drafted: true })

  const on = stepVerification(c, 1, c.languages)
  assert.ok(on.items.some((i) => i.kind === 'narrative'), 'asks while included')

  const off = stepVerification(setIncludeWorkedExample(c, false), 1, c.languages)
  assert.equal(off.items.filter((i) => i.kind === 'narrative').length, 0)
  assert.ok(off.items.some((i) => i.kind === 'alt'), 'alt text is still required')
})

test('alt text and step text are still mandatory with it switched off', async () => {
  // The point is to drop ONE artifact, not to weaken the accessibility gate.
  const bare = setIncludeWorkedExample(
    await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS })),
    false
  )
  const { ready, blockers } = exportReadiness(bare, bare.languages)
  assert.equal(ready, false)
  assert.ok(blockers.some((b) => b.code === 'ALT_UNCONFIRMED'))
})

test('the translation prompt drops the scenario and the explanations', async () => {
  const on = await withWorkedExample()
  const off = setIncludeWorkedExample(on, false)

  const kinds = (c) => new Set(collectTranslatable(c).map((i) => i.kind))
  assert.deepEqual(kinds(on), new Set(['title', 'scenario', 'step', 'alt', 'narrative']))
  assert.deepEqual(kinds(off), new Set(['title', 'step', 'alt']), 'steps and alt still travel')
})

test('the all-in-one drops the card and the panel, keeping the rest', async () => {
  const off = setIncludeWorkedExample(await withWorkedExample(), false)
  const doc = open(await emitAllInOne(off, { languages: ['en', 'fr'] }))

  assert.equal(doc.getElementById('panel-worked-example'), null, 'no worked-example panel')
  assert.ok(doc.getElementById('panel-walkthrough'), 'walkthrough survives')
  assert.ok(doc.getElementById('panel-quick-reference'), 'quick reference survives')
  assert.equal(
    doc.querySelectorAll('a[href="#panel-worked-example"]').length,
    0,
    'and nothing links to it'
  )
  assert.equal(doc.querySelectorAll('.aio-grid > li').length, 3, 'three cards, not four')
})

test('the all-in-one builds even when there is no narrative at all', async () => {
  // emitCaseStudy refuses a capture with no explanations, so building it
  // unconditionally would throw on exactly the captures that opted out.
  const bare = setIncludeWorkedExample(await exportReady(), false)
  const html = await emitAllInOne(bare, { languages: ['en'] })
  assert.match(html, /^<!doctype html>/i)
  assert.equal(open(html).getElementById('panel-worked-example'), null)
})

test('the choice survives the project-file round trip', async () => {
  const off = setIncludeWorkedExample(await withWorkedExample(), false)
  const back = parse(emitProject(off))
  assert.equal(back.includeWorkedExample, false)
  // Still there to come back to.
  assert.equal(back.steps[0].narrative.why.en.text, 'Step 1 matters because of X')
  assert.equal(back.scenario.audience.en, 'New staff in their first week')
})

test('a project file without the attribute keeps its worked example', async () => {
  const html = emitProject(await withWorkedExample()).replace(
    / data-include-worked-example="[^"]*"/,
    ''
  )
  assert.equal(parse(html).includeWorkedExample, true)
})

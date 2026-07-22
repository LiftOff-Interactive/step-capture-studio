/**
 * The project file's one real contract: a capture that goes out must come back.
 *
 * `emit-project.js` and `parse-project.js` are a matched pair, and nothing else
 * enforces that they agree. These tests are what stops one drifting from the
 * other — every field the model carries is asserted through a full round trip,
 * including the state that has no visible form (confirmation, decorative,
 * drafted), because that is exactly what a rendered-HTML format is prone to
 * losing.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { JSDOM } from 'jsdom'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, setAltText, verifyStep, setDecorative } from '../src/lib/authoring.js'
import { setNarrative, setScenario, confirmNarrative } from '../src/lib/case-study.js'
import { emitProject } from '../src/lib/emit-project.js'
import { parseProject, ProjectError } from '../src/lib/parse-project.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const { DOMParser } = new JSDOM().window
const load = () => parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))
const roundTrip = (capture) => parseProject(emitProject(capture), DOMParser)

/** A capture with every field populated — the hard case, not the empty one. */
async function authored() {
  let capture = seedAltText(await load())
  const languages = capture.languages

  for (const step of capture.steps) {
    for (const image of step.images) {
      for (const lang of languages) {
        capture = setAltText(capture, step.index, image.id, lang, `alt ${lang} for ${image.id}`)
      }
    }
    for (const lang of languages) {
      capture = setNarrative(capture, step.index, 'why', lang, `why ${step.index} ${lang}`)
    }
  }
  capture = setScenario(capture, 'audience', 'en', 'Staff testing audio')
  capture = setScenario(capture, 'audience', 'fr', 'Personnel testant le son')
  return capture
}

// ------------------------------------------------------------- round trip ---

test('capture metadata survives the round trip', async () => {
  const before = await authored()
  const after = roundTrip(before)

  assert.deepEqual(after.title, before.title)
  assert.equal(after.author, before.author)
  assert.equal(after.date, before.date)
  assert.equal(after.sourceLang, before.sourceLang)
  assert.deepEqual(after.languages, before.languages)
  assert.equal(after.steps.length, before.steps.length)
})

test('step text survives in every language', async () => {
  const before = await authored()
  const after = roundTrip(before)

  for (const [i, step] of before.steps.entries()) {
    for (const lang of before.languages) {
      assert.equal(after.steps[i].text[lang], step.text[lang], `step ${step.index} ${lang}`)
    }
  }
})

test('screenshots survive byte-identically', async () => {
  const before = await authored()
  const after = roundTrip(before)

  for (const [i, step] of before.steps.entries()) {
    for (const [j, image] of step.images.entries()) {
      const restored = after.steps[i].images[j]
      assert.equal(restored.id, image.id)
      assert.equal(restored.width, image.width)
      assert.equal(restored.height, image.height)
      assert.deepEqual(
        [...restored.bytes],
        [...image.bytes],
        `image ${image.id} must not be re-encoded`
      )
    }
  }
})

test('alt text and its confirmation state both survive', async () => {
  // The whole reason this format keeps state in data attributes. A rendered
  // page shows alt text but not whether anyone confirmed it; losing that would
  // silently reopen the export gate on every import.
  let before = await authored()
  for (const step of before.steps) before = verifyStep(before, step.index, before.languages)

  const after = roundTrip(before)

  for (const [i, step] of before.steps.entries()) {
    for (const [j, image] of step.images.entries()) {
      const restored = after.steps[i].images[j]
      for (const lang of before.languages) {
        assert.equal(restored.alt[lang], image.alt[lang], `alt ${image.id} ${lang}`)
        assert.equal(
          restored.altConfirmed[lang],
          true,
          `confirmation for ${image.id} ${lang} must survive import`
        )
      }
    }
  }
})

test('unconfirmed alt text comes back unconfirmed, never quietly confirmed', async () => {
  const before = await authored() // authored but never verified
  const after = roundTrip(before)

  for (const step of after.steps) {
    for (const image of step.images) {
      for (const lang of after.languages) {
        assert.equal(image.altConfirmed[lang], false, 'import must not invent a confirmation')
      }
    }
  }
})

test('decorative images survive as decorative', async () => {
  let before = await authored()
  const imageId = before.steps[0].images[0].id
  before = setDecorative(before, 1, imageId, true)

  const after = roundTrip(before)
  assert.equal(after.steps[0].images[0].decorative, true)
  assert.equal(after.steps[1].images[0].decorative, false)
})

test('drafted narrative stays drafted, and reviewed stays reviewed', async () => {
  // The distinction the case study's whole review gate rests on. If import
  // flattened it, unreviewed machine prose could reach a published artifact.
  let before = await authored()
  before = setNarrative(before, 1, 'ifSkipped', 'en', 'machine draft', { drafted: true })
  before = setNarrative(before, 2, 'ifSkipped', 'en', 'machine draft two', { drafted: true })
  before = confirmNarrative(before, 2, 'ifSkipped', 'en')

  const after = roundTrip(before)

  assert.equal(after.steps[0].narrative.ifSkipped.en.text, 'machine draft')
  assert.equal(after.steps[0].narrative.ifSkipped.en.drafted, true, 'a draft must stay a draft')
  assert.equal(after.steps[1].narrative.ifSkipped.en.drafted, false, 'a review must stay a review')
})

test('the scenario block survives in both languages', async () => {
  const before = await authored()
  const after = roundTrip(before)

  assert.equal(after.scenario.audience.en, 'Staff testing audio')
  assert.equal(after.scenario.audience.fr, 'Personnel testant le son')
})

// ------------------------------------------------------- hand-editability ---

test('editing the prose in a text editor changes what is imported', async () => {
  // This is the entire point of a rendered-HTML format over a hidden state
  // blob. If this test fails, the format has no reason to exist.
  const before = await authored()
  const edited = emitProject(before).replace(
    '>alt en for rId4<',
    '>a completely rewritten description<'
  )
  const after = parseProject(edited, DOMParser)

  const restored = after.steps
    .flatMap((step) => step.images)
    .map((image) => image.alt.en)
  assert.ok(
    restored.includes('a completely rewritten description'),
    'a hand edit to the visible text must come back'
  )
})

test('deleting a step by hand renumbers rather than leaving a gap', async () => {
  const before = await authored()
  const html = emitProject(before)

  // Remove the first step element wholesale, as a person with an editor would.
  const start = html.indexOf('<li class="project-step"')
  const end = html.indexOf('<li class="project-step"', start + 1)
  const after = parseProject(html.slice(0, start) + html.slice(end), DOMParser)

  assert.equal(after.steps.length, before.steps.length - 1)
  assert.deepEqual(
    after.steps.map((step) => step.index),
    after.steps.map((_, i) => i + 1),
    'indexes must stay contiguous or the rest of the app breaks'
  )
})

// -------------------------------------------------------------- refusals ---

test('a file that is not a project file is refused, not half-imported', () => {
  assert.throws(
    () => parseProject('<!doctype html><html><body><p>hello</p></body></html>', DOMParser),
    (error) => error instanceof ProjectError && error.code === 'PROJECT_NOT_RECOGNISED'
  )
})

test('one of our own artifacts is refused — it is not a project file', async () => {
  const { emitQuickSteps } = await import('../src/lib/emit-quick-steps.js')
  let capture = await authored()
  for (const step of capture.steps) capture = verifyStep(capture, step.index, capture.languages)

  assert.throws(
    () => parseProject(emitQuickSteps(capture), DOMParser),
    (error) => error instanceof ProjectError && error.code === 'PROJECT_NOT_RECOGNISED'
  )
})

test('a project file with no steps is refused', async () => {
  const html = emitProject(await authored()).replace(/class="project-step"/g, 'class="gone"')
  assert.throws(
    () => parseProject(html, DOMParser),
    (error) => error instanceof ProjectError && error.code === 'PROJECT_NO_STEPS'
  )
})

test('the emitted file is self-contained — no external request of any kind', async () => {
  const html = emitProject(await authored())
  assert.ok(!/<script/i.test(html), 'a project file needs no script at all')
  assert.ok(!/src="(?!data:)/i.test(html), 'every image must be inlined')
  assert.ok(!/https?:\/\//i.test(html), 'no external reference')
})

// -------------------------------------------------------- bilingual title ---

test('a title authored in both languages survives the round trip', async () => {
  const { setTitle } = await import('../src/lib/authoring.js')
  let before = await authored()
  before = setTitle(before, 'en', 'Testing Windows Audio')
  before = setTitle(before, 'fr', 'Test du son de Windows')

  const after = roundTrip(before)
  assert.equal(after.title.en, 'Testing Windows Audio')
  assert.equal(after.title.fr, 'Test du son de Windows')
})

test('an untranslated title comes back empty, not filled with the fallback', async () => {
  // The artifacts fall back to the source language so a French guide is never
  // headed "Untitled capture". The project file must NOT bake that fallback in,
  // or a title the author never wrote would become one they apparently did.
  const { setTitle } = await import('../src/lib/authoring.js')
  let before = await authored()
  before = setTitle(before, 'en', 'Only English')

  const after = roundTrip(before)
  assert.equal(after.title.en, 'Only English')
  assert.equal(after.title.fr, null, 'the French title was never written and must stay empty')
})

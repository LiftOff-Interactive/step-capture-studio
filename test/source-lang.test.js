/**
 * Tests for correcting a capture's source language.
 *
 * The load-bearing tests here are the two that make this worth having: that the
 * text actually MOVES rather than being relabelled, and that the swap refuses to
 * run over authored work. Everything else is shape hygiene.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, confirmAltText, setStepText, setAltText } from '../src/lib/authoring.js'
import { setNarrative, setScenario } from '../src/lib/case-study.js'
import { buildTranslationPrompt } from '../src/lib/translate.js'
import { setSourceLang, sourceLangReadiness, SourceLangError } from '../src/lib/source-lang.js'
import { makeCapture, FRENCH_STEPS, ENGLISH_STEPS } from './helpers/synthetic.mjs'

/** A French capture as the app loads it today: parsed with the default 'en'. */
const frenchAsEnglish = () =>
  parseSnagitDocx(makeCapture({ steps: FRENCH_STEPS, title: 'Microsoft Edge' }))

test('the French capture really does arrive filed as English', async () => {
  // Not a test of this module — a test of the premise it exists for. If the
  // load path ever starts passing a real sourceLang, this is where that shows.
  const c = await frenchAsEnglish()
  assert.equal(c.sourceLang, 'en')
  assert.equal(c.steps[0].text.en, FRENCH_STEPS[0])
  assert.equal(c.steps[0].text.fr, null)
})

test('correcting the source language moves the text, it does not relabel it', async () => {
  const corrected = setSourceLang(await frenchAsEnglish(), 'fr')

  assert.equal(corrected.sourceLang, 'fr')
  for (const [i, step] of corrected.steps.entries()) {
    assert.equal(step.text.fr, FRENCH_STEPS[i], 'French text is under fr')
    assert.equal(step.text.en, null, 'and no longer masquerading as English')
  }
})

test('the translation round trip then runs the right way', async () => {
  // The point of the whole feature. Before correcting, the prompt asks for
  // en -> fr and is handed French; after, it asks for fr -> en.
  const before = buildTranslationPrompt(await frenchAsEnglish())
  const after = buildTranslationPrompt(setSourceLang(await frenchAsEnglish(), 'fr'))

  const text = (p) => (typeof p === 'string' ? p : p.prompt)
  assert.match(text(before), /from Canadian English \(en-CA\) to Canadian French \(fr-CA\)/)
  assert.match(text(after), /from Canadian French \(fr-CA\) to Canadian English \(en-CA\)/)
})

test('the title, scenario, alt text and narrative all travel with it', async () => {
  let c = await frenchAsEnglish()
  c = seedAltText(c)
  c = confirmAltText(c, 1, c.steps[0].images[0].id, 'en')
  c = setScenario(c, 'audience', 'en', 'Nouveau personnel')
  c = setNarrative(c, 1, 'why', 'en', 'Parce que la barre des tâches est toujours là')

  const imageId = c.steps[0].images[0].id
  const seededAlt = c.steps[0].images[0].alt.en
  const corrected = setSourceLang(c, 'fr')

  assert.equal(corrected.title.fr, 'Microsoft Edge')
  assert.equal(corrected.title.en, null)
  assert.equal(corrected.scenario.audience.fr, 'Nouveau personnel')
  assert.equal(corrected.scenario.audience.en, null)

  const image = corrected.steps[0].images.find((i) => i.id === imageId)
  assert.equal(image.alt.fr, seededAlt, 'alt text follows')
  assert.equal(image.alt.en, null)
  assert.equal(image.altConfirmed.fr, true, 'and so does its confirmation')
  assert.equal(image.altConfirmed.en, false)

  assert.equal(corrected.steps[0].narrative.why.fr.text, 'Parce que la barre des tâches est toujours là')
  assert.equal(corrected.steps[0].narrative.why.en.text, null)
})

test('an empty narrative slot keeps its shape rather than becoming null', async () => {
  // Every consumer is promised {text, drafted}. Writing null instead would only
  // surface later, in whichever emitter read it first.
  const corrected = setSourceLang(await frenchAsEnglish(), 'fr')
  const passage = corrected.steps[0].narrative.why.en
  assert.deepEqual(passage, { text: null, drafted: false })
})

test('it refuses to swap over work already written in the target language', async () => {
  // The exchange is lossless, which is exactly the danger: authored French would
  // come back out labelled English and read as nonsense.
  let c = await frenchAsEnglish()
  c = setStepText(c, 1, 'fr', 'Une traduction déjà écrite à la main')

  const { ready, blockers } = sourceLangReadiness(c, 'fr')
  assert.equal(ready, false)
  assert.equal(blockers[0].code, 'STEP_TEXT_IN_TARGET')
  assert.equal(blockers[0].stepIndex, 1)

  assert.throws(() => setSourceLang(c, 'fr'), (error) => {
    assert.ok(error instanceof SourceLangError)
    assert.equal(error.code, 'TARGET_NOT_EMPTY')
    assert.equal(error.blockers.length, 1)
    return true
  })
})

test('confirmed alt text in the target language blocks it too, even with no text', async () => {
  // altConfirmed is authored state in its own right; losing track of which
  // language was reviewed is what the accessibility gate exists to prevent.
  let c = await frenchAsEnglish()
  const imageId = c.steps[0].images[0].id
  c = setAltText(c, 1, imageId, 'fr', 'Capture')
  c = confirmAltText(c, 1, imageId, 'fr')

  const { ready, blockers } = sourceLangReadiness(c, 'fr')
  assert.equal(ready, false)
  assert.ok(blockers.some((b) => b.code === 'ALT_IN_TARGET'))
})

test('setting it to the language it already is changes nothing', async () => {
  const c = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))
  assert.equal(sourceLangReadiness(c, 'en').ready, true)
  assert.equal(setSourceLang(c, 'en'), c, 'the same object, not a copy')
})

test('an unknown language is refused', async () => {
  const c = await frenchAsEnglish()
  assert.equal(sourceLangReadiness(c, 'de').ready, false)
  assert.throws(() => setSourceLang(c, 'de'), /UNKNOWN_LANGUAGE/)
})

test('it never mutates the capture it was given', async () => {
  const c = await frenchAsEnglish()
  const before = JSON.stringify(c, (k, v) => (v instanceof Uint8Array ? '<bytes>' : v))
  setSourceLang(c, 'fr')
  const after = JSON.stringify(c, (k, v) => (v instanceof Uint8Array ? '<bytes>' : v))
  assert.equal(before, after)
})

test('correcting and correcting back is the identity', async () => {
  const c = await frenchAsEnglish()
  const roundTripped = setSourceLang(setSourceLang(c, 'fr'), 'en')
  const strip = (x) => JSON.stringify(x, (k, v) => (v instanceof Uint8Array ? '<bytes>' : v))
  assert.equal(strip(roundTripped), strip(c))
})

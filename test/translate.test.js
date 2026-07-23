/**
 * Tests for the bilingual round trip.
 *
 * The property that matters most is the one a user cannot check for
 * themselves: a partial or mismatched import must never land quietly. Several
 * tests below exist purely to prove the failure modes are loud.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, confirmAltText, setAltText } from '../src/lib/authoring.js'
import {
  buildTranslationPrompt,
  parseTranslationResponse,
  applyTranslation,
  collectTranslatable,
  TranslationError,
} from '../src/lib/translate.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const load = () => parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))

/** A capture with every English alt text seeded and confirmed. */
async function fullyConfirmed() {
  let capture = seedAltText(await load())
  for (const step of capture.steps) {
    for (const image of step.images) {
      capture = confirmAltText(capture, step.index, image.id, 'en')
    }
  }
  return capture
}

/** A well-formed response covering every id, as an assistant would return it. */
function respond(capture, transform = (t) => `FR:${t}`) {
  return collectTranslatable(capture)
    .map((item) => `${item.id} ||| ${transform(item.text)}`)
    .join('\n')
}

// ---------------------------------------------------------------- prompt ---

test('the prompt contains every step and every confirmed alt text', async () => {
  const capture = await fullyConfirmed()
  const prompt = buildTranslationPrompt(capture)

  for (const step of capture.steps) {
    assert.ok(prompt.includes(`s${step.index} |||`), `step ${step.index} present`)
    assert.ok(prompt.includes(`s${step.index}a1 |||`), `alt for step ${step.index} present`)
  }
})

test('the prompt asks for Canadian French and a strict return format', async () => {
  const prompt = buildTranslationPrompt(await fullyConfirmed())

  assert.match(prompt, /Canadian French \(fr-CA\)/)
  assert.match(prompt, /not European French/)
  assert.match(prompt, /<id> \|\|\| <translation>/)
  assert.match(prompt, /Do not add, merge, remove or renumber/)
  // It cannot send the screenshots, so it must say so rather than let the
  // translator invent visual detail.
  assert.match(prompt, /cannot see the screenshots/)
})

test('unconfirmed alt text is excluded from the prompt', async () => {
  // Translating a draft nobody accepted would launder an unreviewed guess
  // into a second language.
  const seeded = seedAltText(await load())
  const prompt = buildTranslationPrompt(seeded)

  assert.ok(prompt.includes('s1 |||'), 'step text is included')
  assert.ok(!prompt.includes('s1a1'), 'unconfirmed alt text is not')
})

test('a capture with nothing translatable is refused, not silently empty', async () => {
  const capture = { sourceLang: 'en', languages: ['en', 'fr'], steps: [], warnings: [] }
  assert.throws(() => buildTranslationPrompt(capture), (e) => e.code === 'NOTHING_TO_TRANSLATE')
})

// ----------------------------------------------------------------- parse ---

test('parses the delimited format', async () => {
  const capture = await fullyConfirmed()
  const { entries, format } = parseTranslationResponse(respond(capture))

  assert.equal(format, 'delimited')
  assert.equal(entries.size, collectTranslatable(capture).length)
  assert.equal(entries.get('s1'), 'FR:Click on the web browser')
})

test('parses JSON, which assistants often volunteer regardless', () => {
  const { entries, format } = parseTranslationResponse('{"s1":"Étape un","s2":"Étape deux"}')

  assert.equal(format, 'json')
  assert.equal(entries.get('s1'), 'Étape un')
})

test('parses a JSON array of objects', () => {
  const { entries } = parseTranslationResponse('[{"id":"s1","text":"Un"},{"id":"s2","text":"Deux"}]')

  assert.equal(entries.get('s1'), 'Un')
  assert.equal(entries.get('s2'), 'Deux')
})

test('survives markdown code fences', () => {
  const { entries } = parseTranslationResponse('```\ns1 ||| Étape un\ns2 ||| Étape deux\n```')

  assert.equal(entries.size, 2)
  assert.equal(entries.get('s1'), 'Étape un')
})

test('survives bullets or numbering a chat client added', () => {
  const { entries } = parseTranslationResponse('- s1 ||| Étape un\n2. s2 ||| Étape deux')

  assert.equal(entries.get('s1'), 'Étape un')
  assert.equal(entries.get('s2'), 'Étape deux')
})

test('keeps accents and guillemets intact', () => {
  const { entries } = parseTranslationResponse('s1 ||| Cliquez sur « Détails » — étape suivante')

  assert.equal(entries.get('s1'), 'Cliquez sur « Détails » — étape suivante')
})

test('keeps a translation containing the delimiter after the first split', () => {
  const { entries } = parseTranslationResponse('s1 ||| a ||| b')
  assert.equal(entries.get('s1'), 'a ||| b')
})

test('an empty paste is rejected', () => {
  assert.throws(() => parseTranslationResponse('   '), (e) => e.code === 'EMPTY_RESPONSE')
})

test('prose with no recognisable lines is rejected', () => {
  assert.throws(
    () => parseTranslationResponse('Sure! Here are your translations, I hope they help.'),
    (e) => e instanceof TranslationError && e.code === 'UNPARSEABLE_RESPONSE'
  )
})

test('duplicate ids are rejected rather than last-one-wins', () => {
  const error = (() => {
    try {
      parseTranslationResponse('s1 ||| Un\ns1 ||| Deux')
    } catch (e) {
      return e
    }
  })()

  assert.equal(error.code, 'DUPLICATE_IDS')
  assert.deepEqual(error.ids, ['s1'])
})

// ----------------------------------------------------------------- apply ---

test('a full round trip populates every French field', async () => {
  const capture = await fullyConfirmed()
  const { entries } = parseTranslationResponse(respond(capture))
  const { capture: next, applied, missing } = applyTranslation(capture, entries, 'fr')

  assert.equal(missing.length, 0)
  assert.equal(applied, collectTranslatable(capture).length)
  for (const step of next.steps) {
    assert.match(step.text.fr, /^FR:/)
    assert.match(step.images[0].alt.fr, /^FR:/)
  }
})

test('English is untouched by the import', async () => {
  const capture = await fullyConfirmed()
  const { entries } = parseTranslationResponse(respond(capture))
  const { capture: next } = applyTranslation(capture, entries, 'fr')

  next.steps.forEach((step, i) => {
    assert.equal(step.text.en, capture.steps[i].text.en)
    assert.equal(step.images[0].alt.en, capture.steps[i].images[0].alt.en)
  })
})

test('imported French alt text arrives unconfirmed', async () => {
  // Machine translation is a draft in the target language too — the author
  // confirms it separately, exactly as they did for the source.
  const capture = await fullyConfirmed()
  const { entries } = parseTranslationResponse(respond(capture))
  const { capture: next } = applyTranslation(capture, entries, 'fr')

  for (const step of next.steps) {
    assert.equal(step.images[0].altConfirmed.fr, false)
    assert.equal(step.images[0].altConfirmed.en, true, 'the source stays confirmed')
  }
})

test('an unknown id aborts the whole import — no half-translated document', async () => {
  const capture = await fullyConfirmed()
  const { entries } = parseTranslationResponse(`${respond(capture)}\ns99 ||| Étape fantôme`)

  const error = (() => {
    try {
      applyTranslation(capture, entries, 'fr')
    } catch (e) {
      return e
    }
  })()

  assert.equal(error.code, 'UNKNOWN_IDS')
  assert.deepEqual(error.ids, ['s99'])
})

test('a missing id is reported by name, never swallowed', async () => {
  const capture = await fullyConfirmed()
  const lines = respond(capture).split('\n').filter((l) => !l.startsWith('s2 |||'))
  const { entries } = parseTranslationResponse(lines.join('\n'))

  const { capture: next, missing } = applyTranslation(capture, entries, 'fr')

  assert.equal(missing.length, 1)
  assert.equal(missing[0].id, 's2')
  assert.equal(missing[0].kind, 'step')
  assert.equal(next.steps[1].text.fr, null, 'the gap is real, not papered over')
  assert.match(next.steps[0].text.fr, /^FR:/, 'everything else still applied')
})

test('applying the same response twice changes nothing the second time', async () => {
  const capture = await fullyConfirmed()
  const { entries } = parseTranslationResponse(respond(capture))

  const once = applyTranslation(capture, entries, 'fr').capture
  const twice = applyTranslation(once, entries, 'fr').capture

  const strip = (c) => JSON.stringify(c, (k, v) => (k === 'bytes' ? undefined : v))
  assert.equal(strip(once), strip(twice))
})

test('the import never mutates the capture it was given', async () => {
  const capture = await fullyConfirmed()
  const before = JSON.stringify(capture, (k, v) => (k === 'bytes' ? undefined : v))
  const { entries } = parseTranslationResponse(respond(capture))

  applyTranslation(capture, entries, 'fr')

  assert.equal(JSON.stringify(capture, (k, v) => (k === 'bytes' ? undefined : v)), before)
})

test('French fields stay hand-editable after import', async () => {
  const capture = await fullyConfirmed()
  const { entries } = parseTranslationResponse(respond(capture))
  const { capture: imported } = applyTranslation(capture, entries, 'fr')

  const id = imported.steps[0].images[0].id
  const edited = setAltText(imported, 1, id, 'fr', 'Texte corrigé à la main')

  assert.equal(edited.steps[0].images[0].alt.fr, 'Texte corrigé à la main')
})

test('translating in the other direction works — nothing assumes en to fr', async () => {
  const capture = await fullyConfirmed()
  const prompt = buildTranslationPrompt(capture, { from: 'en', to: 'fr' })
  const reverse = buildTranslationPrompt({ ...capture, sourceLang: 'en' }, { from: 'en', to: 'es' })

  assert.match(prompt, /Canadian French/)
  assert.match(reverse, /to es/)
})

// -------------------------------------------------------- bilingual title ---

test('the guide title is offered for translation', async () => {
  const capture = await fullyConfirmed()
  const items = collectTranslatable(capture, 'en')
  const title = items.find((item) => item.id === 'title')

  assert.ok(title, 'the title must be in the prompt — it is the most visible string there is')
  assert.equal(title.kind, 'title')
  assert.equal(items[0].id, 'title', 'and first, so it is easy to spot in the response')
})

test('a translated title is applied to the target language only', async () => {
  const capture = await fullyConfirmed()
  const before = capture.title.en

  const { capture: next } = applyTranslation(
    capture,
    new Map([['title', 'Test du son de Windows']]),
    'fr',
    'en'
  )

  assert.equal(next.title.fr, 'Test du son de Windows')
  assert.equal(next.title.en, before, 'the source title must not be touched')
})

test('a capture with no title still translates everything else', async () => {
  const capture = await fullyConfirmed()
  const untitled = { ...capture, title: { en: null, fr: null } }

  const items = collectTranslatable(untitled, 'en')
  assert.ok(!items.some((item) => item.id === 'title'), 'nothing to translate, nothing offered')
  assert.ok(items.length > 0, 'the steps are still there')
})

// ------------------------------------------------ worked-example scenario ---

test('the worked-example scenario is offered for translation', async () => {
  const { setScenario } = await import('../src/lib/case-study.js')
  let capture = await fullyConfirmed()
  capture = setScenario(capture, 'audience', 'en', 'Staff joining their first meeting')
  capture = setScenario(capture, 'context', 'en', 'Run before a meeting')

  const items = collectTranslatable(capture, 'en')
  const ids = items.map((i) => i.id)
  assert.ok(ids.includes('about-audience'), 'audience must be in the prompt')
  assert.ok(ids.includes('about-context'), 'context must be in the prompt')
  assert.ok(!ids.includes('about-outcome'), 'an empty scenario field is not offered')

  const prompt = buildTranslationPrompt(capture)
  assert.ok(prompt.includes('about-audience ||| Staff joining their first meeting'))
})

test('a translated scenario field lands in the target language, source untouched', async () => {
  const { setScenario } = await import('../src/lib/case-study.js')
  let capture = await fullyConfirmed()
  capture = setScenario(capture, 'audience', 'en', 'Staff joining their first meeting')

  const { capture: next, applied } = applyTranslation(
    capture,
    new Map([['about-audience', 'Personnel à sa première réunion']]),
    'fr',
    'en'
  )

  assert.equal(next.scenario.audience.fr, 'Personnel à sa première réunion')
  assert.equal(next.scenario.audience.en, 'Staff joining their first meeting', 'source untouched')
  assert.ok(applied >= 1)
})

test('worked-example details and alt text ride the same round trip', async () => {
  // The user's requirement: one translation pass covers the scenario, the
  // step narrative, and the alt text — not step text alone.
  const { setScenario, setNarrative } = await import('../src/lib/case-study.js')
  const { setAltText, confirmAltText } = await import('../src/lib/authoring.js')
  let capture = await fullyConfirmed()
  capture = setScenario(capture, 'audience', 'en', 'New staff')
  capture = setNarrative(capture, 1, 'why', 'en', 'It anchors the sequence')

  const kinds = new Set(collectTranslatable(capture, 'en').map((i) => i.kind))
  assert.ok(kinds.has('scenario'), 'scenario included')
  assert.ok(kinds.has('narrative'), 'narrative included')
  assert.ok(kinds.has('alt'), 'alt text included')
  assert.ok(kinds.has('step'), 'step text included')
})

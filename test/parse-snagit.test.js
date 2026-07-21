/**
 * Tests for the Snagit .docx -> capture model parser.
 *
 * Two properties matter most and are each covered by several tests:
 *   1. Text is the concatenation of ALL runs in a paragraph (Word splits them).
 *   2. Nothing keys off English words — a French capture parses identically.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { makeCapture, ENGLISH_STEPS, FRENCH_STEPS } from './helpers/synthetic.mjs'

const codes = (capture) => capture.warnings.map((w) => w.code)

test('pairs each step with the screenshot that follows it', async () => {
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))

  assert.equal(capture.steps.length, ENGLISH_STEPS.length)
  capture.steps.forEach((step, i) => {
    assert.equal(step.text.en, ENGLISH_STEPS[i], `step ${i + 1} text`)
    assert.equal(step.images.length, 1, `step ${i + 1} has one image`)
    assert.equal(step.images[0].path, `word/media/image${i + 1}.png`)
  })
})

test('strips the numbering prefix and derives index from document order', async () => {
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))

  for (const step of capture.steps) {
    assert.doesNotMatch(step.text.en, /^\d+\s*[.)]/, 'no numbering left in text')
  }
  assert.deepEqual(
    capture.steps.map((s) => s.index),
    [1, 2, 3, 4, 5]
  )
})

test('concatenates every text run in a paragraph', async () => {
  // Regression test for the real bug: Word splits paragraph text across runs,
  // and reading only the first truncates silently.
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS, splitStepRuns: true }))

  assert.equal(capture.steps.length, ENGLISH_STEPS.length)
  capture.steps.forEach((step, i) => {
    assert.equal(step.text.en, ENGLISH_STEPS[i], `step ${i + 1} survived run splitting intact`)
  })
})

test('reads the metadata line even though it spans two runs', async () => {
  const capture = await parseSnagitDocx(
    makeCapture({ steps: ENGLISH_STEPS, author: 'A. Author', duration: '1 minute' })
  )

  assert.equal(capture.author, 'A. Author')
  assert.equal(capture.duration, '1 minute')
  assert.equal(capture.declaredStepCount, ENGLISH_STEPS.length)
  assert.equal(capture.title, 'Microsoft Edge')
  assert.equal(capture.date, 'July 21, 2026')
})

test('parses a French capture identically — no English-verb dependency', async () => {
  const capture = await parseSnagitDocx(makeCapture({ steps: FRENCH_STEPS }), { sourceLang: 'fr' })

  assert.equal(capture.steps.length, FRENCH_STEPS.length)
  capture.steps.forEach((step, i) => {
    assert.equal(step.text.fr, FRENCH_STEPS[i])
    assert.equal(step.text.en, null, 'the other language stays empty')
    assert.equal(step.images.length, 1)
  })
})

test('carries a language map keyed by code, not a hardcoded pair', async () => {
  const capture = await parseSnagitDocx(makeCapture({ steps: ['One step'] }), {
    sourceLang: 'en',
    languages: ['en', 'fr', 'es'],
  })

  assert.deepEqual(Object.keys(capture.steps[0].text).sort(), ['en', 'es', 'fr'])
  assert.deepEqual(Object.keys(capture.steps[0].images[0].alt).sort(), ['en', 'es', 'fr'])
})

test('reads native image dimensions onto every image', async () => {
  const capture = await parseSnagitDocx(
    makeCapture({ steps: ['One step'], width: 1040, height: 596 })
  )

  assert.equal(capture.steps[0].images[0].width, 1040)
  assert.equal(capture.steps[0].images[0].height, 596)
  assert.ok(capture.steps[0].images[0].bytes.length > 0, 'image bytes carried through')
})

test('alt text starts empty — Stage 2 requires the author to supply it', async () => {
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))

  for (const step of capture.steps) {
    for (const image of step.images) {
      assert.deepEqual(image.alt, { en: null, fr: null })
    }
  }
})

test('preserves duplicate consecutive steps and flags them', async () => {
  // The real sample repeats 'Click "My courses"'. The parser reports;
  // it never merges. Merging is the authoring layer's job, and only on request.
  const capture = await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))

  assert.equal(capture.steps.length, 5, 'duplicates are NOT collapsed')
  assert.equal(capture.steps[2].text.en, capture.steps[3].text.en)

  const duplicates = capture.warnings.filter((w) => w.code === 'DUPLICATE_STEP_TEXT')
  assert.equal(duplicates.length, 1)
  assert.equal(duplicates[0].stepIndex, 4)
})

test('flags a step with no screenshot instead of dropping it', async () => {
  const capture = await parseSnagitDocx(
    makeCapture({ steps: ['Only step'], orphanText: true, declaredStepCount: 2 })
  )

  assert.equal(capture.steps.length, 2, 'the text-only step is kept')
  assert.equal(capture.steps[1].images.length, 0)
  assert.ok(codes(capture).includes('STEP_WITHOUT_IMAGE'))
})

test('keeps a trailing image by attaching it to the last step', async () => {
  const capture = await parseSnagitDocx(makeCapture({ steps: ['Only step'], orphanImage: true }))

  assert.equal(capture.steps.length, 1)
  assert.equal(capture.steps[0].images.length, 2, 'both images kept on the last step')
  assert.deepEqual(codes(capture), [], 'a trailing image is not an error')
})

test('flags an image appearing before any step instead of dropping it', async () => {
  const capture = await parseSnagitDocx(makeCapture({ steps: ['Only step'], leadingImage: true }))

  const allImages = capture.steps.flatMap((s) => s.images)
  assert.equal(allImages.length, 2, 'the orphan image is preserved, not dropped')
  assert.ok(codes(capture).includes('ORPHAN_IMAGE'), 'and it is flagged')

  const orphanStep = capture.steps.find((s) => s.text.en === null)
  assert.ok(orphanStep, 'orphan is held in a step with no text')
  assert.equal(orphanStep.images.length, 1)
})

test('flags a mismatch between the declared and actual step count', async () => {
  const capture = await parseSnagitDocx(
    makeCapture({ steps: ENGLISH_STEPS, declaredStepCount: 99 })
  )

  const mismatch = capture.warnings.find((w) => w.code === 'STEP_COUNT_MISMATCH')
  assert.ok(mismatch, 'mismatch reported')
  assert.match(mismatch.detail, /99/)
})

test('a clean capture produces no warnings', async () => {
  const capture = await parseSnagitDocx(
    makeCapture({ steps: ['Open the portal', 'Sign in', 'Choose a course'] })
  )

  assert.deepEqual(capture.warnings, [], 'no false positives on a well-formed capture')
})

test('preserves accented characters through the whole pipeline', async () => {
  const capture = await parseSnagitDocx(
    makeCapture({ steps: ['Cliquez sur « Français »', 'Sélectionnez « Détails »'] }),
    { sourceLang: 'fr' }
  )

  assert.equal(capture.steps[0].text.fr, 'Cliquez sur « Français »')
  assert.equal(capture.steps[1].text.fr, 'Sélectionnez « Détails »')
})

test('unescapes XML entities in step text', async () => {
  const capture = await parseSnagitDocx(makeCapture({ steps: ['Click "Save & Close" <now>'] }))

  assert.equal(capture.steps[0].text.en, 'Click "Save & Close" <now>')
})

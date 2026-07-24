/**
 * Tests for the authoring layer.
 *
 * Two invariants get the most attention because breaking either is silent and
 * damaging:
 *   1. Operations are immutable — the input capture is never mutated.
 *   2. Alt text cannot reach "confirmed" without a deliberate act.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import {
  setStepText,
  mergeStepIntoPrevious,
  deleteStep,
  duplicatePairs,
  seedAltText,
  setAltText,
  confirmAltText,
  setDecorative,
  replaceImage,
  exportReadiness,
  stepVerification,
  verifyStep,
  unverifyStep,
} from '../src/lib/authoring.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const load = (options = {}) => parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS, ...options }))
const firstImageId = (capture, step = 1) => capture.steps[step - 1].images[0].id

// ------------------------------------------------------------ immutability ---

test('operations never mutate the input capture', async () => {
  const original = await load()
  const snapshot = JSON.stringify(original, (k, v) => (k === 'bytes' ? undefined : v))

  setStepText(original, 1, 'en', 'changed')
  deleteStep(original, 2)
  mergeStepIntoPrevious(original, 4)
  seedAltText(original)
  setAltText(original, 1, firstImageId(original), 'en', 'x')
  setDecorative(original, 1, firstImageId(original), true)

  assert.equal(
    JSON.stringify(original, (k, v) => (k === 'bytes' ? undefined : v)),
    snapshot,
    'input is untouched after every operation'
  )
})

test('image bytes are shared by reference, not copied', async () => {
  const capture = await load()
  const edited = setStepText(capture, 1, 'en', 'changed')

  assert.equal(
    edited.steps[0].images[0].bytes,
    capture.steps[0].images[0].bytes,
    'same Uint8Array instance — screenshots are large and never modified'
  )
})

// ------------------------------------------------------------ step editing ---

test('setStepText updates one language and leaves the other alone', async () => {
  const capture = await load()
  const edited = setStepText(capture, 2, 'fr', 'Cliquez sur « English »')

  assert.equal(edited.steps[1].text.fr, 'Cliquez sur « English »')
  assert.equal(edited.steps[1].text.en, ENGLISH_STEPS[1], 'English untouched')
})

test('clearing text to an empty string stores null, not ""', async () => {
  const capture = await load()
  const edited = setStepText(capture, 1, 'en', '')

  assert.equal(edited.steps[0].text.en, null, 'empty means absent, so readiness catches it')
})

test('duplicatePairs finds exactly the real duplicates', async () => {
  const capture = await load()
  const pairs = duplicatePairs(capture)

  assert.equal(pairs.length, 1)
  assert.deepEqual(
    { keep: pairs[0].keep, merge: pairs[0].merge },
    { keep: 3, merge: 4 },
    'points at the pair, naming which to keep'
  )
})

test('duplicatePairs reports nothing on a clean capture', async () => {
  const capture = await parseSnagitDocx(makeCapture({ steps: ['Open', 'Sign in', 'Choose'] }))
  assert.deepEqual(duplicatePairs(capture), [])
})

test('merging keeps ONE screenshot (the survivor’s) and renumbers', async () => {
  // Merge collapses a duplicate into the previous step: one text, one image.
  // Keeping both produced a merged step with two near-identical screenshots in
  // the HTML and the .docx — the redundancy the author merges to remove.
  const capture = await load()
  const survivorImage = capture.steps[2].images[0].id
  const merged = mergeStepIntoPrevious(capture, 4)

  assert.equal(merged.steps.length, ENGLISH_STEPS.length - 1)
  assert.equal(merged.steps[2].images.length, 1, 'only the survivor’s screenshot remains')
  assert.equal(merged.steps[2].images[0].id, survivorImage, 'and it is the previous step’s')
  assert.deepEqual(
    merged.steps.map((s) => s.index),
    [1, 2, 3, 4],
    'indexes re-derived from position'
  )
  assert.equal(merged.steps[2].text.en, 'Click "My courses"')
})

test('merging falls back to the later step’s image when the survivor has none', async () => {
  // The survivor keeps its own image; only if it has none does the absorbed
  // step’s image fill in — so a merge never leaves a step with zero images.
  let capture = await load()
  const laterImage = capture.steps[3].images[0].id
  capture = { ...capture, steps: capture.steps.map((s, i) => (i === 2 ? { ...s, images: [] } : s)) }
  const merged = mergeStepIntoPrevious(capture, 4)

  assert.equal(merged.steps[2].images.length, 1)
  assert.equal(merged.steps[2].images[0].id, laterImage)
})

test('merging takes a translation from the later step if the earlier lacks one', async () => {
  const capture = setStepText(await load(), 4, 'fr', 'Texte français')
  const merged = mergeStepIntoPrevious(capture, 4)

  assert.equal(merged.steps[2].text.fr, 'Texte français', 'nothing is silently discarded')
})

test('merging refuses when there is no previous step', async () => {
  const capture = await load()
  assert.throws(() => mergeStepIntoPrevious(capture, 1), RangeError)
})

test('deleting renumbers and is undoable by keeping the old object', async () => {
  const capture = await load()
  const afterDelete = deleteStep(capture, 2)

  assert.equal(afterDelete.steps.length, ENGLISH_STEPS.length - 1)
  assert.deepEqual(
    afterDelete.steps.map((s) => s.index),
    [1, 2, 3, 4]
  )
  assert.equal(afterDelete.steps[1].text.en, ENGLISH_STEPS[2], 'step 3 slid into position 2')
  assert.equal(capture.steps.length, ENGLISH_STEPS.length, 'original still intact = undo')
})

test('out-of-range edits throw rather than silently doing nothing', async () => {
  const capture = await load()
  assert.throws(() => setStepText(capture, 99, 'en', 'x'), RangeError)
  assert.throws(() => deleteStep(capture, 0), RangeError)
  assert.throws(() => setAltText(capture, 1, 'rIdNope', 'en', 'x'), RangeError)
})

// --------------------------------------------------------------- alt text ---

test('parser output starts with no alt text and nothing confirmed', async () => {
  const capture = await load()

  for (const step of capture.steps) {
    for (const image of step.images) {
      assert.deepEqual(image.alt, { en: null, fr: null })
      assert.deepEqual(image.altConfirmed, { en: false, fr: false })
      assert.equal(image.decorative, false)
    }
  }
})

test('seeding fills a draft but confirms nothing', async () => {
  const seeded = seedAltText(await load())

  for (const step of seeded.steps) {
    for (const image of step.images) {
      assert.match(image.alt.en, /^Screenshot showing: /)
      assert.equal(image.altConfirmed.en, false, 'a seeded draft is NOT a confirmation')
      assert.equal(image.alt.fr, null, 'no French step text, so no French seed invented')
    }
  }
})

test('seeding never overwrites author-written alt text', async () => {
  let capture = await load()
  capture = setAltText(capture, 1, firstImageId(capture), 'en', 'Author wrote this')
  capture = seedAltText(capture)

  assert.equal(capture.steps[0].images[0].alt.en, 'Author wrote this')
})

test('editing alt text resets confirmation', async () => {
  let capture = seedAltText(await load())
  const id = firstImageId(capture)

  capture = confirmAltText(capture, 1, id, 'en')
  assert.equal(capture.steps[0].images[0].altConfirmed.en, true)

  capture = setAltText(capture, 1, id, 'en', 'Reworded')
  assert.equal(capture.steps[0].images[0].altConfirmed.en, false, 'must be re-affirmed')
})

test('empty alt text cannot be confirmed', async () => {
  const capture = await load()
  assert.throws(
    () => confirmAltText(capture, 1, firstImageId(capture), 'en'),
    /cannot confirm empty alt text/
  )
})

// -------------------------------------------------------- export readiness ---

test('export is blocked while any alt text is unconfirmed', async () => {
  const seeded = seedAltText(await load())
  const { ready, blockers } = exportReadiness(seeded, ['en'])

  assert.equal(ready, false, 'seeded-but-unconfirmed does not count as done')
  assert.equal(blockers.length, ENGLISH_STEPS.length)
  assert.ok(blockers.every((b) => b.code === 'ALT_UNCONFIRMED'))
})

test('export blockers name the specific step and language', async () => {
  const { blockers } = exportReadiness(await load(), ['en'])
  const alt = blockers.find((b) => b.code === 'ALT_UNCONFIRMED')

  assert.equal(typeof alt.stepIndex, 'number')
  assert.equal(alt.lang, 'en')
  assert.ok(alt.imageId, 'identifies which image, not just which step')
})

test('confirming every image clears the alt blockers', async () => {
  let capture = seedAltText(await load())
  for (const step of capture.steps) {
    for (const image of step.images) {
      capture = confirmAltText(capture, step.index, image.id, 'en')
    }
  }

  const { ready, blockers } = exportReadiness(capture, ['en'])
  assert.equal(blockers.filter((b) => b.code === 'ALT_UNCONFIRMED').length, 0)
  assert.equal(ready, true)
})

test('a decorative image satisfies the alt requirement without alt text', async () => {
  let capture = await load()
  capture = setDecorative(capture, 1, firstImageId(capture), true)
  capture = seedAltText(capture)

  assert.equal(capture.steps[0].images[0].alt.en, null, 'decorative images are not seeded')

  const blockers = exportReadiness(capture, ['en']).blockers
  assert.equal(
    blockers.filter((b) => b.stepIndex === 1 && b.code === 'ALT_UNCONFIRMED').length,
    0
  )
})

test('missing French blocks a bilingual export', async () => {
  let capture = seedAltText(await load())
  for (const step of capture.steps) {
    for (const image of step.images) {
      capture = confirmAltText(capture, step.index, image.id, 'en')
    }
  }

  const { ready, blockers } = exportReadiness(capture, ['en', 'fr'])
  assert.equal(ready, false)
  assert.ok(blockers.some((b) => b.code === 'STEP_TEXT_MISSING' && b.lang === 'fr'))
  assert.ok(blockers.some((b) => b.code === 'ALT_UNCONFIRMED' && b.lang === 'fr'))
})

test('a fully authored bilingual capture is ready', async () => {
  let capture = seedAltText(await load())

  for (const step of capture.steps) {
    capture = setStepText(capture, step.index, 'fr', `Étape ${step.index}`)
    for (const image of step.images) {
      capture = setAltText(capture, step.index, image.id, 'fr', `Capture ${step.index}`)
      capture = confirmAltText(capture, step.index, image.id, 'fr')
      capture = confirmAltText(capture, step.index, image.id, 'en')
    }
  }

  assert.deepEqual(exportReadiness(capture, ['en', 'fr']), { ready: true, blockers: [] })
})

// ------------------------------------------------------ per-step verification ---

/** Fill every alt field so nothing is blocked by empty text. */
async function altFilled(languages = ['en', 'fr']) {
  let capture = seedAltText(await load())
  for (const step of capture.steps) {
    for (const image of step.images) {
      for (const lang of languages) {
        capture = setAltText(capture, step.index, image.id, lang, `alt ${lang} ${image.id}`)
      }
    }
  }
  return capture
}

test('empty alt text blocks a step rather than silently confirming nothing', async () => {
  // seedAltText fills only the source language, so French starts empty.
  const capture = seedAltText(await load())
  const before = stepVerification(capture, 1, ['en', 'fr'])

  assert.ok(before.blocked.length > 0, 'empty French alt text must register as blocked')
  assert.equal(before.verified, false)

  // verifyStep must not throw on the blocked item, and must not claim success.
  const after = verifyStep(capture, 1, ['en', 'fr'])
  assert.equal(stepVerification(after, 1, ['en', 'fr']).verified, false)
})

test('verifying a step confirms every image in every language at once', async () => {
  const capture = await altFilled()
  assert.equal(stepVerification(capture, 1, ['en', 'fr']).verified, false)

  const verified = verifyStep(capture, 1, ['en', 'fr'])
  const state = stepVerification(verified, 1, ['en', 'fr'])

  assert.equal(state.verified, true)
  assert.equal(state.done, state.total)
  for (const image of verified.steps[0].images) {
    for (const lang of ['en', 'fr']) {
      assert.equal(image.altConfirmed[lang], true, `${image.id} ${lang} confirmed`)
    }
  }
})

test('verifying one step leaves the others untouched', async () => {
  const capture = await altFilled()
  const verified = verifyStep(capture, 1, ['en', 'fr'])

  assert.equal(stepVerification(verified, 1, ['en', 'fr']).verified, true)
  assert.equal(stepVerification(verified, 2, ['en', 'fr']).verified, false)
})

test('editing any alt text in a verified step withdraws the whole step', async () => {
  // The invariant behind the checkbox: it must never assert a confirmation the
  // author has since invalidated. One edit in one language is enough.
  const capture = verifyStep(await altFilled(), 1, ['en', 'fr'])
  assert.equal(stepVerification(capture, 1, ['en', 'fr']).verified, true)

  const edited = setAltText(capture, 1, firstImageId(capture), 'fr', 'texte different')
  assert.equal(
    stepVerification(edited, 1, ['en', 'fr']).verified,
    false,
    'one edit must withdraw the step, not just that one field'
  )
})

test('unverifying a step withdraws its confirmations', async () => {
  const capture = verifyStep(await altFilled(), 1, ['en', 'fr'])
  const withdrawn = unverifyStep(capture, 1, ['en', 'fr'])

  assert.equal(stepVerification(withdrawn, 1, ['en', 'fr']).verified, false)
  // The text itself survives — only the attestation is withdrawn.
  assert.ok(withdrawn.steps[0].images[0].alt.en)
})

test('a decorative image needs no confirmation and cannot block a step', async () => {
  let capture = await altFilled()
  const imageId = firstImageId(capture)
  capture = setDecorative(capture, 1, imageId, true)

  const state = stepVerification(capture, 1, ['en', 'fr'])
  assert.ok(
    !state.items.some((item) => item.imageId === imageId),
    'a decorative image has nothing to attest to'
  )
})

test('a step with nothing to confirm reports itself as not applicable', async () => {
  let capture = await altFilled()
  for (const image of capture.steps[0].images) {
    capture = setDecorative(capture, 1, image.id, true)
  }
  const state = stepVerification(capture, 1, ['en', 'fr'])

  assert.equal(state.applicable, false)
  // Nothing to confirm is NOT the same as confirmed — the UI shows no control
  // rather than a ticked box asserting something that was never checked.
  assert.equal(state.verified, false)
})

// ------------------------------------------------------------ replaceImage ---

const NEW_BYTES = new Uint8Array([1, 2, 3, 4])

test('replaceImage swaps the bytes and dimensions', async () => {
  const capture = await load()
  const id = firstImageId(capture)

  const next = replaceImage(capture, 1, id, { bytes: NEW_BYTES, width: 800, height: 600 })
  const image = next.steps[0].images[0]

  assert.equal(image.bytes, NEW_BYTES)
  assert.equal(image.width, 800)
  assert.equal(image.height, 600)
})

test('replaceImage keeps the alt text, decorative flag, id and source path', async () => {
  let capture = await load()
  const id = firstImageId(capture)
  const originalPath = capture.steps[0].images[0].path
  capture = setAltText(capture, 1, id, 'en', 'The Start menu, open')

  const next = replaceImage(capture, 1, id, { bytes: NEW_BYTES, width: 10, height: 10 })
  const image = next.steps[0].images[0]

  assert.equal(image.alt.en, 'The Start menu, open', 'alt text survives the swap')
  assert.equal(image.id, id, 'the slot keeps its id')
  assert.equal(image.path, originalPath, 'and its source path')
  assert.equal(image.decorative, false)
})

test('replaceImage RESETS confirmation — the picture the alt described has changed', async () => {
  let capture = seedAltText(await load())
  const id = firstImageId(capture)
  capture = confirmAltText(capture, 1, id, 'en')
  assert.equal(capture.steps[0].images[0].altConfirmed.en, true, 'precondition: confirmed')

  const next = replaceImage(capture, 1, id, { bytes: NEW_BYTES, width: 10, height: 10 })

  assert.equal(
    next.steps[0].images[0].altConfirmed.en,
    false,
    'a replaced image must have its alt re-affirmed before export'
  )
})

test('replaceImage re-opens the export gate it had passed', async () => {
  let capture = await altFilled()
  capture = verifyStep(capture, 1, ['en', 'fr'])
  assert.equal(stepVerification(capture, 1, ['en', 'fr']).verified, true, 'precondition')

  const id = firstImageId(capture)
  capture = replaceImage(capture, 1, id, { bytes: NEW_BYTES, width: 10, height: 10 })

  assert.equal(
    stepVerification(capture, 1, ['en', 'fr']).verified,
    false,
    'the step is no longer verified after its image changed'
  )
})

test('replaceImage does not mutate the capture it was given', async () => {
  const capture = await load()
  const id = firstImageId(capture)
  const before = capture.steps[0].images[0].bytes

  replaceImage(capture, 1, id, { bytes: NEW_BYTES, width: 10, height: 10 })

  assert.equal(capture.steps[0].images[0].bytes, before, 'input bytes untouched')
})

test('replaceImage refuses an unknown image id', async () => {
  const capture = await load()
  assert.throws(
    () => replaceImage(capture, 1, 'rIdNope', { bytes: NEW_BYTES }),
    RangeError
  )
})

test('replaceImage refuses empty bytes', async () => {
  const capture = await load()
  const id = firstImageId(capture)
  assert.throws(() => replaceImage(capture, 1, id, { bytes: new Uint8Array() }), /no bytes/)
})

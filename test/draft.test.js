/**
 * Tests for draft persistence.
 *
 * The dangerous failure here is not losing a draft — it is restoring one onto
 * the wrong screenshots, which produces a guide whose text silently disagrees
 * with its images. Most of these tests exist to prove that cannot happen.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, setStepText, mergeStepIntoPrevious, deleteStep } from '../src/lib/authoring.js'
import {
  captureFingerprint,
  toDraft,
  saveDraft,
  loadDraft,
  clearDraft,
  rehydrate,
  DraftError,
  DRAFT_KEY,
  DRAFT_VERSION,
} from '../src/lib/draft.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

/** Minimal Storage stand-in; `failWith` simulates a quota or security error. */
function fakeStorage(failWith = null) {
  const map = new Map()
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (failWith) throw failWith
      map.set(k, v)
    },
    removeItem: (k) => map.delete(k),
  }
}

const load = (steps = ENGLISH_STEPS) => parseSnagitDocx(makeCapture({ steps }))

// ------------------------------------------------------------ fingerprint ---

test('the fingerprint is stable across identical parses', async () => {
  assert.equal(captureFingerprint(await load()), captureFingerprint(await load()))
})

test('editing never changes the fingerprint the capture carries', async () => {
  // The fingerprint identifies the source recording, not the draft. If editing
  // changed it, a draft with any edit could never be reunited with its own
  // file — which is precisely the bug these tests caught.
  const capture = await load()
  const original = capture.fingerprint
  assert.ok(original, 'the parser attached one')

  let edited = setStepText(capture, 1, 'en', 'Completely rewritten by the author')
  edited = setStepText(edited, 2, 'fr', 'Texte français ajouté')
  edited = seedAltText(edited)

  assert.equal(edited.fingerprint, original, 'carried through every operation')
  assert.equal((await load()).fingerprint, original, 'and matches a fresh parse of the same file')
})

test('saving a capture with no fingerprint is refused', async () => {
  const { fingerprint, ...noFingerprint } = await load()
  assert.throws(() => saveDraft(fakeStorage(), noFingerprint), (e) => e.code === 'NO_FINGERPRINT')
})

test('a different recording produces a different fingerprint', async () => {
  const a = await load()
  const b = await load(['Open the portal', 'Sign in', 'Choose a course'])

  assert.notEqual(captureFingerprint(a), captureFingerprint(b))
})

// ------------------------------------------------------------ save / load ---

test('the stored draft contains no image bytes', async () => {
  const storage = fakeStorage()
  const capture = seedAltText(await load())
  saveDraft(storage, capture)

  const raw = storage.getItem(DRAFT_KEY)
  const parsed = JSON.parse(raw)

  for (const step of parsed.capture.steps) {
    for (const image of step.images) {
      assert.ok(!('bytes' in image), 'bytes are excluded')
      assert.ok(image.path, 'but the path is kept, for rehydration')
    }
  }
})

test('the draft stays small — that is the whole point of dropping images', async () => {
  const storage = fakeStorage()
  const capture = seedAltText(await load())
  const { bytes } = saveDraft(storage, capture)

  // The real capture's images alone are 843 KB. Text-only must be orders of
  // magnitude smaller than the ~5 MB quota.
  assert.ok(bytes < 100_000, `expected a small draft, got ${bytes} bytes`)
})

test('round trips text, alt text and translations', async () => {
  const storage = fakeStorage()
  let capture = seedAltText(await load())
  capture = setStepText(capture, 2, 'fr', 'Cliquez sur « Se connecter »')
  saveDraft(storage, capture)

  const draft = loadDraft(storage)
  assert.equal(draft.capture.steps[1].text.fr, 'Cliquez sur « Se connecter »')
  assert.match(draft.capture.steps[0].images[0].alt.en, /^Screenshot showing: /)
  assert.equal(draft.version, DRAFT_VERSION)
  assert.ok(Date.parse(draft.savedAt), 'savedAt is a real timestamp')
})

test('no stored draft returns null rather than throwing', () => {
  assert.equal(loadDraft(fakeStorage()), null)
})

test('a draft from an older version is refused, not loaded', async () => {
  const storage = fakeStorage()
  const capture = await load()
  saveDraft(storage, capture)
  const stored = JSON.parse(storage.getItem(DRAFT_KEY))
  stored.version = DRAFT_VERSION - 1
  storage.map.set(DRAFT_KEY, JSON.stringify(stored))

  assert.throws(() => loadDraft(storage), (e) => e instanceof DraftError && e.code === 'VERSION_MISMATCH')
})

test('a corrupt draft is refused with a distinct code', () => {
  const storage = fakeStorage()
  storage.map.set(DRAFT_KEY, '{not json at all')

  assert.throws(() => loadDraft(storage), (e) => e.code === 'CORRUPT_DRAFT')
})

test('exceeding the quota fails loudly and leaves the previous draft intact', async () => {
  const capture = await load()
  const good = fakeStorage()
  saveDraft(good, capture)
  const before = good.getItem(DRAFT_KEY)

  const quotaError = Object.assign(new Error('quota'), { name: 'QuotaExceededError' })
  const failing = { ...good, setItem: () => { throw quotaError } }

  assert.throws(
    () => saveDraft(failing, capture),
    (e) => e instanceof DraftError && e.code === 'QUOTA_EXCEEDED'
  )
  assert.equal(good.getItem(DRAFT_KEY), before, 'the stored draft is untouched')
})

test('storage being unavailable is distinguished from a quota problem', async () => {
  const capture = await load()
  const blocked = fakeStorage(Object.assign(new Error('denied'), { name: 'SecurityError' }))

  assert.throws(
    () => saveDraft(blocked, capture),
    (e) => e.code === 'STORAGE_UNAVAILABLE'
  )
})

test('discarding removes the draft', async () => {
  const storage = fakeStorage()
  const capture = await load()
  saveDraft(storage, capture)

  clearDraft(storage)
  assert.equal(loadDraft(storage), null)
})

// -------------------------------------------------------------- rehydrate ---

test('re-dropping the same file restores every screenshot', async () => {
  const storage = fakeStorage()
  const original = seedAltText(await load())
  saveDraft(storage, original)

  const fresh = await load() // the author drops the same .docx again
  const { capture, restoredImages, missingPaths } = rehydrate(loadDraft(storage), fresh)

  assert.equal(missingPaths.length, 0)
  assert.equal(restoredImages, ENGLISH_STEPS.length)
  for (const step of capture.steps) {
    assert.ok(step.images[0].bytes?.length > 0, 'bytes are back')
  }
})

test('edits survive the round trip intact', async () => {
  const storage = fakeStorage()
  let capture = seedAltText(await load())
  capture = setStepText(capture, 1, 'en', 'Author reworded this step')
  capture = setStepText(capture, 1, 'fr', 'L’auteur a reformulé cette étape')
  saveDraft(storage, capture)

  const { capture: restored } = rehydrate(loadDraft(storage), await load())

  assert.equal(restored.steps[0].text.en, 'Author reworded this step')
  assert.equal(restored.steps[0].text.fr, 'L’auteur a reformulé cette étape')
})

test('a DIFFERENT file is refused — never graft a draft onto wrong screenshots', async () => {
  // The failure this module exists to prevent. Restoring here would produce a
  // guide whose text silently disagrees with its images.
  const storage = fakeStorage()
  const original = await load()
  saveDraft(storage, original)

  const otherRecording = await load(['Open settings', 'Choose a printer'])

  assert.throws(
    () => rehydrate(loadDraft(storage), otherRecording),
    (e) => e instanceof DraftError && e.code === 'FINGERPRINT_MISMATCH'
  )
})

test('images are matched by path, so a merged draft still lines up', async () => {
  // After a merge the draft has fewer steps than the file, and one step owns
  // two screenshots. Matching by position would misalign everything from there
  // on; matching by path cannot.
  const storage = fakeStorage()
  let capture = seedAltText(await load())
  capture = mergeStepIntoPrevious(capture, 4)
  saveDraft(storage, capture)

  const { capture: restored, missingPaths } = rehydrate(loadDraft(storage), await load())

  assert.equal(restored.steps.length, ENGLISH_STEPS.length - 1)
  assert.equal(restored.steps[2].images.length, 2, 'the merged step kept both')
  assert.deepEqual(missingPaths, [])
  assert.deepEqual(
    restored.steps[2].images.map((i) => i.path),
    ['word/media/image3.png', 'word/media/image4.png'],
    'and they are the right two'
  )
  for (const step of restored.steps) {
    for (const image of step.images) assert.ok(image.bytes?.length > 0)
  }
})

test('a deleted step does not disturb the remaining images', async () => {
  const storage = fakeStorage()
  let capture = seedAltText(await load())
  capture = deleteStep(capture, 2)
  saveDraft(storage, capture)

  const { capture: restored } = rehydrate(loadDraft(storage), await load())

  assert.equal(restored.steps.length, ENGLISH_STEPS.length - 1)
  assert.equal(restored.steps[1].images[0].path, 'word/media/image3.png', 'step 3 slid up, with its own image')
  assert.ok(restored.steps[1].images[0].bytes?.length > 0)
})

test('rehydrating does not mutate the draft it was given', async () => {
  const storage = fakeStorage()
  const capture = seedAltText(await load())
  saveDraft(storage, capture)

  const draft = loadDraft(storage)
  const before = JSON.stringify(draft)
  rehydrate(draft, await load())

  assert.equal(JSON.stringify(draft), before)
})

test('toDraft leaves the live capture untouched', async () => {
  const capture = seedAltText(await load())
  toDraft(capture, 'fp')

  assert.ok(capture.steps[0].images[0].bytes?.length > 0, 'bytes still on the live capture')
})

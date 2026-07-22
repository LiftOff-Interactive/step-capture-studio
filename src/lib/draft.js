/**
 * Draft persistence: everything except the screenshots.
 *
 * Screenshots are deliberately not stored. `localStorage` is ~5 MB and the
 * reference capture's images alone are 843 KB — a longer recording would blow
 * the quota, and a draft that fails to save on large captures is worse than one
 * that never claimed to. So the draft holds text, alt text, translations and
 * structure, and the author re-drops the same `.docx` to restore the images.
 *
 * The risk that creates is the one this module exists to prevent: grafting a
 * draft onto the *wrong* screenshots. That would be silent and produce a guide
 * whose text does not match its images — worse than losing the draft outright.
 * Two defences:
 *   1. A fingerprint taken at parse time, from the pristine capture. A re-drop
 *      whose fingerprint differs is refused.
 *   2. Images are rehydrated by their source path (`word/media/image3.png`),
 *      not by position, so merges, deletions and reordering cannot misalign
 *      them.
 */

export const DRAFT_VERSION = 3
export const DRAFT_KEY = 'step-capture-studio/draft'

export class DraftError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'DraftError'
    this.code = code
    this.detail = detail
  }
}

/** Small, stable, dependency-free string hash (FNV-1a, 32-bit). */
function hash(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Identify the source recording. **Call this only on a pristine parse.**
 *
 * The parser attaches the result as `capture.fingerprint`, and every authoring
 * operation carries it forward untouched, so callers never need to recompute
 * it — which is the point. An earlier version took the fingerprint as a
 * parameter to `saveDraft`, and the obvious call
 * (`saveDraft(storage, capture, captureFingerprint(capture))`) recomputed it
 * from the *edited* capture. Any draft with an edit could then never be
 * reunited with its own file.
 *
 * Inputs are therefore restricted to things editing cannot change: the step
 * count and the image paths, in document order.
 */
export function captureFingerprint(capture) {
  const paths = capture.steps.flatMap((step) => step.images.map((image) => image.path ?? '?'))
  return `${capture.steps.length}.${paths.length}-${hash(paths.join('\n'))}`
}

/** The capture as stored: identical shape, minus the image bytes. */
export function toDraft(capture, fingerprint = capture.fingerprint) {
  return {
    version: DRAFT_VERSION,
    savedAt: new Date().toISOString(),
    fingerprint,
    capture: {
      ...capture,
      steps: capture.steps.map((step) => ({
        ...step,
        images: step.images.map(({ bytes, ...rest }) => rest),
      })),
    },
  }
}

/**
 * Write the draft.
 *
 * The fingerprint is taken from `capture.fingerprint`, set by the parser. It is
 * deliberately not a parameter — see `captureFingerprint`.
 *
 * @returns {{savedAt: string, bytes: number}}
 * @throws {DraftError} QUOTA_EXCEEDED / STORAGE_UNAVAILABLE / NO_FINGERPRINT
 */
export function saveDraft(storage, capture) {
  if (!capture.fingerprint) {
    throw new DraftError('NO_FINGERPRINT', 'capture was not produced by the parser')
  }
  const draft = toDraft(capture, capture.fingerprint)
  const payload = JSON.stringify(draft)

  try {
    storage.setItem(DRAFT_KEY, payload)
  } catch (error) {
    // A failed write must never destroy the draft already stored.
    const quota =
      error?.name === 'QuotaExceededError' ||
      error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error?.code === 22
    throw new DraftError(quota ? 'QUOTA_EXCEEDED' : 'STORAGE_UNAVAILABLE', error?.message)
  }

  return { savedAt: draft.savedAt, bytes: payload.length }
}

/**
 * Read the draft.
 * @returns {object|null} null when there is nothing stored
 * @throws {DraftError} VERSION_MISMATCH / CORRUPT_DRAFT
 */
export function loadDraft(storage) {
  let raw
  try {
    raw = storage.getItem(DRAFT_KEY)
  } catch (error) {
    throw new DraftError('STORAGE_UNAVAILABLE', error?.message)
  }
  if (!raw) return null

  let draft
  try {
    draft = JSON.parse(raw)
  } catch {
    throw new DraftError('CORRUPT_DRAFT', 'stored draft is not valid JSON')
  }

  if (draft?.version !== DRAFT_VERSION) {
    // Never load a draft into a shape the code no longer expects — that fails
    // in unpredictable places rather than here, where it can be explained.
    throw new DraftError('VERSION_MISMATCH', `stored v${draft?.version}, expected v${DRAFT_VERSION}`)
  }
  if (!draft.capture?.steps) {
    throw new DraftError('CORRUPT_DRAFT', 'no steps in stored draft')
  }
  return draft
}

export function clearDraft(storage) {
  try {
    storage.removeItem(DRAFT_KEY)
  } catch {
    /* nothing useful to do — the draft is already unreachable */
  }
}

/**
 * Put the screenshots back, from a freshly parsed re-drop of the same file.
 *
 * @param {object} draft  as returned by loadDraft
 * @param {object} fresh  a pristine parse of the re-dropped .docx
 * @returns {{capture: object, restoredImages: number}}
 * @throws {DraftError} FINGERPRINT_MISMATCH
 */
export function rehydrate(draft, fresh) {
  const freshFingerprint = captureFingerprint(fresh)
  if (draft.fingerprint !== freshFingerprint) {
    throw new DraftError(
      'FINGERPRINT_MISMATCH',
      `draft ${draft.fingerprint}, file ${freshFingerprint}`
    )
  }

  // path -> bytes, from the file just dropped.
  const bytesByPath = new Map()
  for (const step of fresh.steps) {
    for (const image of step.images) {
      if (image.path) bytesByPath.set(image.path, image.bytes)
    }
  }

  let restoredImages = 0
  const missingPaths = []

  const steps = draft.capture.steps.map((step) => ({
    ...step,
    images: step.images.map((image) => {
      const bytes = bytesByPath.get(image.path)
      if (!bytes) {
        missingPaths.push(image.path)
        return image
      }
      restoredImages++
      return { ...image, bytes }
    }),
  }))

  return {
    capture: { ...draft.capture, steps },
    restoredImages,
    missingPaths,
  }
}

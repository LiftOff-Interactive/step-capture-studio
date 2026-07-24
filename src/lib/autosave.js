/**
 * Autosave: crash recovery for a session, in `localStorage`.
 *
 * This is NOT the old text-only draft (deleted in 974e4f2). The app is now
 * built around the project file — a self-contained HTML that already carries
 * the whole state, screenshots included, and already has a tested round trip
 * (`emit-project.js` / `parse-project.js`). Autosave piggybacks on that: it
 * stores exactly the string `emitProject` produces, and restore hands it back
 * to `parseProject`. There is no second serializer to keep in step, and — unlike
 * the old draft — a session begun from the demo or an imported project file
 * (which has no `.docx` to re-drop) restores its screenshots too.
 *
 * The cost is size. `localStorage` is ~5 MB and a project file inlines every
 * screenshot as base64; the demo is 0.27 MB, so typical captures fit, but a
 * long recording can exceed the quota. A quota failure is therefore surfaced,
 * never swallowed: the honest message is "autosave is off, the project file is
 * now your only copy". An autosave that fails silently is worse than none,
 * because the author stops being careful once they believe their work is safe.
 *
 * This module owns the storage envelope only — versioning, timestamp, and the
 * error taxonomy. It never parses or emits a capture itself; callers pass the
 * already-serialized HTML in and get it back out.
 */

export const AUTOSAVE_VERSION = 1
export const AUTOSAVE_KEY = 'step-capture-studio/autosave'

export class AutosaveError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'AutosaveError'
    this.code = code
    this.detail = detail
  }
}

/**
 * Write the session.
 *
 * @param {Storage} storage  `localStorage`, or a stand-in in tests
 * @param {string} html      the project-file HTML, as `emitProject` returns it
 * @returns {{savedAt: string, bytes: number}}
 * @throws {AutosaveError} QUOTA_EXCEEDED / STORAGE_UNAVAILABLE
 */
export function saveAutosave(storage, html) {
  const envelope = {
    version: AUTOSAVE_VERSION,
    savedAt: new Date().toISOString(),
    html,
  }
  const payload = JSON.stringify(envelope)

  try {
    storage.setItem(AUTOSAVE_KEY, payload)
  } catch (error) {
    // A failed write must never destroy whatever was stored before it.
    const quota =
      error?.name === 'QuotaExceededError' ||
      error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error?.code === 22
    throw new AutosaveError(quota ? 'QUOTA_EXCEEDED' : 'STORAGE_UNAVAILABLE', error?.message)
  }

  return { savedAt: envelope.savedAt, bytes: payload.length }
}

/**
 * Read the session left by a previous visit.
 *
 * @param {Storage} storage
 * @returns {{savedAt: string, html: string}|null} null when nothing is stored
 * @throws {AutosaveError} VERSION_MISMATCH / CORRUPT
 */
export function loadAutosave(storage) {
  let raw
  try {
    raw = storage.getItem(AUTOSAVE_KEY)
  } catch (error) {
    throw new AutosaveError('STORAGE_UNAVAILABLE', error?.message)
  }
  if (!raw) return null

  let envelope
  try {
    envelope = JSON.parse(raw)
  } catch {
    throw new AutosaveError('CORRUPT', 'stored autosave is not valid JSON')
  }

  if (envelope?.version !== AUTOSAVE_VERSION) {
    // Never restore into a shape this code no longer expects. An envelope from a
    // future or past version is discarded with an explanation, not fed to the
    // parser to fail somewhere less legible.
    throw new AutosaveError(
      'VERSION_MISMATCH',
      `stored v${envelope?.version}, expected v${AUTOSAVE_VERSION}`
    )
  }
  if (typeof envelope.html !== 'string' || envelope.html === '') {
    throw new AutosaveError('CORRUPT', 'stored autosave has no project content')
  }

  return { savedAt: envelope.savedAt, html: envelope.html }
}

/** Forget any stored session. Never throws — the aim is that it be gone. */
export function clearAutosave(storage) {
  try {
    storage.removeItem(AUTOSAVE_KEY)
  } catch {
    /* nothing useful to do — the autosave is already unreachable */
  }
}

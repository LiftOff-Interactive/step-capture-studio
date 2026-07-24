/**
 * Tests for autosave persistence.
 *
 * Autosave is the recovery net, so the failures that matter are the quiet ones:
 * a write that fails without saying so, or a restore that loads a shape the
 * code no longer understands. Most of these tests exist to prove those cannot
 * happen. The capture round trip itself (emit -> parse) is proven separately in
 * project-roundtrip.test.js; here the payload is treated as an opaque string,
 * exactly as the module treats it.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  saveAutosave,
  loadAutosave,
  clearAutosave,
  AutosaveError,
  AUTOSAVE_KEY,
  AUTOSAVE_VERSION,
} from '../src/lib/autosave.js'

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

const SAMPLE = '<!doctype html><html><body>a project file</body></html>'

test('load returns null when nothing is stored', () => {
  assert.equal(loadAutosave(fakeStorage()), null)
})

test('a saved session round-trips its html verbatim', () => {
  const storage = fakeStorage()
  const { savedAt, bytes } = saveAutosave(storage, SAMPLE)

  assert.ok(bytes > SAMPLE.length, 'byte count reflects the stored envelope')
  assert.match(savedAt, /^\d{4}-\d{2}-\d{2}T/, 'savedAt is an ISO timestamp')

  const restored = loadAutosave(storage)
  assert.equal(restored.html, SAMPLE)
  assert.equal(restored.savedAt, savedAt)
})

test('saving under the known key writes a versioned envelope', () => {
  const storage = fakeStorage()
  saveAutosave(storage, SAMPLE)

  const envelope = JSON.parse(storage.map.get(AUTOSAVE_KEY))
  assert.equal(envelope.version, AUTOSAVE_VERSION)
  assert.equal(envelope.html, SAMPLE)
})

test('a second save overwrites the first', () => {
  const storage = fakeStorage()
  saveAutosave(storage, SAMPLE)
  saveAutosave(storage, '<html>newer</html>')
  assert.equal(loadAutosave(storage).html, '<html>newer</html>')
})

test('a quota error is reported as QUOTA_EXCEEDED, not swallowed', () => {
  const quota = Object.assign(new Error('over quota'), { name: 'QuotaExceededError' })
  assert.throws(() => saveAutosave(fakeStorage(quota), SAMPLE), (error) => {
    assert.ok(error instanceof AutosaveError)
    assert.equal(error.code, 'QUOTA_EXCEEDED')
    return true
  })
})

test('quota is also detected by legacy code 22', () => {
  const quota = Object.assign(new Error('over quota'), { code: 22 })
  assert.throws(() => saveAutosave(fakeStorage(quota), SAMPLE), (error) => {
    assert.equal(error.code, 'QUOTA_EXCEEDED')
    return true
  })
})

test('any other write failure is STORAGE_UNAVAILABLE', () => {
  const denied = Object.assign(new Error('blocked'), { name: 'SecurityError' })
  assert.throws(() => saveAutosave(fakeStorage(denied), SAMPLE), (error) => {
    assert.equal(error.code, 'STORAGE_UNAVAILABLE')
    return true
  })
})

test('a failed write leaves the previous autosave intact', () => {
  const storage = fakeStorage()
  saveAutosave(storage, SAMPLE)

  // Now make writes fail, and confirm the earlier value survives.
  storage.setItem = () => {
    throw Object.assign(new Error('over quota'), { name: 'QuotaExceededError' })
  }
  assert.throws(() => saveAutosave(storage, '<html>newer</html>'))
  assert.equal(loadAutosave(storage).html, SAMPLE)
})

test('a stored draft from another version is refused, not loaded', () => {
  const storage = fakeStorage()
  storage.map.set(
    AUTOSAVE_KEY,
    JSON.stringify({ version: AUTOSAVE_VERSION + 1, savedAt: 'x', html: SAMPLE })
  )
  assert.throws(() => loadAutosave(storage), (error) => {
    assert.equal(error.code, 'VERSION_MISMATCH')
    return true
  })
})

test('invalid JSON is reported as CORRUPT', () => {
  const storage = fakeStorage()
  storage.map.set(AUTOSAVE_KEY, '{ not json')
  assert.throws(() => loadAutosave(storage), (error) => {
    assert.equal(error.code, 'CORRUPT')
    return true
  })
})

test('an envelope with no html is CORRUPT, not a false restore', () => {
  const storage = fakeStorage()
  storage.map.set(AUTOSAVE_KEY, JSON.stringify({ version: AUTOSAVE_VERSION, savedAt: 'x', html: '' }))
  assert.throws(() => loadAutosave(storage), (error) => {
    assert.equal(error.code, 'CORRUPT')
    return true
  })
})

test('clear removes the stored session', () => {
  const storage = fakeStorage()
  saveAutosave(storage, SAMPLE)
  clearAutosave(storage)
  assert.equal(loadAutosave(storage), null)
})

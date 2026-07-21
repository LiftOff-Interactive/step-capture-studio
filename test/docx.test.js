/**
 * Tests for the zero-dependency .docx reader.
 *
 * These run in Node, which provides the same DecompressionStream/Blob/Response
 * APIs the browser does — so this exercises the real code path, not a shim.
 * Browser availability of DecompressionStream is still an open risk and is
 * settled by the manual browser check in the feature file, not here.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { readZip, readDocx, decodeText, pngSize, DocxError } from '../src/lib/docx.js'
import { makeCapture, makeZip, makePng, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const utf8 = (s) => new TextEncoder().encode(s)

test('reads every entry from a synthetic capture', async () => {
  const entries = await readDocx(makeCapture({ steps: ENGLISH_STEPS }))

  assert.ok(entries.has('word/document.xml'), 'document.xml present')
  assert.ok(entries.has('word/_rels/document.xml.rels'), 'rels present')
  assert.ok(entries.has('docProps/core.xml'), 'core properties present')

  const images = [...entries.keys()].filter((k) => k.startsWith('word/media/'))
  assert.equal(images.length, ENGLISH_STEPS.length, 'one image per step')
})

test('inflates Deflate entries to well-formed XML', async () => {
  const entries = await readDocx(makeCapture({ steps: ENGLISH_STEPS }))
  const xml = decodeText(entries.get('word/document.xml'))

  assert.ok(xml.startsWith('<?xml'), 'starts with XML declaration')
  assert.ok(xml.includes('<w:body>'), 'contains a body element')
  assert.ok(xml.includes('Click &quot;Sign in&quot;') || xml.includes('Click "Sign in"'))
  assert.ok(xml.trimEnd().endsWith('</w:document>'), 'not truncated')
})

test('extracts Stored entries byte-for-byte as valid PNGs', async () => {
  const entries = await readDocx(makeCapture({ steps: ENGLISH_STEPS, width: 320, height: 200 }))

  for (const [name, bytes] of entries) {
    if (!name.startsWith('word/media/')) continue
    assert.deepEqual(
      [...bytes.subarray(0, 4)],
      [0x89, 0x50, 0x4e, 0x47],
      `${name} has the PNG signature`
    )
    assert.deepEqual(pngSize(bytes), { width: 320, height: 200 }, `${name} dimensions`)
  }
})

test('reads native resolution, not the smaller Word display size', async () => {
  // The real sample stores 1040x596 PNGs displayed at 624x358. Artifacts must
  // use the native size, so pngSize must read the file, not the Word extent.
  const entries = await readDocx(makeCapture({ steps: ['One step'], width: 1040, height: 596 }))
  const image = entries.get('word/media/image1.png')

  assert.deepEqual(pngSize(image), { width: 1040, height: 596 })
})

test('handles both compression methods for any entry', async () => {
  // The observed split (XML deflated, PNG stored) is what Word happened to
  // write, not a guarantee. Prove the reader does not depend on it.
  const zip = makeZip([
    { name: 'word/document.xml', data: utf8('<w:document>stored</w:document>') },
    { name: 'word/media/image1.png', data: makePng(24, 16), deflate: true },
  ])
  const entries = await readZip(zip)

  assert.equal(decodeText(entries.get('word/document.xml')), '<w:document>stored</w:document>')
  assert.deepEqual(pngSize(entries.get('word/media/image1.png')), { width: 24, height: 16 })
})

test('preserves UTF-8 content through the round trip', async () => {
  const entries = await readDocx(
    makeCapture({ steps: ['Cliquez sur « Français »'], author: 'Réal Côté' })
  )
  const xml = decodeText(entries.get('word/document.xml'))
  const core = decodeText(entries.get('docProps/core.xml'))

  assert.ok(xml.includes('« Français »'), 'accented step text survives')
  assert.ok(core.includes('Réal Côté'), 'accented author survives')
})

test('skips directory entries', async () => {
  const zip = makeZip([
    { name: 'word/', data: new Uint8Array(0) },
    { name: 'word/document.xml', data: utf8('<w:document/>'), deflate: true },
  ])
  const entries = await readZip(zip)

  assert.ok(!entries.has('word/'), 'directory marker not returned as an entry')
  assert.equal(entries.size, 1)
})

test('rejects input that is not a ZIP', async () => {
  await assert.rejects(
    () => readZip(utf8('this is plainly not a zip archive')),
    (err) => err instanceof DocxError && err.code === 'NOT_A_ZIP'
  )
})

test('rejects a file too small to be a ZIP', async () => {
  await assert.rejects(
    () => readZip(new Uint8Array([1, 2, 3])),
    (err) => err.code === 'NOT_A_ZIP'
  )
})

test('rejects a valid ZIP that is not a Word document', async () => {
  const zip = makeZip([{ name: 'readme.txt', data: utf8('hello'), deflate: true }])

  await assert.rejects(
    () => readDocx(zip),
    (err) => err instanceof DocxError && err.code === 'NOT_A_DOCX'
  )
})

test('rejects a truncated archive rather than returning partial data', async () => {
  const full = makeCapture({ steps: ENGLISH_STEPS })
  // Keep the trailing EOCD so it is found, but destroy the body it points into.
  const truncated = new Uint8Array(full.length - 200)
  truncated.set(full.subarray(0, full.length - 222), 0)
  truncated.set(full.subarray(full.length - 22), truncated.length - 22)

  await assert.rejects(
    () => readZip(truncated),
    (err) => err instanceof DocxError
  )
})

test('errors carry a stable code for translation, not a raw message', async () => {
  const error = await readZip(utf8('nope')).catch((e) => e)

  assert.equal(error.name, 'DocxError')
  assert.equal(typeof error.code, 'string')
  assert.match(error.code, /^[A-Z_]+$/, 'code is a stable lookup key')
})

test('rejects non-PNG bytes in pngSize', () => {
  assert.throws(
    () => pngSize(utf8('definitely not a png at all')),
    (err) => err instanceof DocxError && err.code === 'NOT_A_PNG'
  )
})

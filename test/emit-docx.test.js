/**
 * Tests for the accessible .docx writer — the project's highest-risk item.
 *
 * These assert structure by **round trip**: emit a package, then read it back
 * with this project's own `docx.js`, proving the ZIP is valid and every XML
 * part well formed.
 *
 * They are backed by real verification in Word 16.0, recorded in
 * staging/stage-4-ship/. Word opens the output without a repair prompt and
 * reads the headings, alt text and language correctly. That exercise also
 * found a defect no structural test could: including `<dc:language>` in
 * core.xml makes Word discard the whole part, taking the document title with
 * it. The assertion below pins that down.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { JSDOM } from 'jsdom'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, confirmAltText, setStepText, setAltText } from '../src/lib/authoring.js'
import { setNarrative, setScenario } from '../src/lib/case-study.js'
import { emitDocx } from '../src/lib/emit-docx.js'
import { readDocx, decodeText, pngSize } from '../src/lib/docx.js'
import { writeZip, crc32 } from '../src/lib/zip-write.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const { DOMParser } = new JSDOM().window

/** Parse strictly; OOXML that is not well formed makes Word offer to repair. */
function parseXml(text, label) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const error = doc.querySelector('parsererror')
  assert.equal(error, null, `${label} is not well-formed XML: ${error?.textContent ?? ''}`)
  return doc
}

async function authored() {
  let c = seedAltText(await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS })))
  for (const step of c.steps) {
    c = setStepText(c, step.index, 'fr', `Étape ${step.index} en français`)
    for (const img of step.images) {
      c = confirmAltText(c, step.index, img.id, 'en')
      c = setAltText(c, step.index, img.id, 'fr', `Capture d’écran ${step.index}`)
      c = confirmAltText(c, step.index, img.id, 'fr')
    }
  }
  return c
}

// ------------------------------------------------------------- ZIP writer ---

test('the ZIP writer round-trips through our own reader', async () => {
  const zip = await writeZip([
    { name: 'word/document.xml', data: new TextEncoder().encode('<w:document/>'), deflate: true },
    { name: 'word/media/image1.png', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]) },
  ])
  const entries = await readDocx(zip)

  assert.equal(decodeText(entries.get('word/document.xml')), '<w:document/>')
  assert.deepEqual([...entries.get('word/media/image1.png')], [0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
})

test('CRC32 matches the known check value', () => {
  // The standard "123456789" vector — a wrong CRC is exactly the kind of bug
  // that makes an archive open in some tools and not others.
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926)
})

test('deflated and stored entries both survive', async () => {
  const text = 'x'.repeat(5000)
  const zip = await writeZip([
    { name: 'word/document.xml', data: new TextEncoder().encode(text), deflate: true },
    { name: 'a.txt', data: new TextEncoder().encode(text) },
  ])
  const entries = await readDocx(zip)

  assert.equal(decodeText(entries.get('word/document.xml')), text)
  assert.equal(decodeText(entries.get('a.txt')), text)
  assert.ok(zip.length < text.length * 2, 'the deflated copy actually compressed')
})

// ----------------------------------------------------------- the package ---

test('the package contains every part Word requires', async () => {
  const entries = await readDocx(await emitDocx(await authored(), { lang: 'en' }))

  for (const part of [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/_rels/document.xml.rels',
    'word/styles.xml',
    'docProps/core.xml',
    'docProps/app.xml',
  ]) {
    assert.ok(entries.has(part), `${part} present`)
  }
})

test('every XML part is well formed', async () => {
  const entries = await readDocx(await emitDocx(await authored(), { lang: 'en' }))

  for (const [name, bytes] of entries) {
    if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue
    parseXml(decodeText(bytes), name)
  }
})

test('screenshots are embedded byte-identically', async () => {
  const capture = await authored()
  const entries = await readDocx(await emitDocx(capture, { lang: 'en' }))

  const images = [...entries.keys()].filter((k) => k.startsWith('word/media/'))
  assert.equal(images.length, ENGLISH_STEPS.length)

  const emitted = entries.get('word/media/image1.png')
  assert.deepEqual([...emitted], [...capture.steps[0].images[0].bytes], 'no re-encoding')
  assert.deepEqual(pngSize(emitted), pngSize(capture.steps[0].images[0].bytes))
})

test('every image relationship resolves to a part that exists', async () => {
  const entries = await readDocx(await emitDocx(await authored(), { lang: 'en' }))
  const rels = parseXml(decodeText(entries.get('word/_rels/document.xml.rels')), 'rels')

  const targets = [...rels.getElementsByTagName('Relationship')]
    .map((r) => r.getAttribute('Target'))
    .filter((target) => target.startsWith('media/'))

  assert.equal(targets.length, ENGLISH_STEPS.length)
  for (const target of targets) {
    assert.ok(entries.has(`word/${target}`), `${target} exists in the package`)
  }
})

// ---------------------------------------------------------- accessibility ---

test('every image carries alt text in descr — the checker\'s commonest error', async () => {
  const entries = await readDocx(await emitDocx(await authored(), { lang: 'en' }))
  const doc = parseXml(decodeText(entries.get('word/document.xml')), 'document.xml')

  const docPrs = [...doc.getElementsByTagName('wp:docPr')]
  assert.equal(docPrs.length, ENGLISH_STEPS.length)
  for (const el of docPrs) {
    const descr = el.getAttribute('descr')
    assert.ok(descr?.trim(), 'descr is present and non-empty')
    assert.match(descr, /^Screenshot showing: /)
  }
})

test('headings use real styles, declared in styles.xml', async () => {
  // Bold text pretending to be a heading is what makes a Word document
  // unnavigable, and it is what the checker flags.
  const entries = await readDocx(await emitDocx(await authored(), { lang: 'en' }))
  const doc = parseXml(decodeText(entries.get('word/document.xml')), 'document.xml')
  const styles = parseXml(decodeText(entries.get('word/styles.xml')), 'styles.xml')

  const declared = new Set(
    [...styles.getElementsByTagName('w:style')].map((s) => s.getAttribute('w:styleId'))
  )
  const used = [...doc.getElementsByTagName('w:pStyle')].map((s) => s.getAttribute('w:val'))

  assert.ok(used.includes('Heading1'), 'step headings are real headings')
  assert.ok(used.includes('Title'), 'the document has a Title style')
  for (const style of new Set(used)) {
    assert.ok(declared.has(style), `${style} is declared in styles.xml`)
  }
})

test('the document has a title in core properties', async () => {
  // Required by Word's Accessibility Checker, not merely nice to have.
  const entries = await readDocx(await emitDocx(await authored(), { lang: 'en' }))
  const core = parseXml(decodeText(entries.get('docProps/core.xml')), 'core.xml')

  const title = core.getElementsByTagName('dc:title')[0]?.textContent
  assert.ok(title?.trim(), 'dc:title is present and non-empty')
  assert.equal(title, 'Microsoft Edge')
})

test('core properties are shaped like a Word-authored file', async () => {
  // Regression test. A leaner core.xml — no dcmitype, no empty optional
  // elements, no cp:revision — was discarded by Word entirely: a re-save came
  // back with an empty title AND an empty creator. The document title is an
  // Accessibility Checker requirement, so the shape matters, not just the value.
  const entries = await readDocx(await emitDocx(await authored(), { lang: 'en' }))
  const text = decodeText(entries.get('docProps/core.xml'))

  assert.match(text, /xmlns:dcmitype="http:\/\/purl\.org\/dc\/dcmitype\/"/)
  for (const tag of ['dc:title', 'dc:subject', 'dc:creator', 'cp:keywords', 'dc:description',
                     'cp:lastModifiedBy', 'cp:revision', 'dcterms:created', 'dcterms:modified']) {
    assert.ok(text.includes(`<${tag}`), `${tag} present`)
  }

  // Verified by bisection against Word 16.0: including dc:language makes Word
  // discard the whole part, so the title disappears — and the title is an
  // Accessibility Checker requirement. The language lives in w:lang instead.
  assert.ok(!text.includes('<dc:language'), 'dc:language must NOT be in core.xml')

  // Word writes whole minutes; a stray fractional second is a needless risk.
  const created = text.match(/<dcterms:created[^>]*>([^<]+)</)[1]
  assert.match(created, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/, 'W3CDTF, whole minutes')
})

test('every run declares its language', async () => {
  const entries = await readDocx(await emitDocx(await authored(), { lang: 'en' }))
  const doc = parseXml(decodeText(entries.get('word/document.xml')), 'document.xml')

  const runs = [...doc.getElementsByTagName('w:r')].filter((r) => r.getElementsByTagName('w:t').length)
  assert.ok(runs.length > 0)
  for (const r of runs) {
    assert.equal(r.getElementsByTagName('w:lang')[0]?.getAttribute('w:val'), 'en-CA')
  }
})

test('the French document is French all the way down', async () => {
  const entries = await readDocx(await emitDocx(await authored(), { lang: 'fr' }))
  const doc = parseXml(decodeText(entries.get('word/document.xml')), 'document.xml')
  const core = parseXml(decodeText(entries.get('docProps/core.xml')), 'core.xml')
  const styles = parseXml(decodeText(entries.get('word/styles.xml')), 'styles.xml')

  assert.equal(
    styles.getElementsByTagName('w:lang')[0]?.getAttribute('w:val'),
    'fr-CA',
    'the default run language too'
  )
  const alt = doc.getElementsByTagName('wp:docPr')[0].getAttribute('descr')
  assert.match(alt, /^Capture d’écran/, 'alt text is the French one')
  assert.match(decodeText(entries.get('word/document.xml')), /Étape 1 en français/)
})

test('it refuses to emit an image with no alt text', async () => {
  // Second lock behind the export gate.
  const capture = await parseSnagitDocx(makeCapture({ steps: ['One step'] }))
  await assert.rejects(() => emitDocx(capture, { lang: 'en' }), /missing alt text/)
})

// --------------------------------------------------------------- content ---

test('authored narrative appears under real subheadings', async () => {
  let c = await authored()
  c = setNarrative(c, 1, 'why', 'en', 'It unlocks the shift')
  const entries = await readDocx(await emitDocx(c, { lang: 'en' }))
  const text = decodeText(entries.get('word/document.xml'))

  assert.match(text, /It unlocks the shift/)
  assert.match(text, /w:val="Heading2"/, 'the note has a real subheading')
})

test('unreviewed drafted narrative is left out entirely', async () => {
  // Consistent with the HTML case study: an unchecked claim never ships.
  let c = await authored()
  c = setNarrative(c, 1, 'why', 'en', 'A model guessed this', { drafted: true })
  const entries = await readDocx(await emitDocx(c, { lang: 'en' }))

  assert.ok(!decodeText(entries.get('word/document.xml')).includes('A model guessed this'))
})

test('special characters are escaped rather than breaking the package', async () => {
  let c = await authored()
  c = setStepText(c, 1, 'en', 'Click "Save & Close" <now>')
  c = setScenario(c, 'audience', 'en', "Réal's team — 100% of them")

  const entries = await readDocx(await emitDocx(c, { lang: 'en' }))
  const text = decodeText(entries.get('word/document.xml'))

  parseXml(text, 'document.xml with special characters')
  assert.match(text, /Click &quot;Save &amp; Close&quot; &lt;now&gt;/)
})

test('a control character cannot corrupt the package', async () => {
  // Illegal in XML 1.0; Word rejects the whole file rather than the character.
  let c = await authored()
  c = setStepText(c, 1, 'en', `Bad${String.fromCharCode(7)}char`)

  const entries = await readDocx(await emitDocx(c, { lang: 'en' }))
  const text = decodeText(entries.get('word/document.xml'))

  parseXml(text, 'document.xml with a control character')
  assert.match(text, /Badchar/, 'the character is stripped, the text survives')
})

test('images are scaled to fit the page, keeping aspect ratio', async () => {
  const capture = await authored() // screenshots are 200x120 in the fixture
  const entries = await readDocx(await emitDocx(capture, { lang: 'en' }))
  const doc = parseXml(decodeText(entries.get('word/document.xml')), 'document.xml')

  const extent = doc.getElementsByTagName('wp:extent')[0]
  const cx = Number(extent.getAttribute('cx'))
  const cy = Number(extent.getAttribute('cy'))

  assert.ok(cx <= 6.5 * 914400, 'never wider than the text column')
  assert.ok(Math.abs(cx / cy - 200 / 120) < 0.01, 'aspect ratio preserved')
})

/**
 * Tests for the accessible .docx writer â€” the project's highest-risk item.
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
import { setBranding } from '../src/lib/branding.js'
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
    c = setStepText(c, step.index, 'fr', `Ã‰tape ${step.index} en franÃ§ais`)
    for (const img of step.images) {
      c = confirmAltText(c, step.index, img.id, 'en')
      c = setAltText(c, step.index, img.id, 'fr', `Capture dâ€™Ã©cran ${step.index}`)
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
  // The standard "123456789" vector â€” a wrong CRC is exactly the kind of bug
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
    'word/settings.xml',
    'docProps/core.xml',
    'docProps/app.xml',
  ]) {
    assert.ok(entries.has(part), `${part} present`)
  }
})

/**
 * Regression: compatibility mode.
 *
 * Word infers the format era from `compatibilityMode` in settings.xml. With no
 * settings.xml the file opened in Compatibility Mode â€” "this document is in an
 * older format with limited functionality" â€” and one of the functions Word
 * limits is the **Accessibility Checker**, which it disables outright.
 *
 * That made the export unable to satisfy its own accessibility criterion: the
 * document could not be checked at all without first converting it, and a
 * converted file is Word's document, not ours. Every structural test passed
 * throughout; only a human opening Word could see it.
 *
 * Sibling of the `<dc:language>` defect. Same lesson: the consumer is the spec.
 */
test('settings.xml declares compatibility mode 15, or Word disables the checker', async () => {
  const entries = await readDocx(await emitDocx(await authored(), { lang: 'en' }))
  const settings = decodeText(entries.get('word/settings.xml'))

  parseXml(settings, 'word/settings.xml')
  assert.match(
    settings,
    /<w:compatSetting[^>]*w:name="compatibilityMode"[^>]*w:val="15"/,
    'compatibilityMode 15 is what keeps the file out of Compatibility Mode'
  )

  // The part is inert unless it is both declared and related to.
  assert.match(
    decodeText(entries.get('[Content_Types].xml')),
    /PartName="\/word\/settings\.xml"/,
    'settings.xml needs a content-type override'
  )
  assert.match(
    decodeText(entries.get('word/_rels/document.xml.rels')),
    /relationships\/settings"[^>]*Target="settings\.xml"/,
    'settings.xml needs a relationship from document.xml'
  )
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

test('every image carries alt text in descr â€” the checker\'s commonest error', async () => {
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
  // Regression test. A leaner core.xml â€” no dcmitype, no empty optional
  // elements, no cp:revision â€” was discarded by Word entirely: a re-save came
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
  // discard the whole part, so the title disappears â€” and the title is an
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
  assert.match(alt, /^Capture dâ€™Ã©cran/, 'alt text is the French one')
  assert.match(decodeText(entries.get('word/document.xml')), /Ã‰tape 1 en franÃ§ais/)
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
  c = setScenario(c, 'audience', 'en', "RÃ©al's team â€” 100% of them")

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

// ----------------------------------------------------- image type detection ---

/** The 6-byte core signature each format is recognised by. */
const SIG = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a],
  jpeg: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10],
  gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
}
const bytesWith = (sig, len = 64) => {
  const b = new Uint8Array(len)
  b.set(sig)
  return b
}

test('imageType reads the format from the bytes, never a filename', async () => {
  const { imageType } = await import('../src/lib/emit-common.js')

  assert.equal(imageType(bytesWith(SIG.png)).ext, 'png')
  assert.equal(imageType(bytesWith(SIG.jpeg)).mime, 'image/jpeg')
  assert.equal(imageType(bytesWith(SIG.gif)).ext, 'gif')

  const webp = new Uint8Array(16)
  webp.set([0x52, 0x49, 0x46, 0x46]) // RIFF
  webp.set([0x57, 0x45, 0x42, 0x50], 8) // WEBP
  assert.equal(imageType(webp).mime, 'image/webp')

  // Unknown bytes fall back to PNG rather than throwing â€” the parser vets input.
  assert.equal(imageType(new Uint8Array([1, 2, 3, 4])).ext, 'png')
})

test('a JPEG image is embedded as .jpeg with the right content type, not mislabelled png', async () => {
  // Regression: everything used to hardcode PNG â€” part name, data URI, and the
  // [Content_Types] Default. A JPEG in a capture then produced a package whose
  // bytes and labels disagreed, which is the shape of file Word offers to repair.
  let c = await authored()
  // Swap the first image's bytes for a JPEG; keep everything else identical.
  const jpeg = bytesWith(SIG.jpeg, 128)
  c = {
    ...c,
    steps: c.steps.map((step, i) =>
      i === 0
        ? { ...step, images: step.images.map((img, j) => (j === 0 ? { ...img, bytes: jpeg } : img)) }
        : step
    ),
  }

  const entries = await readDocx(await emitDocx(c, { lang: 'en' }))
  const names = [...entries.keys()]
  const ct = decodeText(entries.get('[Content_Types].xml'))

  assert.ok(names.includes('word/media/image1.jpeg'), 'the JPEG is stored with a .jpeg extension')
  assert.ok(
    names.some((n) => n.endsWith('.png')),
    'the remaining PNG screenshots keep their .png extension'
  )
  assert.match(ct, /Extension="jpeg" ContentType="image\/jpeg"/, 'jpeg content type declared')
  assert.match(ct, /Extension="png" ContentType="image\/png"/, 'png content type still declared')

  // Every image part must have a content type Word can resolve â€” no undeclared
  // extension, which is an untyped part.
  const declared = new Set([...ct.matchAll(/Extension="([^"]+)"/g)].map((m) => m[1]))
  for (const name of names.filter((n) => n.startsWith('word/media/'))) {
    const ext = name.split('.').pop()
    assert.ok(declared.has(ext), `extension ${ext} must be declared in [Content_Types].xml`)
  }
})

test('the emitter embeds screenshots byte-identically regardless of format', async () => {
  // The byte-identical guarantee must not depend on the format being PNG.
  let c = await authored()
  const jpeg = bytesWith(SIG.jpeg, 200)
  c = {
    ...c,
    steps: c.steps.map((step, i) =>
      i === 0
        ? { ...step, images: step.images.map((img, j) => (j === 0 ? { ...img, bytes: jpeg } : img)) }
        : step
    ),
  }
  const entries = await readDocx(await emitDocx(c, { lang: 'en' }))
  assert.deepEqual([...entries.get('word/media/image1.jpeg')], [...jpeg], 'JPEG not re-encoded')
})

test('branding reaches the Word document as fonts, colour and sizes', async () => {
  // Only three branding options mean anything in OOXML. The gradient and the
  // background image have no equivalent and are deliberately dropped: Word has
  // no page gradient worth the markup, and a photograph behind body text is the
  // opposite of accessible in a document meant to be printed.
  const capture = setBranding(await authored(), {
    fontBody: 'serif',
    fontHeading: 'slab',
    baseSize: 20,
    headingScale: 1.5,
    highlight: '#7a0019',
    background: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  })
  const entries = await readDocx(await emitDocx(capture, { lang: 'en' }))
  const styles = decodeText(entries.get('word/styles.xml'))

  assert.match(styles, /w:ascii="Georgia"/, 'body font is the first NAMED family of the stack')
  assert.match(styles, /w:ascii="Rockwell"/, 'headings take their own')
  assert.match(styles, /<w:color w:val="7A0019"\/>/, 'headings carry the highlight, hash stripped')
  assert.doesNotMatch(styles, /system-ui|sans-serif/, 'CSS generics never reach Word')
  assert.doesNotMatch(styles, /background/i, 'and neither does the background image')
})

test('"System default" leaves Word on its own default font', async () => {
  // It resolves to a stack whose first named face is Segoe UI, but emitting
  // that would put a font on every document that never had one. The default
  // branding has to be a no-op in Word exactly as it is in the CSS.
  const capture = setBranding(await authored(), { fontBody: 'system', fontHeading: 'system' })
  const entries = await readDocx(await emitDocx(capture, { lang: 'en' }))
  const styles = decodeText(entries.get('word/styles.xml'))
  assert.doesNotMatch(styles, /w:rFonts/, 'no font override at all')
})

test('an unbranded capture still produces the sizes Word always had', async () => {
  const entries = await readDocx(await emitDocx(await authored(), { lang: 'en' }))
  const styles = decodeText(entries.get('word/styles.xml'))
  assert.match(styles, /<w:sz w:val="22"\/>/, 'the familiar 11pt body')
})

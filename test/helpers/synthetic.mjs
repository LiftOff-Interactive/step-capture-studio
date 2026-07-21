/**
 * Builds synthetic Snagit-shaped .docx files in memory for tests.
 *
 * Nothing here is ever written to disk. The real sample capture shows internal
 * systems and can never enter this repo, and generating fixtures in memory
 * means the "no capture files, ever" rule needs no exceptions while the test
 * suite still runs anywhere.
 *
 * Test-only. Uses node:zlib, which never ships — the browser code in src/ has
 * no dependencies at all.
 *
 * Structure mirrors the real export, verified 2026-07-21:
 *   paragraph 0      title (application name)
 *   paragraph 1      "Author | N steps | duration"
 *   paragraph 2      date
 *   paragraphs 3+    alternating step text / image
 * XML parts are Deflate; PNGs are Stored. Same as Word writes.
 */

import { deflateRawSync, deflateSync } from 'node:zlib'

// ---------------------------------------------------------------- CRC32 ----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ------------------------------------------------------------ ZIP writer ----

/**
 * Minimal ZIP writer. Also serves as an early proof of the ZIP half of the
 * Stage 4 accessible-.docx writer — see staging/stage-4-ship/overview.md.
 *
 * @param {Array<{name: string, data: Uint8Array, deflate?: boolean}>} files
 */
export function makeZip(files) {
  const chunks = []
  const central = []
  let offset = 0

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name)
    const crc = crc32(file.data)
    const stored = file.deflate ? new Uint8Array(deflateRawSync(file.data)) : file.data
    const method = file.deflate ? 8 : 0

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)      // version needed
    lv.setUint16(6, 0x0800, true)  // UTF-8 filenames
    lv.setUint16(8, method, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, stored.length, true)
    lv.setUint32(22, file.data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)

    chunks.push(local, stored)

    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, method, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, stored.length, true)
    cv.setUint32(24, file.data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += local.length + stored.length
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  return concat([...chunks, ...central, eocd])
}

function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

// ----------------------------------------------------------- PNG writer ----

function pngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type)
  const body = concat([typeBytes, data])
  const out = new Uint8Array(8 + data.length + 4)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(body, 4)
  view.setUint32(8 + data.length, crc32(body))
  return out
}

/** A real, valid PNG of the given size, filled with a solid colour. */
export function makePng(width, height, rgb = [70, 90, 130]) {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdrData = new Uint8Array(13)
  const iv = new DataView(ihdrData.buffer)
  iv.setUint32(0, width)
  iv.setUint32(4, height)
  ihdrData[8] = 8   // bit depth
  ihdrData[9] = 2   // colour type: truecolour RGB

  const raw = new Uint8Array(height * (1 + width * 3))
  let at = 0
  for (let y = 0; y < height; y++) {
    raw[at++] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      raw[at++] = rgb[0]
      raw[at++] = rgb[1]
      raw[at++] = rgb[2]
    }
  }

  return concat([
    signature,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', new Uint8Array(deflateSync(raw))),
    pngChunk('IEND', new Uint8Array(0)),
  ])
}

// ------------------------------------------------------- Snagit document ----

const escapeXml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const textParagraph = (text) =>
  `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`

/**
 * A paragraph whose text is split across several runs — which is what Word
 * actually does. In the real sample the metadata line arrives as two runs
 * ("A. Author" + " | 10 steps | 1 minute"). Any parser reading only the first
 * run truncates silently, so fixtures must reproduce this.
 */
const multiRunParagraph = (parts) =>
  `<w:p>${parts
    .map((part) => `<w:r><w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`)
    .join('')}</w:p>`

const imageParagraph = (relId) =>
  `<w:p><w:r><w:drawing><wp:inline>` +
  `<wp:extent cx="5943600" cy="3409950"/>` +
  `<wp:docPr id="${relId}" name="Picture ${relId}"/>` +
  `<a:graphic><a:graphicData><pic:pic><pic:blipFill>` +
  `<a:blip r:embed="rId${relId}"/>` +
  `</pic:blipFill></pic:pic></a:graphicData></a:graphic>` +
  `</wp:inline></w:drawing></w:r></w:p>`

/**
 * Build a synthetic Snagit-style capture.
 *
 * @param {object} options
 * @param {string} [options.title]      application name (paragraph 0)
 * @param {string} [options.author]
 * @param {string} [options.date]
 * @param {string[]} options.steps      step text WITHOUT the "N. " prefix
 * @param {number} [options.width]      screenshot width
 * @param {number} [options.height]     screenshot height
 * @param {boolean} [options.orphanImage]  append an image with no step text
 * @param {boolean} [options.orphanText]   append step text with no image
 * @param {boolean} [options.splitStepRuns] split each step across three runs
 * @param {number} [options.declaredStepCount] override the count in the meta line
 * @param {string} [options.duration]
 */
export function makeCapture(options) {
  const {
    title = 'Microsoft Edge',
    author = 'Test.Author',
    date = 'July 21, 2026',
    steps,
    width = 200,
    height = 120,
    orphanImage = false,
    orphanText = false,
    leadingImage = false,
    splitStepRuns = false,
    declaredStepCount = null,
    duration = '1 minute',
  } = options

  const body = [
    textParagraph(title),
    // Split across two runs, exactly as the real export does.
    multiRunParagraph([author, ` | ${declaredStepCount ?? steps.length} steps | ${duration}`]),
    textParagraph(date),
  ]

  const media = []
  const rels = []

  const addImage = (relId, rgb) => {
    media.push({ name: `word/media/image${relId}.png`, data: makePng(width, height, rgb) })
    rels.push(
      `<Relationship Id="rId${relId}" ` +
        `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
        `Target="media/image${relId}.png"/>`
    )
  }

  // An image before any numbered step — exercises the ORPHAN_IMAGE path.
  if (leadingImage) {
    const relId = steps.length + 2
    body.push(imageParagraph(relId))
    addImage(relId, [120, 200, 90])
  }

  steps.forEach((step, i) => {
    const relId = i + 1
    const line = `${relId}. ${step}`
    if (splitStepRuns) {
      // Break at arbitrary points, as Word does on formatting boundaries.
      const third = Math.ceil(line.length / 3)
      body.push(
        multiRunParagraph([line.slice(0, third), line.slice(third, third * 2), line.slice(third * 2)])
      )
    } else {
      body.push(textParagraph(line))
    }
    body.push(imageParagraph(relId))
    addImage(relId, [40 + i * 12, 90, 130])
  })

  if (orphanText) body.push(textParagraph(`${steps.length + 1}. A step with no screenshot`))

  // A trailing image after the last step — attaches to that step.
  if (orphanImage) {
    const relId = steps.length + 1
    body.push(imageParagraph(relId))
    addImage(relId, [200, 60, 60])
  }

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document ` +
    `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
    `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<w:body>${body.join('')}</w:body></w:document>`

  const relsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `${rels.join('')}</Relationships>`

  const coreXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties ` +
    `xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" ` +
    `xmlns:dcterms="http://purl.org/dc/terms/">` +
    `<dc:creator>${escapeXml(author)}</dc:creator>` +
    `<dcterms:created>2026-07-21T20:14:00Z</dcterms:created>` +
    `</cp:coreProperties>`

  const utf8 = (s) => new TextEncoder().encode(s)

  // XML deflated, PNGs stored — exactly what Word produced for the real sample.
  return makeZip([
    { name: '[Content_Types].xml', data: utf8('<?xml version="1.0"?><Types/>'), deflate: true },
    { name: 'word/document.xml', data: utf8(documentXml), deflate: true },
    { name: 'word/_rels/document.xml.rels', data: utf8(relsXml), deflate: true },
    { name: 'docProps/core.xml', data: utf8(coreXml), deflate: true },
    ...media,
  ])
}

/** The English sample, shaped like the real capture including its duplicates. */
export const ENGLISH_STEPS = [
  'Click on the web browser',
  'Click "Sign in"',
  'Click "My courses"',
  'Click "My courses"', // duplicate consecutive step, as real exports contain
  'Click "Course catalogue"',
]

/** A French capture — proves no logic keys off English verbs. */
export const FRENCH_STEPS = [
  'Cliquez sur le navigateur Web',
  'Cliquez sur « Se connecter »',
  'Cliquez sur « Mes cours »',
]

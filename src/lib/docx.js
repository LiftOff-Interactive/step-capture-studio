/**
 * Zero-dependency .docx reader.
 *
 * A .docx is a ZIP archive. Everything here uses only browser-native APIs, so
 * the shipped site has no runtime dependencies at all:
 *   - Deflate entries  -> DecompressionStream('deflate-raw')
 *   - Stored entries   -> sliced straight out of the byte buffer
 *
 * Confirmed against a real Snagit export: XML parts are Deflate, PNGs are
 * Stored. We handle both methods for every entry regardless, because that
 * split is what Word happened to write for one file, not a guarantee.
 *
 * We read the ZIP central directory rather than scanning local file headers,
 * so entries written with data descriptors (sizes of 0 in the local header)
 * still resolve correctly.
 */

const SIG_LOCAL_HEADER = 0x04034b50
const SIG_CENTRAL_DIR = 0x02014b50
const SIG_EOCD = 0x06054b50

const METHOD_STORED = 0
const METHOD_DEFLATE = 8

const EOCD_MIN_SIZE = 22
const MAX_ZIP_COMMENT = 0xffff

/**
 * Errors carry a stable `code` so the UI can look up a translated message.
 * Never surface `message` to users — it is not localised.
 */
export class DocxError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'DocxError'
    this.code = code
    this.detail = detail
  }
}

/** Inflate a raw deflate stream using the browser's built-in decompressor. */
async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new DocxError('BROWSER_UNSUPPORTED', 'DecompressionStream is unavailable')
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch (cause) {
    throw new DocxError('CORRUPT_ENTRY', cause?.message)
  }
}

/** Scan backwards for the End Of Central Directory record. */
function findEocd(view, length) {
  const earliest = Math.max(0, length - MAX_ZIP_COMMENT - EOCD_MIN_SIZE)
  for (let i = length - EOCD_MIN_SIZE; i >= earliest; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) return i
  }
  return -1
}

/**
 * Read every entry in a ZIP archive.
 * @param {Uint8Array} bytes
 * @returns {Promise<Map<string, Uint8Array>>} entry path -> raw bytes
 */
export async function readZip(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new DocxError('NOT_A_ZIP', 'expected Uint8Array')
  }
  if (bytes.length < EOCD_MIN_SIZE) {
    throw new DocxError('NOT_A_ZIP', 'file is too small to be an archive')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEocd(view, bytes.length)
  if (eocd === -1) {
    throw new DocxError('NOT_A_ZIP', 'no end-of-central-directory record')
  }

  const entryCount = view.getUint16(eocd + 10, true)
  const centralDirOffset = view.getUint32(eocd + 16, true)
  if (centralDirOffset >= bytes.length) {
    throw new DocxError('CORRUPT_ENTRY', 'central directory offset is out of range')
  }

  const decoder = new TextDecoder('utf-8')
  const entries = new Map()
  let cursor = centralDirOffset

  for (let i = 0; i < entryCount; i++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== SIG_CENTRAL_DIR) {
      throw new DocxError('CORRUPT_ENTRY', `bad central directory entry at ${cursor}`)
    }

    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength))

    cursor += 46 + nameLength + extraLength + commentLength

    // Directory markers carry no data.
    if (name.endsWith('/')) continue

    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== SIG_LOCAL_HEADER) {
      throw new DocxError('CORRUPT_ENTRY', `bad local header for ${name}`)
    }

    // The local header's name/extra lengths may differ from the central
    // directory's, so the data offset must be computed from the local header.
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataStart + compressedSize

    if (dataEnd > bytes.length) {
      throw new DocxError('CORRUPT_ENTRY', `${name} extends past end of file`)
    }

    const raw = bytes.subarray(dataStart, dataEnd)

    if (method === METHOD_STORED) {
      entries.set(name, raw.slice())
    } else if (method === METHOD_DEFLATE) {
      entries.set(name, await inflateRaw(raw))
    } else {
      throw new DocxError('UNSUPPORTED_COMPRESSION', `${name} uses method ${method}`)
    }
  }

  return entries
}

/**
 * Read a .docx and confirm it really is a Word document.
 * @param {Uint8Array} bytes
 * @returns {Promise<Map<string, Uint8Array>>}
 */
export async function readDocx(bytes) {
  const entries = await readZip(bytes)
  if (!entries.has('word/document.xml')) {
    throw new DocxError('NOT_A_DOCX', 'archive contains no word/document.xml')
  }
  return entries
}

/** Decode an entry's bytes as UTF-8 text. */
export function decodeText(bytes) {
  return new TextDecoder('utf-8').decode(bytes)
}

/**
 * Read pixel dimensions from a PNG's IHDR chunk.
 * Word records a *display* size that is usually smaller than the real image;
 * artifacts should use the native resolution, so we read it from the file.
 * @returns {{width: number, height: number}}
 */
export function pngSize(bytes) {
  const isPng =
    bytes.length >= 24 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  if (!isPng) throw new DocxError('NOT_A_PNG', 'missing PNG signature')

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

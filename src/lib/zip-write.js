/**
 * Minimal ZIP writer, browser-native.
 *
 * The counterpart to `docx.js`. Writing a `.docx` means writing a ZIP, and the
 * whole project rests on not adding a dependency to do it — so this mirrors the
 * reader: Deflate via `CompressionStream('deflate-raw')` for XML, Stored for
 * PNGs that are already compressed. Exactly the split Word itself produces.
 *
 * Deliberately not general-purpose. No ZIP64, no encryption, no directory
 * entries — an OOXML package needs none of them, and every feature omitted is
 * a format detail that cannot be got subtly wrong.
 */

const LOCAL_HEADER = 0x04034b50
const CENTRAL_HEADER = 0x02014b50
const EOCD = 0x06054b50

/** UTF-8 filename flag — bit 11. Without it, accented names decode wrongly. */
const FLAG_UTF8 = 0x0800

const METHOD_STORED = 0
const METHOD_DEFLATE = 8

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/**
 * Build a ZIP archive.
 *
 * @param {Array<{name: string, data: Uint8Array, deflate?: boolean}>} files
 * @returns {Promise<Uint8Array>}
 */
export async function writeZip(files) {
  const encoder = new TextEncoder()
  const local = []
  const central = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const crc = crc32(file.data)
    const stored = file.deflate ? await deflateRaw(file.data) : file.data
    const method = file.deflate ? METHOD_DEFLATE : METHOD_STORED

    const header = new Uint8Array(30 + nameBytes.length)
    const hv = new DataView(header.buffer)
    hv.setUint32(0, LOCAL_HEADER, true)
    hv.setUint16(4, 20, true) // version needed to extract
    hv.setUint16(6, FLAG_UTF8, true)
    hv.setUint16(8, method, true)
    hv.setUint16(10, 0, true) // mod time — fixed, so output is reproducible
    hv.setUint16(12, 0x21, true) // mod date: 1980-01-01, as Word writes
    hv.setUint32(14, crc, true)
    hv.setUint32(18, stored.length, true)
    hv.setUint32(22, file.data.length, true)
    hv.setUint16(26, nameBytes.length, true)
    header.set(nameBytes, 30)

    local.push(header, stored)

    const entry = new Uint8Array(46 + nameBytes.length)
    const ev = new DataView(entry.buffer)
    ev.setUint32(0, CENTRAL_HEADER, true)
    ev.setUint16(4, 20, true) // version made by
    ev.setUint16(6, 20, true) // version needed
    ev.setUint16(8, FLAG_UTF8, true)
    ev.setUint16(10, method, true)
    ev.setUint16(12, 0, true)
    ev.setUint16(14, 0x21, true)
    ev.setUint32(16, crc, true)
    ev.setUint32(20, stored.length, true)
    ev.setUint32(24, file.data.length, true)
    ev.setUint16(28, nameBytes.length, true)
    ev.setUint32(42, offset, true)
    entry.set(nameBytes, 46)
    central.push(entry)

    offset += header.length + stored.length
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, EOCD, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)

  return concat([...local, ...central, end])
}

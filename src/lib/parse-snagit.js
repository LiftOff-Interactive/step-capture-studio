/**
 * Snagit .docx -> capture model.
 *
 * This is the adapter boundary. A future Steps Recorder parser emits this exact
 * shape, and no emitter ever learns which format the capture came from.
 *
 * The parser's job is FIDELITY, NOT IMPROVEMENT. Duplicate steps, odd wording
 * and missing images are reported, never fixed — cleanup belongs to the
 * authoring layer in Stage 2. Keeping this module free of "helpful" behaviour
 * is what makes its tests meaningful.
 *
 * Structure confirmed against a real export, 2026-07-21:
 *   paragraph 0      title (application name)
 *   paragraph 1      "Author | N steps | duration"
 *   paragraph 2      date
 *   paragraphs 3+    alternating step text / image
 *
 * Two hard-won constraints:
 *   1. Word splits a paragraph's text across MULTIPLE <w:t> runs at arbitrary
 *      points. The real sample's metadata line is two runs. Always concatenate
 *      every run in a paragraph — reading the first silently truncates.
 *   2. Never key logic off English words. Captures may be French ("Cliquez
 *      sur"). Only the "N." numbering pattern is matched.
 */

import { readDocx, decodeText, pngSize } from './docx.js'

/** Leading step number, e.g. "12. " or "3) ". The only text pattern we match. */
const STEP_NUMBER = /^\s*(\d+)\s*[.)]\s*/

const XML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}

function unescapeXml(text) {
  return text
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m])
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
}

/**
 * Split the body into top-level <w:p> paragraphs, depth-aware.
 *
 * Depth tracking matters because a paragraph inside a text box or drawing is
 * nested in another paragraph; a naive regex would treat the inner one as a
 * sibling and scramble document order. The lookahead prevents <w:pPr> and
 * friends from matching.
 */
function extractParagraphs(xml) {
  const paragraphs = []
  const tag = /<(\/?)w:p(?=[\s>/])([^>]*)>/g
  let depth = 0
  let start = -1
  let match

  while ((match = tag.exec(xml)) !== null) {
    const isClosing = match[1] === '/'
    const isSelfClosing = match[2].endsWith('/')

    if (isClosing) {
      depth--
      if (depth === 0 && start >= 0) {
        paragraphs.push(xml.slice(start, tag.lastIndex))
        start = -1
      }
    } else if (isSelfClosing) {
      if (depth === 0) paragraphs.push(match[0])
    } else {
      if (depth === 0) start = match.index
      depth++
    }
  }

  return paragraphs
}

/** All text runs in a paragraph, concatenated. See constraint 1 above. */
function paragraphText(paragraph) {
  const runs = paragraph.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || []
  return runs
    .map((run) => unescapeXml(run.replace(/^<w:t(?:\s[^>]*)?>/, '').replace(/<\/w:t>$/, '')))
    .join('')
}

/** Relationship ids of every image embedded in a paragraph, in document order. */
function paragraphEmbeds(paragraph) {
  return [...paragraph.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1])
}

/** relationship id -> target path, e.g. rId4 -> media/image1.png */
function parseRelationships(xml) {
  const map = new Map()
  for (const rel of xml.match(/<Relationship\b[^>]*\/?>/g) || []) {
    const id = rel.match(/\bId="([^"]+)"/)
    const target = rel.match(/\bTarget="([^"]+)"/)
    if (id && target) map.set(id[1], target[1])
  }
  return map
}

function firstTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`))
  return match ? unescapeXml(match[1]).trim() : null
}

/** "A. Author | 10 steps | 1 minute" -> its parts, defensively. */
function parseMetaLine(text) {
  const parts = text.split('|').map((p) => p.trim())
  const countPart = parts.find((p) => /\d/.test(p) && parts.indexOf(p) > 0)
  const declared = countPart ? Number(countPart.match(/\d+/)?.[0]) : null
  return {
    author: parts[0] || null,
    declaredStepCount: Number.isFinite(declared) ? declared : null,
    duration: parts.length > 2 ? parts[parts.length - 1] : null,
  }
}

function emptyLangMap(languages) {
  return Object.fromEntries(languages.map((code) => [code, null]))
}

/**
 * Parse a Snagit step-capture .docx into the capture model.
 *
 * @param {Uint8Array} bytes
 * @param {object} [options]
 * @param {string} [options.sourceLang='en'] language the capture was recorded in
 * @param {string[]} [options.languages=['en','fr']] language codes the model carries
 */
export async function parseSnagitDocx(bytes, options = {}) {
  const { sourceLang = 'en', languages = ['en', 'fr'] } = options
  const langs = languages.includes(sourceLang) ? languages : [sourceLang, ...languages]

  const entries = await readDocx(bytes)
  const documentXml = decodeText(entries.get('word/document.xml'))
  const relsEntry = entries.get('word/_rels/document.xml.rels')
  const coreEntry = entries.get('docProps/core.xml')

  const relationships = relsEntry ? parseRelationships(decodeText(relsEntry)) : new Map()
  const coreXml = coreEntry ? decodeText(coreEntry) : ''

  const paragraphs = extractParagraphs(documentXml)
  const warnings = []

  const capture = {
    title: null,
    author: firstTag(coreXml, 'dc:creator'),
    duration: null,
    createdAt: firstTag(coreXml, 'dcterms:created'),
    date: null,
    sourceLang,
    languages: langs,
    declaredStepCount: null,
    steps: [],
    warnings,
  }

  const header = []
  let current = null

  for (const paragraph of paragraphs) {
    const text = paragraphText(paragraph).trim()
    const embeds = paragraphEmbeds(paragraph)
    const numbering = text.match(STEP_NUMBER)

    if (numbering) {
      // A numbered paragraph always starts a new step.
      const declaredNumber = Number(numbering[1])
      const index = capture.steps.length + 1
      if (declaredNumber !== index) {
        warnings.push({
          code: 'STEP_NUMBER_MISMATCH',
          stepIndex: index,
          detail: `document order ${index}, document says ${declaredNumber}`,
        })
      }
      current = {
        index,
        text: { ...emptyLangMap(langs), [sourceLang]: text.replace(STEP_NUMBER, '') },
        images: [],
      }
      capture.steps.push(current)
    } else if (!embeds.length && text) {
      if (current) {
        // Continuation of the current step, e.g. a wrapped or split line.
        current.text[sourceLang] = `${current.text[sourceLang]} ${text}`.trim()
      } else {
        header.push(text)
      }
    }

    for (const embedId of embeds) {
      const target = relationships.get(embedId)
      const path = target ? `word/${target.replace(/^\.?\//, '')}` : null
      const imageBytes = path ? entries.get(path) : undefined

      if (!imageBytes) {
        warnings.push({
          code: 'MISSING_IMAGE',
          stepIndex: current?.index ?? null,
          detail: `${embedId} -> ${path ?? 'unresolved'}`,
        })
        continue
      }

      let width = null
      let height = null
      try {
        ;({ width, height } = pngSize(imageBytes))
      } catch {
        warnings.push({
          code: 'UNKNOWN_IMAGE_FORMAT',
          stepIndex: current?.index ?? null,
          detail: path,
        })
      }

      const image = {
        id: embedId,
        path,
        bytes: imageBytes,
        width,
        height,
        alt: emptyLangMap(langs),
      }

      if (current) {
        current.images.push(image)
      } else {
        // An image before any numbered step. Preserved, never dropped.
        warnings.push({ code: 'ORPHAN_IMAGE', stepIndex: null, detail: path })
        capture.steps.push({
          index: capture.steps.length + 1,
          text: emptyLangMap(langs),
          images: [image],
        })
      }
    }
  }

  // Header paragraphs: title, then the "author | N steps | duration" line, then date.
  const metaIndex = header.findIndex((line) => line.includes('|'))
  if (metaIndex !== -1) {
    const meta = parseMetaLine(header[metaIndex])
    capture.author = meta.author || capture.author
    capture.duration = meta.duration
    capture.declaredStepCount = meta.declaredStepCount
    capture.title = header.slice(0, metaIndex).join(' ').trim() || null
    capture.date = header.slice(metaIndex + 1).join(' ').trim() || null
  } else {
    capture.title = header[0] || null
    capture.date = header[1] || null
  }

  // Report, do not repair.
  for (const step of capture.steps) {
    if (!step.images.length) {
      warnings.push({ code: 'STEP_WITHOUT_IMAGE', stepIndex: step.index, detail: null })
    }
  }
  for (let i = 1; i < capture.steps.length; i++) {
    const previous = capture.steps[i - 1].text[sourceLang]
    const currentText = capture.steps[i].text[sourceLang]
    if (previous && currentText && previous === currentText) {
      warnings.push({
        code: 'DUPLICATE_STEP_TEXT',
        stepIndex: capture.steps[i].index,
        detail: currentText,
      })
    }
  }
  if (capture.declaredStepCount !== null && capture.declaredStepCount !== capture.steps.length) {
    warnings.push({
      code: 'STEP_COUNT_MISMATCH',
      stepIndex: null,
      detail: `document says ${capture.declaredStepCount}, parsed ${capture.steps.length}`,
    })
  }

  return capture
}

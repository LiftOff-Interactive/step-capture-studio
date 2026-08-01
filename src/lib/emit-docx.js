/**
 * Artifact 4 — an accessible Word document.
 *
 * Flagged as the project's highest-risk item from day one, because writing
 * OOXML by hand is unforgiving: a malformed package makes Word offer to
 * "repair" the file, which to a user reads as corruption.
 *
 * What "accessible" means concretely here, and what Word's own Accessibility
 * Checker looks for:
 *   - **Real heading styles.** `w:pStyle` referencing styles declared in
 *     styles.xml, not bold text pretending to be a heading. This is what makes
 *     the document navigable.
 *   - **Alt text on every image**, via `wp:docPr/@descr`. A missing descr is
 *     the checker's most common error.
 *   - **A document title** in `docProps/core.xml`, which the checker requires.
 *   - **Language marked** on every run, so a screen reader pronounces French
 *     with French phonetics.
 *
 * One language per file. A Word document has no toggle, so a bilingual one
 * would just be two documents interleaved; the filename carries the language
 * instead.
 */

import { writeZip } from './zip-write.js'
import { altFor, captureTitle, imageType } from './emit-common.js'
import { t } from './i18n.js'
import { brandingOf, FONT_STACKS, SIZE_LIMITS, SCALE_LIMITS, isHexColour } from './branding.js'

/** English Metric Units: 914400 per inch, 9525 per pixel at 96 dpi. */
const EMU_PER_PX = 9525
/** Letter page, one-inch margins — 6.5in of usable width. */
const CONTENT_WIDTH_EMU = 6.5 * 914400

const LOCALE_TAGS = { en: 'en-CA', fr: 'fr-CA' }
const localeTag = (code) => LOCALE_TAGS[code] ?? code

const utf8 = (text) => new TextEncoder().encode(text)

/** XML text and attribute escaping. */
function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Control characters are illegal in XML 1.0 and make Word reject the file.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

/** Scale an image to the content width, preserving aspect ratio. */
function extent(image) {
  const width = image.width || 600
  const height = image.height || 400
  let cx = width * EMU_PER_PX
  let cy = height * EMU_PER_PX
  if (cx > CONTENT_WIDTH_EMU) {
    cy = Math.round((cy * CONTENT_WIDTH_EMU) / cx)
    cx = CONTENT_WIDTH_EMU
  }
  return { cx: Math.round(cx), cy: Math.round(cy) }
}

/** A run of text, with its language declared. */
function run(text, lang, { bold = false } = {}) {
  const tag = localeTag(lang)
  return (
    `<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:lang w:val="${tag}"/></w:rPr>` +
    `<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`
  )
}

const paragraph = (style, inner) =>
  `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}</w:pPr>${inner}</w:p>`

/**
 * An inline image with alt text.
 *
 * `descr` is the alt text Word's Accessibility Checker reads. `name` is not a
 * substitute for it — a file name is not a description.
 */
function drawing(image, relId, docPrId, altText) {
  const { cx, cy } = extent(image)
  return (
    `<w:p><w:pPr><w:pStyle w:val="Figure"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${docPrId}" name="Picture ${docPrId}" descr="${xml(altText)}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${docPrId}" name="Picture ${docPrId}" descr="${xml(altText)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  )
}

/**
 * Branding, translated from CSS into what OOXML understands.
 *
 * Only three of the branding options have a meaning in Word. Fonts become the
 * first *named* family of the chosen stack — Word cannot fall back through a
 * CSS-style list, so `system-ui` and other generic keywords are dropped and the
 * document simply keeps Word's default when nothing named remains.
 *
 * Sizes are half-points here, not rem, and the base scales the heading sizes
 * with it. The gradient and the background image have no equivalent: Word has
 * no page gradient worth the OOXML, and a background image behind body text is
 * the opposite of accessible in a document meant to be printed.
 */
function docxBranding(capture) {
  const b = brandingOf(capture)
  const named = (key) => {
    // "System default" means Word's own default, so it emits no override at
    // all. Resolving it to the stack's first named face (Segoe UI) would put a
    // font on every document that never had one — the default has to stay a
    // no-op here exactly as it does in the CSS.
    if (key === 'system') return null
    return (FONT_STACKS[key] ?? '')
      .split(',')
      .map((part) => part.trim().replace(/^["']|["']$/g, ''))
      .find((part) => part && !/^(system-ui|ui-monospace|sans-serif|serif|monospace|-apple-system)$/.test(part))
  }

  const size = Math.min(SIZE_LIMITS.max, Math.max(SIZE_LIMITS.min, Number(b.baseSize) || 16))
  const scale = Math.min(SCALE_LIMITS.max, Math.max(SCALE_LIMITS.min, Number(b.headingScale) || 1.25))
  // Half-points: Word's unit. 16px of body text is its familiar 22 half-points.
  const half = (rem) => Math.round(size * rem * 1.375)

  return {
    bodyFont: named(b.fontBody),
    headingFont: named(b.fontHeading),
    // Word wants RRGGBB with no hash.
    headingColour: isHexColour(b.highlight) ? b.highlight.slice(1).toUpperCase() : null,
    body: half(1),
    h1: half(scale ** 2),
    h2: half(scale),
    title: half(scale ** 3),
  }
}

function stylesXml(lang, brand) {
  const tag = localeTag(lang)
  const fonts = (family) =>
    family
      ? `<w:rFonts w:ascii="${xml(family)}" w:hAnsi="${xml(family)}" w:cs="${xml(family)}"/>`
      : ''
  const colour = brand.headingColour ? `<w:color w:val="${brand.headingColour}"/>` : ''

  const heading = (id, name, size, outline) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>` +
    `<w:basedOn w:val="Normal"/><w:qFormat/>` +
    `<w:pPr><w:outlineLvl w:val="${outline}"/><w:spacing w:before="240" w:after="120"/><w:keepNext/></w:pPr>` +
    `<w:rPr>${fonts(brand.headingFont)}<w:b/>${colour}<w:sz w:val="${size}"/></w:rPr></w:style>`

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults><w:rPrDefault><w:rPr>${fonts(brand.bodyFont)}<w:lang w:val="${tag}"/><w:sz w:val="${brand.body}"/></w:rPr></w:rPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    // Title is a real style, not a large paragraph — the checker treats it as
    // document structure.
    `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/>` +
    `<w:pPr><w:outlineLvl w:val="0"/><w:spacing w:after="240"/></w:pPr>` +
    `<w:rPr>${fonts(brand.headingFont)}<w:b/>${colour}<w:sz w:val="${brand.title}"/></w:rPr></w:style>` +
    heading('Heading1', 'heading 1', brand.h1, 0) +
    heading('Heading2', 'heading 2', brand.h2, 1) +
    `<w:style w:type="paragraph" w:styleId="Figure"><w:name w:val="Figure"/><w:basedOn w:val="Normal"/>` +
    `<w:pPr><w:spacing w:before="120" w:after="120"/><w:keepNext/></w:pPr></w:style>` +
    `</w:styles>`
  )
}

/**
 * Emit an accessible `.docx` for one language.
 *
 * @param {object} capture   a fully authored capture
 * @param {object} [options]
 * @param {string} [options.lang] language code; defaults to the source language
 * @returns {Promise<Uint8Array>}
 */
export async function emitDocx(capture, { lang = capture.sourceLang ?? 'en' } = {}) {
  const tag = localeTag(lang)
  const title = captureTitle(capture, lang)
  const total = capture.steps.length

  const media = []
  const rels = []
  const body = []
  // Image extensions actually used, so [Content_Types].xml declares a Default
  // for each and no more. An undeclared extension is a part Word cannot type.
  const mediaExts = new Set()
  let relIndex = 0
  let docPrId = 1

  body.push(paragraph('Title', run(title, lang)))

  const subtitle = [capture.author, capture.date].filter(Boolean).join(' · ')
  if (subtitle) body.push(paragraph(null, run(subtitle, lang)))

  for (const step of capture.steps) {
    body.push(paragraph('Heading1', run(t('step.label', lang, { index: step.index, total }), lang)))

    for (const image of step.images) {
      relIndex++
      const relId = `rId${relIndex}`
      // The extension must match the actual bytes. Word keys the part's content
      // type off it via the Default entry in [Content_Types].xml, and a JPEG
      // named .png is exactly the kind of internally-consistent-but-wrong file
      // Word offers to "repair".
      const { ext } = imageType(image.bytes)
      const name = `media/image${relIndex}.${ext}`
      mediaExts.add(ext)
      media.push({ name: `word/${name}`, data: image.bytes })
      rels.push(
        `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${name}"/>`
      )
      // Throws if alt text is missing — the export gate should have stopped
      // this, and shipping an image with no description is the single most
      // common accessibility failure in a Word document.
      body.push(drawing(image, relId, docPrId++, altFor(image, lang)))
    }

    const text = step.text?.[lang]
    body.push(paragraph(null, run(text?.trim() || t('step.noText', lang), lang)))

    // Case-study narrative, when the author has written any.
    for (const field of ['why', 'ifSkipped']) {
      const passage = step.narrative?.[field]?.[lang]
      if (!passage?.text?.trim() || passage.drafted) continue
      body.push(paragraph('Heading2', run(t(`caseStudy.${field}`, lang), lang)))
      body.push(paragraph(null, run(passage.text.trim(), lang)))
    }
  }

  // Section properties close the body: Letter portrait, one-inch margins.
  body.push(
    `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>` +
      `<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`
  )

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
    `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
    `<w:body>${body.join('')}</w:body></w:document>`

  // Word writes seconds as :00; matching that avoids any W3CDTF quibble.
  const now = new Date().toISOString().replace(/:\d\d\.\d+Z$/, ':00Z')

  /**
   * Core properties, shaped exactly like a Word-authored file's.
   *
   * ⚠️ **Do not add `<dc:language>` here.** Including it makes Word discard the
   * ENTIRE core properties part: a Word re-save came back with an empty title
   * and an empty creator. Verified by bisection against Word 16.0, with a
   * control proving Word does preserve these fields from its own files.
   * Removing that one element fixed it outright.
   *
   * Nothing is lost by omitting it — the document language is carried by
   * `w:lang` on every run and in `docDefaults`, which Word reads correctly
   * (it reports LanguageID 4105 for en-CA). The document title is an explicit
   * Accessibility Checker requirement, so keeping this part readable matters.
   */
  const coreXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:dcmitype="http://purl.org/dc/dcmitype/" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${xml(title)}</dc:title>` +
    `<dc:subject></dc:subject>` +
    `<dc:creator>${xml(capture.author ?? '')}</dc:creator>` +
    `<cp:keywords></cp:keywords>` +
    `<dc:description></dc:description>` +
    `<cp:lastModifiedBy>${xml(capture.author ?? '')}</cp:lastModifiedBy>` +
    `<cp:revision>1</cp:revision>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    `</cp:coreProperties>`

  const appXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">` +
    `<Application>step-capture-studio</Application></Properties>`

  /**
   * Settings — required, and required for one specific reason.
   *
   * ⚠️ **Do not remove `compatibilityMode`.** Word infers the format era from
   * this single setting. With no `settings.xml` at all, Word assumes the 2007
   * era and opens the file in **Compatibility Mode**: "This document is in an
   * older format with limited functionality." One of the functions it limits
   * is the **Accessibility Checker**, which is disabled outright — so the file
   * cannot be checked without converting it first, and a converted file is
   * Word's document, not ours. Verified against Word 16.0 by a human, 2026-07-22.
   *
   * `15` is the Word 2013+ mode, which is what makes the modern checker
   * available. This part existing is not cosmetic: without it the export can
   * never satisfy its own accessibility criterion.
   */
  const settingsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:compat>` +
    `<w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>` +
    `</w:compat>` +
    `</w:settings>`

  // One Default per image extension actually embedded. `image/jpeg` uses the
  // `.jpeg` extension to match the part names written above; `.jpg` is a
  // separate token to OPC and would need its own Default.
  const IMAGE_CONTENT_TYPES = {
    png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  }
  const imageDefaults = [...mediaExts]
    .map((ext) => `<Default Extension="${ext}" ContentType="${IMAGE_CONTENT_TYPES[ext]}"/>`)
    .join('')

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    imageDefaults +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`

  const packageRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`

  const documentRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>` +
    rels.join('') +
    `</Relationships>`

  // [Content_Types].xml must be the first entry in the package.
  return writeZip([
    { name: '[Content_Types].xml', data: utf8(contentTypes), deflate: true },
    { name: '_rels/.rels', data: utf8(packageRels), deflate: true },
    { name: 'word/document.xml', data: utf8(documentXml), deflate: true },
    { name: 'word/_rels/document.xml.rels', data: utf8(documentRels), deflate: true },
    { name: 'word/styles.xml', data: utf8(stylesXml(lang, docxBranding(capture))), deflate: true },
    { name: 'word/settings.xml', data: utf8(settingsXml), deflate: true },
    { name: 'docProps/core.xml', data: utf8(coreXml), deflate: true },
    { name: 'docProps/app.xml', data: utf8(appXml), deflate: true },
    ...media,
  ])
}

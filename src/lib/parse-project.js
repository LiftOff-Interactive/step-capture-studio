/**
 * Read a project file back into a capture.
 *
 * The exact inverse of `emit-project.js` — every attribute written there is
 * read here, and `test/project-roundtrip.test.js` asserts a fully authored
 * capture survives the round trip unchanged. **Change one file and you must
 * change the other.**
 *
 * Text comes from `textContent`, not from an attribute, so editing the prose in
 * a text editor genuinely changes the imported capture. State that has no
 * visible form — confirmation, decorative, drafted — comes from `data-`
 * attributes on the element that owns it.
 *
 * This parser is deliberately strict about *structure* and forgiving about
 * *content*. A file that is not one of ours is refused outright rather than
 * half-imported: a capture whose text does not match its images is worse than
 * no import at all, which is the same reasoning `draft.js` applies to a
 * mismatched draft.
 */

import { NARRATIVE_FIELDS, SCENARIO_FIELDS } from './case-study.js'

export class ProjectError extends Error {
  constructor(code, detail) {
    super(code)
    this.name = 'ProjectError'
    this.code = code
    this.detail = detail
  }
}

/** Bytes from a `data:` URI, in both the browser and Node. */
function bytesFromDataUri(uri) {
  const comma = uri.indexOf(',')
  if (comma === -1 || !uri.startsWith('data:')) {
    throw new ProjectError('PROJECT_IMAGE_UNREADABLE', uri.slice(0, 32))
  }
  const base64 = uri.slice(comma + 1)
  if (typeof atob === 'function') {
    const binary = atob(base64)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
    return out
  }
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

/** Trimmed text, or null — the model uses null for "nothing here", never "". */
const textOrNull = (element) => {
  const text = element?.textContent?.trim()
  return text ? text : null
}

/** Map language code -> value, over the children of one container. */
function byLanguage(container, selector, languages, read) {
  const out = Object.fromEntries(languages.map((code) => [code, null]))
  if (!container) return out
  for (const element of container.querySelectorAll(selector)) {
    const code = element.getAttribute('data-lang-block')
    if (code && code in out) out[code] = read(element)
  }
  return out
}

/**
 * Parse a project file.
 *
 * @param {string} html   the file's text
 * @param {Document} [doc] a DOMParser-produced document, for environments
 *                         where one is already available
 * @returns {object} a capture
 */
export function parseProject(html, DOMParserImpl = globalThis.DOMParser) {
  if (!DOMParserImpl) throw new ProjectError('PROJECT_NO_PARSER')

  const doc = new DOMParserImpl().parseFromString(html, 'text/html')
  const root = doc.documentElement

  // Refuse anything that is not ours, rather than importing a wrong shape.
  if (root?.getAttribute('data-project') !== 'step-capture-studio') {
    throw new ProjectError('PROJECT_NOT_RECOGNISED')
  }

  const languages = (root.getAttribute('data-languages') || 'en').split(/\s+/).filter(Boolean)
  if (!languages.length) throw new ProjectError('PROJECT_NO_LANGUAGES')
  const sourceLang = root.getAttribute('data-source-lang') || languages[0]

  const declared = root.getAttribute('data-declared-step-count')
  const attr = (name) => {
    const value = root.getAttribute(name)
    return value ? value : null
  }

  const stepNodes = [...doc.querySelectorAll('.project-step')]
  if (!stepNodes.length) throw new ProjectError('PROJECT_NO_STEPS')

  const steps = stepNodes.map((node, position) => {
    const declaredIndex = Number(node.getAttribute('data-step-index'))
    // Position wins over the stored index: a hand-edited file with a step
    // deleted must renumber, not leave a gap the rest of the app cannot use.
    const index = position + 1

    const images = [...node.querySelectorAll('figure[data-image-id]')].map((figure) => {
      const img = figure.querySelector('img')
      const source = img?.getAttribute('src')
      if (!source) throw new ProjectError('PROJECT_IMAGE_MISSING', figure.getAttribute('data-image-id'))

      const caption = figure.querySelector('figcaption')
      const width = Number(figure.getAttribute('data-width')) || null
      const height = Number(figure.getAttribute('data-height')) || null

      return {
        id: figure.getAttribute('data-image-id'),
        path: figure.getAttribute('data-image-path') ?? null,
        bytes: bytesFromDataUri(source),
        width,
        height,
        alt: byLanguage(caption, '[data-field="alt"]', languages, textOrNull),
        altConfirmed: byLanguage(caption, '[data-field="alt"]', languages, (element) => {
          // An unconfirmed flag on empty text would be meaningless; the model
          // treats empty-and-confirmed as impossible, so keep them consistent.
          const confirmed = element.getAttribute('data-confirmed') === 'true'
          return confirmed && Boolean(textOrNull(element))
        }),
        decorative: figure.getAttribute('data-decorative') === 'true',
      }
    })

    const narrative = Object.fromEntries(
      NARRATIVE_FIELDS.map((field) => {
        const container = node.querySelector(`.note[data-narrative-field="${field}"]`)
        return [
          field,
          Object.fromEntries(
            languages.map((code) => {
              const element = container?.querySelector(`[data-lang-block="${code}"]`)
              return [
                code,
                {
                  text: textOrNull(element),
                  drafted: element?.getAttribute('data-drafted') === 'true',
                },
              ]
            })
          ),
        ]
      })
    )

    return {
      index,
      declaredIndex: Number.isFinite(declaredIndex) ? declaredIndex : null,
      text: byLanguage(node.querySelector('.step-text'), '[data-field="text"]', languages, textOrNull),
      images,
      narrative,
    }
  })

  const scenarioRoot = doc.querySelector('.scenario')
  const scenario = Object.fromEntries(
    SCENARIO_FIELDS.map((field) => [
      field,
      byLanguage(
        scenarioRoot?.querySelector(`[data-scenario-field="${field}"]`),
        '[data-lang-block]',
        languages,
        textOrNull
      ),
    ])
  )

  return {
    title: Object.fromEntries(
      languages.map((code) => [code, attr(`data-title-${code}`)])
    ),
    author: attr('data-author'),
    duration: attr('data-duration'),
    createdAt: attr('data-created-at'),
    date: attr('data-date'),
    sourceLang,
    languages,
    declaredStepCount: declared ? Number(declared) : null,
    scenario,
    steps: steps.map(({ declaredIndex, ...step }) => step),
    warnings: [],
  }
}

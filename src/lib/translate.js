/**
 * The bilingual round trip: build a prompt, take the answer back.
 *
 * The tool never calls a model. It assembles a complete, paste-ready prompt;
 * the author runs it in whatever assistant they already use and pastes the
 * result back. That keeps AI outside the trust boundary while still doing the
 * tedious part — see docs/decisions.md.
 *
 * Two design rules here, both about not lying to the author:
 *   1. **Never a silent partial import.** Anything that does not line up is
 *      named. An unknown id means the wrong text was pasted, so nothing is
 *      applied at all rather than half a translation landing invisibly.
 *   2. **Both return formats are accepted.** Chat interfaces mangle each one
 *      differently — JSON gets pretty-printed, wrapped in fences, or has its
 *      quotes smartened; delimited lines survive that but break on newlines
 *      inside a value. Accepting either is far more robust than betting on one.
 */

/** Ids are short and alphanumeric so no chat client reflows or linkifies them. */
const STEP_ID = (index) => `s${index}`
const ALT_ID = (index, position) => `s${index}a${position}`
/** Narrative ids match the case-study prompt's, so authors see one scheme. */
const NARRATIVE_ID = (index, field) => `s${index}${field === 'why' ? 'w' : 'b'}`
const NARRATIVE_FIELDS = ['why', 'ifSkipped']

const DELIMITER = '|||'

export class TranslationError extends Error {
  constructor(code, detail, ids = []) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'TranslationError'
    this.code = code
    this.detail = detail
    this.ids = ids
  }
}

/**
 * Every translatable string in the capture, as {id, text, kind} in a stable order.
 *
 * Alt text is included only once **confirmed** — translating a draft the author
 * has not accepted would launder an unreviewed guess into a second language.
 */
export function collectTranslatable(capture, from = capture.sourceLang) {
  const items = []

  for (const step of capture.steps) {
    const text = step.text?.[from]
    if (text?.trim()) {
      items.push({ id: STEP_ID(step.index), text: text.trim(), kind: 'step', stepIndex: step.index })
    }

    step.images.forEach((image, i) => {
      if (image.decorative) return
      if (!image.altConfirmed?.[from]) return
      const alt = image.alt?.[from]
      if (!alt?.trim()) return
      items.push({
        id: ALT_ID(step.index, i + 1),
        text: alt.trim(),
        kind: 'alt',
        stepIndex: step.index,
        imageId: image.id,
      })
    })

    // Case-study narrative, but only what a human stands behind. A drafted
    // passage nobody has reviewed must not be translated into a second
    // language — that would multiply an unchecked claim rather than catch it.
    for (const field of NARRATIVE_FIELDS) {
      const passage = step.narrative?.[field]?.[from]
      if (!passage?.text?.trim() || passage.drafted) continue
      items.push({
        id: NARRATIVE_ID(step.index, field),
        text: passage.text.trim(),
        kind: 'narrative',
        stepIndex: step.index,
        field,
      })
    }
  }

  return items
}

const LANGUAGE_LABEL = {
  en: 'Canadian English (en-CA)',
  fr: 'Canadian French (fr-CA)',
}

/**
 * Build the paste-ready prompt.
 *
 * @param {object} capture
 * @param {object} [options]
 * @param {string} [options.from] source language code
 * @param {string} [options.to]   target language code
 */
export function buildTranslationPrompt(capture, { from, to } = {}) {
  const source = from ?? capture.sourceLang
  const target = to ?? (capture.languages ?? []).find((code) => code !== source) ?? 'fr'
  const items = collectTranslatable(capture, source)

  if (!items.length) {
    throw new TranslationError('NOTHING_TO_TRANSLATE', 'no step text or confirmed alt text')
  }

  const sourceLabel = LANGUAGE_LABEL[source] ?? source
  const targetLabel = LANGUAGE_LABEL[target] ?? target

  return [
    `Translate the following software training strings from ${sourceLabel} to ${targetLabel}.`,
    '',
    'Context: these are steps from a click-by-click software guide, plus alt text describing',
    'screenshots. Lines beginning with an id like s3 are the instruction for that step. Lines with',
    'an id like s3a1 describe the screenshot for that step.',
    '',
    'Rules:',
    `- Translate into ${targetLabel}, not European French.`,
    '- Text inside quotation marks is a user-interface label. If the interface has an official',
    '  translated label, use it. If you are not certain one exists, translate literally and keep the',
    '  quotation marks.',
    '- Keep the imperative voice used for instructions.',
    '- Do not add, merge, remove or renumber any line.',
    '- You cannot see the screenshots, so do not invent detail that is not in the source text.',
    '',
    'Return format — return ONLY these lines, nothing before or after, one per input line:',
    `    <id> ${DELIMITER} <translation>`,
    '',
    'Strings to translate:',
    '',
    ...items.map((item) => `${item.id} ${DELIMITER} ${item.text}`),
  ].join('\n')
}

/** Strip markdown code fences a chat client may have wrapped the answer in. */
function stripFences(text) {
  return text
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?\s*```\s*$/, '')
    .trim()
}

/**
 * Parse a pasted response into id -> translation.
 *
 * Accepts the delimited line format, and also plain JSON (an object or an array
 * of `{id, text}`) because assistants often volunteer it regardless of what was
 * asked for.
 *
 * @returns {{entries: Map<string,string>, format: 'delimited'|'json'}}
 */
export function parseTranslationResponse(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new TranslationError('EMPTY_RESPONSE', 'nothing was pasted')
  }

  const text = stripFences(raw)
  const entries = new Map()
  const duplicates = []

  const add = (id, value) => {
    const key = String(id).trim()
    if (entries.has(key)) duplicates.push(key)
    entries.set(key, String(value).trim())
  }

  // --- JSON, if it happens to be JSON ------------------------------------
  if (/^[[{]/.test(text)) {
    try {
      const data = JSON.parse(text)
      if (Array.isArray(data)) {
        for (const row of data) {
          if (row && row.id != null) add(row.id, row.text ?? row.translation ?? '')
        }
      } else if (data && typeof data === 'object') {
        for (const [id, value] of Object.entries(data)) add(id, value)
      }
      if (entries.size) {
        if (duplicates.length) throw new TranslationError('DUPLICATE_IDS', null, [...new Set(duplicates)])
        return { entries, format: 'json' }
      }
    } catch (error) {
      if (error instanceof TranslationError) throw error
      // Not valid JSON after all — fall through to the line parser.
    }
  }

  // --- delimited lines ----------------------------------------------------
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const at = trimmed.indexOf(DELIMITER)
    if (at === -1) continue
    const id = trimmed.slice(0, at).trim()
    // Tolerate a leading bullet or numbering a chat client may have added.
    const cleanId = id.replace(/^[-*\d.)\s]+/, '').trim()
    if (!cleanId) continue
    add(cleanId, trimmed.slice(at + DELIMITER.length))
  }

  if (duplicates.length) {
    throw new TranslationError('DUPLICATE_IDS', null, [...new Set(duplicates)])
  }
  if (!entries.size) {
    throw new TranslationError(
      'UNPARSEABLE_RESPONSE',
      `no lines matched "<id> ${DELIMITER} <translation>"`
    )
  }

  return { entries, format: 'delimited' }
}

/**
 * Apply parsed translations to the capture.
 *
 * Throws on unknown ids — an id the capture does not contain means the pasted
 * text belongs to a different capture (or the model invented lines), and
 * applying the rest would leave a half-translated document that looks finished.
 *
 * Missing ids are applied-around and **reported**, never swallowed.
 *
 * Idempotent: applying the same response twice produces the same capture.
 *
 * @returns {{capture: object, applied: number, missing: Array<{id,kind,stepIndex}>}}
 */
export function applyTranslation(capture, entries, target, from = capture.sourceLang) {
  const expected = new Map(collectTranslatable(capture, from).map((item) => [item.id, item]))

  const unknown = [...entries.keys()].filter((id) => !expected.has(id))
  if (unknown.length) {
    throw new TranslationError('UNKNOWN_IDS', null, unknown)
  }

  let applied = 0
  const steps = capture.steps.map((step) => {
    let stepChanged = false
    let text = step.text
    let images = step.images

    const stepValue = entries.get(STEP_ID(step.index))
    if (stepValue) {
      text = { ...text, [target]: stepValue }
      stepChanged = true
      applied++
    }

    // Narrative arrives translated but still unconfirmed in the target
    // language, exactly as alt text does.
    let narrative = step.narrative
    for (const field of NARRATIVE_FIELDS) {
      const value = entries.get(NARRATIVE_ID(step.index, field))
      if (!value || !narrative?.[field]) continue
      narrative = {
        ...narrative,
        [field]: { ...narrative[field], [target]: { text: value, drafted: true } },
      }
      stepChanged = true
      applied++
    }

    const nextImages = images.map((image, i) => {
      const value = entries.get(ALT_ID(step.index, i + 1))
      if (!value) return image
      applied++
      stepChanged = true
      return {
        ...image,
        alt: { ...image.alt, [target]: value },
        // Machine translation is a draft in the target language too. The author
        // confirms it separately, exactly as they did for the source.
        altConfirmed: { ...image.altConfirmed, [target]: false },
      }
    })
    if (nextImages.some((image, i) => image !== images[i])) images = nextImages

    return stepChanged ? { ...step, text, images, narrative } : step
  })

  const missing = [...expected.values()]
    .filter((item) => !entries.has(item.id))
    .map(({ id, kind, stepIndex }) => ({ id, kind, stepIndex }))

  return { capture: { ...capture, steps }, applied, missing }
}

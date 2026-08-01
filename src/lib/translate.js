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
const TITLE_ID = 'title'
const STEP_ID = (index) => `s${index}`
const ALT_ID = (index, position) => `s${index}a${position}`
/** Narrative ids match the case-study prompt's, so authors see one scheme. */
const NARRATIVE_ID = (index, field) => `s${index}${field === 'why' ? 'w' : 'b'}`
const NARRATIVE_FIELDS = ['why', 'ifSkipped']
/**
 * Worked-example scenario ids. Defined here, not imported from case-study.js,
 * to avoid a circular import (case-study.js already imports from this file) —
 * the same reason NARRATIVE_FIELDS is duplicated above.
 */
const SCENARIO_FIELDS = ['audience', 'context', 'outcome']
const SCENARIO_ID = (field) => `about-${field}`

/**
 * Whether the capture will produce a worked example.
 *
 * Duplicated from case-study.js for the circular-import reason above. It is
 * behaviour rather than a constant, so keep the two in step: **absent means
 * included**, because every capture written before the choice existed had one.
 * case-study.js owns the definition; this is the read-only copy.
 */
const includesWorkedExample = (capture) => capture?.includeWorkedExample !== false

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
 * **Every populated field is offered** — title, scenario, step text, alt text,
 * and both worked-example fields (why / if skipped) — regardless of whether the
 * alt is confirmed or the narrative is still a draft. That reverses an earlier,
 * more cautious rule that excluded unconfirmed alt and drafted narrative.
 *
 * The reversal is safe because the *export* gates are unchanged and are the real
 * guard: a translated alt arrives unconfirmed and a translated narrative arrives
 * drafted, so neither can reach a shipped artifact until the author reviews it in
 * the target language (the accessibility gate demands confirmation in every
 * language; the worked-example gate blocks any drafted passage). Offering more to
 * translate here only saves the author from translating the rest by hand — it
 * cannot launder anything into a deliverable.
 */
export function collectTranslatable(capture, from = capture.sourceLang) {
  const items = []

  // The title first: it is the most visible string in every artifact, and the
  // one an author is most likely to notice missing.
  const title = typeof capture.title === 'string' ? capture.title : capture.title?.[from]
  if (title?.trim()) {
    items.push({ id: TITLE_ID, text: title.trim(), kind: 'title' })
  }

  // Worked-example scenario — the "about this procedure" details. Authored
  // directly (never drafted), so any non-empty field is the author's own words
  // and safe to translate.
  //
  // Both this and the narrative below are skipped when the worked example is
  // switched off. The strings stay in the model — switching back must restore
  // them — but sending prose out to be translated that nothing will read wastes
  // the author's own round trip, which is the scarce part of this workflow.
  const wantsWorkedExample = includesWorkedExample(capture)
  const scenario = capture.scenario ?? {}
  if (wantsWorkedExample) {
    for (const field of SCENARIO_FIELDS) {
      const value = scenario[field]?.[from]
      if (value?.trim()) {
        items.push({ id: SCENARIO_ID(field), text: value.trim(), kind: 'scenario', field })
      }
    }
  }

  for (const step of capture.steps) {
    const text = step.text?.[from]
    if (text?.trim()) {
      items.push({ id: STEP_ID(step.index), text: text.trim(), kind: 'step', stepIndex: step.index })
    }

    step.images.forEach((image, i) => {
      // A decorative image has no alt to translate; otherwise any populated alt
      // is offered, confirmed or not. The confirmation gate lives at export.
      if (image.decorative) return
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

    // Both worked-example fields, whenever populated — including drafts. A
    // translated draft arrives drafted and is blocked at export until reviewed,
    // so translating it now simply saves the author a manual pass later.
    if (!wantsWorkedExample) continue
    for (const field of NARRATIVE_FIELDS) {
      const passage = step.narrative?.[field]?.[from]
      if (!passage?.text?.trim()) continue
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
    'Context: these are strings from a click-by-click software guide. The line with the id "title"',
    'is the title of the whole guide. Lines with an id like about-audience describe the procedure',
    'as a whole (who it is for, what it is for, what success looks like). Lines beginning with an id',
    'like s3 are the instruction for that step; s3a1 describes that step\'s screenshot; s3w and s3b',
    'are the worked-example explanations of why the step matters and what breaks if it is skipped.',
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

  // The title is not per-step, so it is applied outside the step loop.
  let title = typeof capture.title === 'string' ? { [from]: capture.title } : capture.title ?? {}
  const titleValue = entries.get(TITLE_ID)
  if (titleValue) {
    title = { ...title, [target]: titleValue }
    applied++
  }

  // Scenario, likewise capture-level. The author authored the source language;
  // the translation lands in the target without disturbing it.
  let scenario = capture.scenario ?? {}
  for (const field of SCENARIO_FIELDS) {
    const value = entries.get(SCENARIO_ID(field))
    if (!value) continue
    scenario = {
      ...scenario,
      [field]: { ...scenario[field], [target]: value },
    }
    applied++
  }

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

  return { capture: { ...capture, title, scenario, steps }, applied, missing }
}

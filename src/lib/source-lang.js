/**
 * Correcting the language a capture was recorded in.
 *
 * The parser takes a `sourceLang` and files every parsed string under it. The
 * load path cannot know it — a Snagit `.docx` carries no language we trust, and
 * guessing from the step verbs is exactly what CLAUDE.md forbids — so it starts
 * at the default and the author corrects it here.
 *
 * "Correcting" means moving text, not relabelling it. A French capture parsed as
 * English has its French prose sitting in the `en` bucket; changing `sourceLang`
 * alone would leave it there, and every consumer downstream — the translation
 * prompt's direction, the `lang` attribute on the artifacts, the Word document's
 * proofing language — would still read it as English. So this **exchanges** the
 * two languages' buckets across the whole capture.
 *
 * An exchange loses nothing, which is precisely why it needs a gate: if the
 * author has already written or translated into the target language, swapping
 * would file that authored work under the other language and read as nonsense.
 * `sourceLangReadiness` reports what is in the way; `setSourceLang` refuses.
 *
 * Pure, like the rest of the authoring layer: it returns a new capture and never
 * mutates the one it was given.
 */

import {
  NARRATIVE_FIELDS,
  SCENARIO_FIELDS,
  emptyNarrative,
  emptyPassage,
  emptyScenario,
} from './case-study.js'

/** Thrown when a swap would land on top of authored work. */
export class SourceLangError extends Error {
  constructor(code, blockers = []) {
    super(code)
    this.name = 'SourceLangError'
    this.code = code
    this.blockers = blockers
  }
}

const hasText = (value) => typeof value === 'string' && value.trim() !== ''

/** Exchange two keys on a plain object, leaving every other key alone. */
function swapKeys(object, a, b) {
  if (!object || typeof object !== 'object') return object
  return { ...object, [a]: object[b] ?? null, [b]: object[a] ?? null }
}

/** Same, for a map of booleans, where the absent value is false rather than null. */
function swapFlags(object, a, b) {
  if (!object || typeof object !== 'object') return object
  return { ...object, [a]: Boolean(object[b]), [b]: Boolean(object[a]) }
}

/**
 * Same, for narrative passages. Every slot must keep the {text, drafted} shape
 * the parser guarantees — writing null where a passage was would break the one
 * shape every consumer is promised.
 */
function swapPassages(object, a, b) {
  if (!object || typeof object !== 'object') return object
  return { ...object, [a]: object[b] ?? emptyPassage(), [b]: object[a] ?? emptyPassage() }
}

/**
 * A title may be a bare string on captures parsed before it was localized.
 * Normalise to a per-language map before swapping, so the legacy shape does not
 * silently keep its text in the old language.
 */
function titleMap(capture, languages) {
  const base = Object.fromEntries(languages.map((code) => [code, null]))
  if (typeof capture.title === 'string') {
    return { ...base, [capture.sourceLang ?? languages[0]]: capture.title }
  }
  return { ...base, ...(capture.title ?? {}) }
}

/**
 * What stands in the way of calling this capture `target` instead.
 *
 * Only the target language matters. The source side is what we are moving, and
 * it is expected to be full — that is the whole point.
 *
 * @returns {{ready: boolean, blockers: Array<{code: string, stepIndex: number|null, field: string|null}>}}
 */
export function sourceLangReadiness(capture, target) {
  const languages = capture.languages ?? ['en']
  const from = capture.sourceLang ?? languages[0]
  const blockers = []

  if (!languages.includes(target)) {
    return { ready: false, blockers: [{ code: 'UNKNOWN_LANGUAGE', stepIndex: null, field: target }] }
  }
  // Already there. A no-op is always allowed.
  if (target === from) return { ready: true, blockers: [] }

  if (hasText(titleMap(capture, languages)[target])) {
    blockers.push({ code: 'TITLE_IN_TARGET', stepIndex: null, field: 'title' })
  }

  const scenario = capture.scenario ?? emptyScenario(languages)
  for (const field of SCENARIO_FIELDS) {
    if (hasText(scenario[field]?.[target])) {
      blockers.push({ code: 'SCENARIO_IN_TARGET', stepIndex: null, field })
    }
  }

  for (const step of capture.steps ?? []) {
    if (hasText(step.text?.[target])) {
      blockers.push({ code: 'STEP_TEXT_IN_TARGET', stepIndex: step.index, field: 'text' })
    }
    for (const image of step.images ?? []) {
      if (hasText(image.alt?.[target]) || image.altConfirmed?.[target]) {
        blockers.push({ code: 'ALT_IN_TARGET', stepIndex: step.index, field: 'alt' })
      }
    }
    const narrative = step.narrative ?? emptyNarrative(languages)
    for (const field of NARRATIVE_FIELDS) {
      if (hasText(narrative[field]?.[target]?.text)) {
        blockers.push({ code: 'NARRATIVE_IN_TARGET', stepIndex: step.index, field })
      }
    }
  }

  return { ready: blockers.length === 0, blockers }
}

/**
 * Declare which language the capture was actually recorded in, moving every
 * string to match.
 *
 * @param {object} capture
 * @param {string} target language code the capture is really in
 * @throws {SourceLangError} when the target language already holds authored work
 */
export function setSourceLang(capture, target) {
  const languages = capture.languages ?? ['en']
  const from = capture.sourceLang ?? languages[0]

  const { ready, blockers } = sourceLangReadiness(capture, target)
  if (!ready) {
    throw new SourceLangError(
      blockers[0]?.code === 'UNKNOWN_LANGUAGE' ? 'UNKNOWN_LANGUAGE' : 'TARGET_NOT_EMPTY',
      blockers
    )
  }
  if (target === from) return capture

  const scenario = capture.scenario ?? emptyScenario(languages)

  return {
    ...capture,
    sourceLang: target,
    title: swapKeys(titleMap(capture, languages), from, target),
    scenario: Object.fromEntries(
      SCENARIO_FIELDS.map((field) => [field, swapKeys(scenario[field], from, target)])
    ),
    steps: (capture.steps ?? []).map((step) => {
      const narrative = step.narrative ?? emptyNarrative(languages)
      return {
        ...step,
        text: swapKeys(step.text, from, target),
        images: (step.images ?? []).map((image) => ({
          ...image,
          alt: swapKeys(image.alt, from, target),
          altConfirmed: swapFlags(image.altConfirmed, from, target),
        })),
        narrative: Object.fromEntries(
          NARRATIVE_FIELDS.map((field) => [field, swapPassages(narrative[field], from, target)])
        ),
      }
    }),
  }
}

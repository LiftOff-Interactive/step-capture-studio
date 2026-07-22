/**
 * The case study's narrative layer.
 *
 * This artifact carries the project's central integrity risk: a confident,
 * wrong *why* in training material is worse than no *why* at all. Everything
 * here exists to keep one distinction intact — **which sentences a human stood
 * behind, and which a model guessed.**
 *
 * How the two open questions in the feature file are resolved:
 *
 * 1. *How strongly should unreviewed AI content be marked in the exported
 *    artifact?* It is not marked, because **it cannot get there.** Export is
 *    blocked while any drafted passage is unconfirmed, exactly as it is for alt
 *    text. Badging every paragraph in the deliverable would be honest but
 *    unshippable, and authors would strip it — which is worse, because then the
 *    marking is gone AND nobody reviewed anything.
 *
 * 2. *Should export be blocked, given a partial draft may be legitimate?* Yes,
 *    and the distinction that makes it bearable is between **empty** and
 *    **unreviewed**. An empty field claims nothing and is always allowed. A
 *    drafted-but-unconfirmed field makes a claim nobody has checked, and that
 *    is the thing being gated.
 *
 * The scenario fields are author-only by design. They are the grounding the
 * model needs, so they must come from the human — this is what stops the tool
 * inventing business rationale from nothing.
 */

import { t } from './i18n.js'
import { parseTranslationResponse, TranslationError } from './translate.js'

/** The two narrative fields carried per step. */
export const NARRATIVE_FIELDS = ['why', 'ifSkipped']

/** The scenario fields carried per capture. Author-written, never drafted. */
export const SCENARIO_FIELDS = ['audience', 'context', 'outcome']

const emptyPassage = () => ({ text: null, drafted: false })

/** A fresh narrative block for one step. */
export function emptyNarrative(languages) {
  return Object.fromEntries(
    NARRATIVE_FIELDS.map((field) => [
      field,
      Object.fromEntries(languages.map((code) => [code, emptyPassage()])),
    ])
  )
}

/** A fresh scenario block for a capture. */
export function emptyScenario(languages) {
  return Object.fromEntries(
    SCENARIO_FIELDS.map((field) => [field, Object.fromEntries(languages.map((code) => [code, null]))])
  )
}

/** Narrative on a step, tolerating captures parsed before this existed. */
function narrativeOf(step, languages) {
  return step.narrative ?? emptyNarrative(languages)
}

function withSteps(capture, steps) {
  return { ...capture, steps }
}

function mapStep(capture, stepIndex, fn) {
  const position = stepIndex - 1
  if (position < 0 || position >= capture.steps.length) {
    throw new RangeError(`no step at index ${stepIndex}`)
  }
  return withSteps(
    capture,
    capture.steps.map((step, i) => (i === position ? fn(step) : step))
  )
}

// ------------------------------------------------------------- authoring ---

/**
 * Set a narrative passage.
 *
 * `drafted` defaults to false: anything typed by a person is authored. Only
 * `applyCaseStudyResponse` marks a passage as drafted, and only the author can
 * clear that mark.
 */
export function setNarrative(capture, stepIndex, field, lang, text, { drafted = false } = {}) {
  if (!NARRATIVE_FIELDS.includes(field)) throw new RangeError(`unknown narrative field ${field}`)
  const languages = capture.languages ?? ['en']

  return mapStep(capture, stepIndex, (step) => {
    const narrative = narrativeOf(step, languages)
    return {
      ...step,
      narrative: {
        ...narrative,
        [field]: {
          ...narrative[field],
          [lang]: { text: text === '' ? null : text, drafted },
        },
      },
    }
  })
}

/**
 * Mark a drafted passage as reviewed and accepted.
 *
 * This is the only path from "a model wrote this" to "a person stands behind
 * it", and it refuses to run on an empty passage — confirming nothing would
 * quietly satisfy the gate.
 */
export function confirmNarrative(capture, stepIndex, field, lang) {
  const languages = capture.languages ?? ['en']

  return mapStep(capture, stepIndex, (step) => {
    const narrative = narrativeOf(step, languages)
    const passage = narrative[field]?.[lang]
    if (!passage?.text?.trim()) {
      throw new Error(`cannot confirm an empty ${field} passage (${lang})`)
    }
    return {
      ...step,
      narrative: {
        ...narrative,
        [field]: { ...narrative[field], [lang]: { ...passage, drafted: false } },
      },
    }
  })
}

/** Set a scenario field. Always authored — the model never writes these. */
export function setScenario(capture, field, lang, text) {
  if (!SCENARIO_FIELDS.includes(field)) throw new RangeError(`unknown scenario field ${field}`)
  const scenario = capture.scenario ?? emptyScenario(capture.languages ?? ['en'])
  return {
    ...capture,
    scenario: { ...scenario, [field]: { ...scenario[field], [lang]: text === '' ? null : text } },
  }
}

// -------------------------------------------------------------- readiness ---

/**
 * Every unreviewed drafted passage. Empty passages are deliberately absent:
 * claiming nothing is always allowed; claiming something unchecked is not.
 *
 * @returns {{ready: boolean, blockers: Array<{code, stepIndex, field, lang}>}}
 */
export function caseStudyReadiness(capture, languages = capture.languages ?? ['en']) {
  const blockers = []

  for (const step of capture.steps) {
    const narrative = narrativeOf(step, languages)
    for (const field of NARRATIVE_FIELDS) {
      for (const lang of languages) {
        const passage = narrative[field]?.[lang]
        if (passage?.drafted && passage.text?.trim()) {
          blockers.push({ code: 'NARRATIVE_UNREVIEWED', stepIndex: step.index, field, lang })
        }
      }
    }
  }

  return { ready: blockers.length === 0, blockers }
}

/** True when there is any narrative at all — an empty case study is pointless. */
export function hasNarrative(capture, languages = capture.languages ?? ['en']) {
  return capture.steps.some((step) => {
    const narrative = narrativeOf(step, languages)
    return NARRATIVE_FIELDS.some((field) =>
      languages.some((lang) => narrative[field]?.[lang]?.text?.trim())
    )
  })
}

// ----------------------------------------------------------- copy-prompt ---

const promptId = (stepIndex, field) => `s${stepIndex}${field === 'why' ? 'w' : 'b'}`

/**
 * Build the prompt that asks for the missing narrative.
 *
 * It carries the author's scenario as grounding and every step's action as
 * sequence, and asks only for fields that are still empty — a passage the
 * author already wrote is never sent out to be rewritten.
 */
export function buildCaseStudyPrompt(capture, lang = capture.sourceLang) {
  const languages = capture.languages ?? ['en']
  const scenario = capture.scenario ?? emptyScenario(languages)

  const wanted = []
  for (const step of capture.steps) {
    const narrative = narrativeOf(step, languages)
    for (const field of NARRATIVE_FIELDS) {
      if (!narrative[field]?.[lang]?.text?.trim()) {
        wanted.push({ id: promptId(step.index, field), stepIndex: step.index, field })
      }
    }
  }

  if (!wanted.length) {
    throw new TranslationError('NOTHING_TO_DRAFT', 'every narrative field is already written')
  }

  const scenarioLines = SCENARIO_FIELDS.filter((f) => scenario[f]?.[lang]?.trim()).map(
    (f) => `- ${t(`caseStudy.${f}`, lang)}: ${scenario[f][lang].trim()}`
  )

  const stepLines = capture.steps.map(
    (step) => `${step.index}. ${step.text?.[lang] ?? ''}`.trim()
  )

  return [
    'You are helping write a training case study for a software procedure.',
    '',
    scenarioLines.length ? 'What the author has told you about this procedure:' : '',
    ...scenarioLines,
    scenarioLines.length ? '' : '',
    'The full sequence of steps:',
    ...stepLines,
    '',
    'Write the missing explanations listed below. For each id:',
    '  - ids ending in "w" want WHY the step matters, in one or two sentences.',
    '  - ids ending in "b" want WHAT BREAKS if the step is skipped or done wrong.',
    '',
    'Rules — these matter more than fluency:',
    '- Ground everything in the scenario above and the step sequence. If the author has not told',
    '  you something, do not invent it. It is far better to write a cautious, general sentence',
    '  than a confident specific one that is wrong.',
    '- Do not invent policy names, system names, deadlines, dollar amounts, legal consequences or',
    '  job titles that do not appear above.',
    '- If you genuinely cannot say anything useful for an id, return it with the text: NEEDS AUTHOR',
    '',
    'Return ONLY these lines, one per id, nothing before or after:',
    '    <id> ||| <text>',
    '',
    'Explanations needed:',
    '',
    ...wanted.map(
      (item) =>
        `${item.id} ||| step ${item.stepIndex} — ${item.field === 'why' ? 'why it matters' : 'what breaks if skipped'}`
    ),
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/**
 * Apply a pasted response, marking every passage it fills as **drafted**.
 *
 * Reuses the translation parser, so the same strictness applies: unknown ids
 * abort the whole import rather than leaving a half-populated document.
 *
 * `NEEDS AUTHOR` is honoured as a refusal — the model declining to guess is a
 * useful signal, and recording it as narrative would bury it.
 */
export function applyCaseStudyResponse(capture, responseText, lang = capture.sourceLang) {
  const { entries } = parseTranslationResponse(responseText)
  const languages = capture.languages ?? ['en']

  const expected = new Map()
  for (const step of capture.steps) {
    for (const field of NARRATIVE_FIELDS) {
      expected.set(promptId(step.index, field), { stepIndex: step.index, field })
    }
  }

  const unknown = [...entries.keys()].filter((id) => !expected.has(id))
  if (unknown.length) throw new TranslationError('UNKNOWN_IDS', null, unknown)

  let next = capture
  let applied = 0
  const declined = []

  for (const [id, text] of entries) {
    const { stepIndex, field } = expected.get(id)
    if (/^NEEDS AUTHOR$/i.test(text.trim())) {
      declined.push({ id, stepIndex, field })
      continue
    }
    next = setNarrative(next, stepIndex, field, lang, text, { drafted: true })
    applied++
  }

  void languages
  return { capture: next, applied, declined }
}

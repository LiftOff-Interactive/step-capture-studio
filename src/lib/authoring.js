/**
 * The authoring layer: everything the parser deliberately refuses to do.
 *
 * The parser reports (duplicates, missing images, odd numbering) and never
 * repairs. This module is where a human's decisions are applied — merging,
 * editing, writing alt text, marking images decorative.
 *
 * Every operation is **immutable**: it returns a new capture and never mutates
 * the input. That gives undo for free (keep the previous object) and makes the
 * tests unambiguous. Image `bytes` are shared by reference, never copied — they
 * are large and never modified.
 *
 * Step `index` is always derived from position, never stored authoritatively,
 * so merging or deleting cannot leave stale numbering behind.
 */

import { t } from './i18n.js'

/** Re-derive 1-based indexes from array position. */
function renumber(steps) {
  return steps.map((step, i) => (step.index === i + 1 ? step : { ...step, index: i + 1 }))
}

/** Replace one step by position, returning a new capture. */
function withSteps(capture, steps) {
  return { ...capture, steps: renumber(steps) }
}

function mapStep(capture, stepIndex, fn) {
  const position = stepIndex - 1
  if (position < 0 || position >= capture.steps.length) {
    throw new RangeError(`no step at index ${stepIndex}`)
  }
  const steps = capture.steps.map((step, i) => (i === position ? fn(step) : step))
  return withSteps(capture, steps)
}

function mapImage(capture, stepIndex, imageId, fn) {
  return mapStep(capture, stepIndex, (step) => {
    if (!step.images.some((image) => image.id === imageId)) {
      throw new RangeError(`step ${stepIndex} has no image ${imageId}`)
    }
    return { ...step, images: step.images.map((image) => (image.id === imageId ? fn(image) : image)) }
  })
}

// ------------------------------------------------------------ step editing ---

/** Set a step's text in one language. */
export function setStepText(capture, stepIndex, lang, text) {
  return mapStep(capture, stepIndex, (step) => ({
    ...step,
    text: { ...step.text, [lang]: text === '' ? null : text },
  }))
}

/**
 * Merge the step at `stepIndex` into the one before it.
 *
 * Keeps the earlier step's text — Snagit's duplicates are identical, so there
 * is nothing to choose between them — and keeps BOTH screenshots, because two
 * steps sharing a label may still show different screens. Losing one would
 * lose real information.
 */
export function mergeStepIntoPrevious(capture, stepIndex) {
  const position = stepIndex - 1
  if (position <= 0 || position >= capture.steps.length) {
    throw new RangeError(`cannot merge step ${stepIndex} into a previous step`)
  }

  const previous = capture.steps[position - 1]
  const current = capture.steps[position]

  const merged = {
    ...previous,
    text: { ...previous.text },
    images: [...previous.images, ...current.images],
  }

  // Keep whatever the earlier step lacks and the later one has.
  for (const [lang, value] of Object.entries(current.text)) {
    if (merged.text[lang] == null && value != null) merged.text[lang] = value
  }

  const steps = [
    ...capture.steps.slice(0, position - 1),
    merged,
    ...capture.steps.slice(position + 1),
  ]
  return withSteps(capture, steps)
}

/** Remove a step. Undo by keeping the previous capture object. */
export function deleteStep(capture, stepIndex) {
  const position = stepIndex - 1
  if (position < 0 || position >= capture.steps.length) {
    throw new RangeError(`no step at index ${stepIndex}`)
  }
  return withSteps(capture, capture.steps.toSpliced(position, 1))
}

/**
 * Consecutive steps whose text is identical in the source language.
 *
 * Detection is automatic; **merging never is**. Returned as actionable pairs
 * for the editor to offer, which the author may decline.
 */
export function duplicatePairs(capture) {
  const pairs = []
  for (let i = 1; i < capture.steps.length; i++) {
    const previous = capture.steps[i - 1].text[capture.sourceLang]
    const current = capture.steps[i].text[capture.sourceLang]
    if (previous && current && previous === current) {
      pairs.push({ keep: capture.steps[i - 1].index, merge: capture.steps[i].index, text: current })
    }
  }
  return pairs
}

// --------------------------------------------------------------- alt text ---

/**
 * Fill empty alt text with an unconfirmed draft derived from the step text.
 *
 * Only for languages that actually have step text — French alt text arrives
 * with the translation round trip, not from thin air. Seeded values are always
 * `altConfirmed: false`: a draft the author must accept, never a silent pass.
 */
export function seedAltText(capture, lang = capture.sourceLang) {
  const steps = capture.steps.map((step) => {
    const stepText = step.text[lang]
    if (!stepText) return step

    let changed = false
    const images = step.images.map((image) => {
      if (image.decorative || image.alt?.[lang] != null) return image
      changed = true
      return {
        ...image,
        alt: { ...image.alt, [lang]: t('alt.seedFromStep', lang, { text: stepText }) },
        altConfirmed: { ...image.altConfirmed, [lang]: false },
      }
    })
    return changed ? { ...step, images } : step
  })

  return withSteps(capture, steps)
}

/** Set alt text. Any edit resets confirmation — the author must re-affirm. */
export function setAltText(capture, stepIndex, imageId, lang, text) {
  return mapImage(capture, stepIndex, imageId, (image) => ({
    ...image,
    alt: { ...image.alt, [lang]: text === '' ? null : text },
    altConfirmed: { ...image.altConfirmed, [lang]: false },
  }))
}

/** Mark alt text as author-confirmed. Refuses to confirm nothing. */
export function confirmAltText(capture, stepIndex, imageId, lang) {
  return mapImage(capture, stepIndex, imageId, (image) => {
    if (!image.alt?.[lang]?.trim()) {
      throw new Error(`cannot confirm empty alt text for ${imageId} (${lang})`)
    }
    return { ...image, altConfirmed: { ...image.altConfirmed, [lang]: true } }
  })
}

/**
 * Mark an image decorative, which satisfies the alt requirement with `alt=""`.
 *
 * In a step-by-step guide almost no screenshot is genuinely decorative, so this
 * is an escape hatch that should be rare — see the open question in
 * staging/stage-2-authoring/feature-alt-text.md.
 */
export function setDecorative(capture, stepIndex, imageId, decorative) {
  return mapImage(capture, stepIndex, imageId, (image) => ({ ...image, decorative: Boolean(decorative) }))
}

// -------------------------------------------------------- export readiness ---

/**
 * Everything standing between this capture and a shippable artifact.
 *
 * Export is blocked while this returns any blocker. That gate is the feature:
 * optional alt text is alt text that gets skipped under deadline pressure,
 * which is precisely when accessibility gets dropped.
 *
 * @returns {{ready: boolean, blockers: Array<{code: string, stepIndex: number, lang: string}>}}
 */
export function exportReadiness(capture, languages = capture.languages ?? ['en']) {
  const blockers = []

  for (const step of capture.steps) {
    for (const lang of languages) {
      if (!step.text?.[lang]?.trim()) {
        blockers.push({ code: 'STEP_TEXT_MISSING', stepIndex: step.index, lang })
      }
      for (const image of step.images) {
        if (image.decorative) continue
        if (!image.altConfirmed?.[lang] || !image.alt?.[lang]?.trim()) {
          blockers.push({ code: 'ALT_UNCONFIRMED', stepIndex: step.index, lang, imageId: image.id })
        }
      }
    }
  }

  return { ready: blockers.length === 0, blockers }
}

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
import { NARRATIVE_FIELDS, confirmNarrative, includesWorkedExample } from './case-study.js'
import { brandingReadiness } from './branding.js'

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
 * is nothing to choose between them — and keeps the earlier step's ONE
 * screenshot, discarding the absorbed duplicate's. An earlier version kept both
 * screenshots on the theory that two steps sharing a label might show different
 * screens; in practice that produced a merged step with two near-identical
 * images in both the HTML and the .docx, which is the redundancy the author
 * merges to remove. If two frames are genuinely different steps, do not merge
 * them.
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
    // Merge collapses a duplicate step into the one before it, so the result is
    // ONE step with ONE screenshot — not two. Keep the surviving (previous)
    // step's image and drop the absorbed duplicate's; a merged step showing two
    // near-identical screenshots is exactly what the author is merging to avoid.
    // Fall back to the later step's images only if the survivor has none.
    images: previous.images.length ? [...previous.images] : [...current.images],
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

/**
 * Set the capture's title in one language.
 *
 * The title is localized like every other user-facing string. The source
 * document can only supply one language; the other is authored here or filled
 * in by the translation round trip.
 */
export function setTitle(capture, lang, text) {
  const current = typeof capture.title === 'string' ? { [capture.sourceLang]: capture.title } : capture.title ?? {}
  return { ...capture, title: { ...current, [lang]: text?.trim() ? text : null } }
}

/**
 * Set an editable capture-level metadata field.
 *
 * `author`, `duration` and `date` are free-text and language-neutral. `steps`
 * writes `declaredStepCount` — the count shown in the metadata and the
 * quick-steps subtitle. It is deliberately independent of `steps.length`
 * (which is the real, structural number of steps); an author may want the
 * displayed count to read differently, and clearing the field falls back to
 * the actual count.
 */
export function setCaptureMeta(capture, field, value) {
  if (field === 'steps') {
    const n = String(value ?? '').trim()
    return { ...capture, declaredStepCount: n === '' ? null : Number(n) }
  }
  const text = String(value ?? '')
  return { ...capture, [field]: text.trim() === '' ? null : text }
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

/**
 * Swap an image's file, for when a screenshot came out wrong.
 *
 * `bytes` and the pixel dimensions are replaced; everything the author already
 * decided about this slot is kept — the step it belongs to (`id`), its source
 * `path`, the alt text, and the decorative flag. The dimensions are supplied by
 * the caller rather than read here: only PNG has a byte reader in this codebase,
 * and the app can decode any format the browser can, so `app.js` measures the
 * new file and passes width/height in.
 *
 * **Confirmation is reset.** The alt text describes a picture that has just
 * changed, so any prior "confirmed" no longer holds — the author must re-verify
 * the alt still matches before this step can export. This mirrors `setAltText`,
 * which unconfirms on every text edit for the same reason. Decorative images
 * carry no alt to invalidate, so the reset is a no-op for them.
 *
 * @param {object} fields  { bytes: Uint8Array, width?: number, height?: number }
 */
export function replaceImage(capture, stepIndex, imageId, { bytes, width = null, height = null }) {
  if (!bytes || bytes.length === 0) {
    throw new Error(`replaceImage: no bytes for ${imageId}`)
  }
  return mapImage(capture, stepIndex, imageId, (image) => ({
    ...image,
    bytes,
    width,
    height,
    altConfirmed: Object.fromEntries(Object.keys(image.altConfirmed).map((code) => [code, false])),
  }))
}

// ---------------------------------------------------- per-step verification ---

/**
 * Everything in one step that still needs the author's explicit confirmation,
 * gathered so the UI can offer **one** control per step instead of one per
 * image per language.
 *
 * Deriving this from the model rather than tracking a separate "step verified"
 * flag is deliberate. `feature-alt-text.md` records the worst bug this feature
 * ever had — *the confirm checkbox lied*: editing alt text reset the model but
 * left the box ticked, so the UI asserted a confirmation the author never gave.
 * A stored flag would reintroduce exactly that. Here the checkbox has no state
 * of its own; it reports what the model says, so an edit anywhere in the step
 * unticks it automatically.
 *
 * @returns {{items: Array, total: number, done: number, blocked: Array,
 *            verified: boolean, applicable: boolean}}
 */
export function stepVerification(capture, stepIndex, languages = capture.languages ?? ['en']) {
  const step = capture.steps.find((s) => s.index === stepIndex)
  if (!step) throw new Error(`no step ${stepIndex}`)

  const items = []

  for (const image of step.images) {
    // A decorative image satisfies the alt requirement with alt="" and has
    // nothing to attest to.
    if (image.decorative) continue
    for (const lang of languages) {
      const text = image.alt?.[lang]?.trim()
      items.push({
        kind: 'alt',
        imageId: image.id,
        lang,
        done: Boolean(image.altConfirmed?.[lang] && text),
        // Empty alt text cannot be confirmed at all — the model refuses it.
        blocked: !text,
      })
    }
  }

  // Only *drafted* narrative needs review. Once confirmed it stops being
  // drafted and drops out of this list entirely, which is why `done` is always
  // false here: a present item is by definition still unreviewed.
  //
  // Skipped entirely when the worked example is off: prose nothing will read
  // does not need attesting to, and asking would make the step's single check
  // impossible to satisfy for a reason the author has already dismissed.
  if (includesWorkedExample(capture)) {
    for (const field of NARRATIVE_FIELDS) {
      for (const lang of languages) {
        const passage = step.narrative?.[field]?.[lang]
        if (passage?.drafted && passage.text?.trim()) {
          items.push({ kind: 'narrative', field, lang, done: false, blocked: false })
        }
      }
    }
  }

  const blocked = items.filter((item) => item.blocked)
  const done = items.filter((item) => item.done).length

  return {
    items,
    total: items.length,
    done,
    blocked,
    // Nothing to attest to is not the same as verified — see `applicable`.
    verified: items.length > 0 && done === items.length,
    applicable: items.length > 0,
  }
}

/**
 * Confirm everything confirmable in one step.
 *
 * Blocked items (empty alt text) are skipped rather than throwing, so one
 * missing field cannot discard the author's confirmation of the others. The
 * checkbox then stays unticked because `stepVerification` still reports them
 * outstanding — the UI tells the truth without needing to know why.
 */
export function verifyStep(capture, stepIndex, languages = capture.languages ?? ['en']) {
  let next = capture
  for (const item of stepVerification(capture, stepIndex, languages).items) {
    if (item.blocked || item.done) continue
    next =
      item.kind === 'alt'
        ? confirmAltText(next, stepIndex, item.imageId, item.lang)
        : confirmNarrative(next, stepIndex, item.field, item.lang)
  }
  return next
}

/**
 * Withdraw the alt-text confirmations in one step.
 *
 * Re-setting the same text is what clears confirmation — `setAltText` treats
 * any write as an edit. Narrative review is deliberately **not** undone:
 * confirming a drafted passage marks it authored, and there is no meaningful
 * way to un-author prose the person has already read and accepted.
 */
export function unverifyStep(capture, stepIndex, languages = capture.languages ?? ['en']) {
  const step = capture.steps.find((s) => s.index === stepIndex)
  if (!step) throw new Error(`no step ${stepIndex}`)

  let next = capture
  for (const image of step.images) {
    if (image.decorative) continue
    for (const lang of languages) {
      if (!image.altConfirmed?.[lang]) continue
      next = setAltText(next, stepIndex, image.id, lang, image.alt?.[lang] ?? '')
    }
  }
  return next
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

  // Branding is measured, not trusted. A brand colour that fails AA makes the
  // artifact exactly as non-compliant as missing alt text does, and it fails it
  // everywhere at once rather than in one image — so it belongs in the same
  // gate rather than in a warning the author can scroll past.
  for (const blocker of brandingReadiness(capture).blockers) {
    blockers.push({
      code: `BRANDING_${blocker.code}`,
      stepIndex: null,
      lang: null,
      field: blocker.field,
      ratio: blocker.ratio,
      against: blocker.against,
    })
  }

  return { ready: blockers.length === 0, blockers }
}

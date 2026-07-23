/**
 * Pure DOM builders for the capture view.
 *
 * Kept separate from app.js — which owns events, state and side effects — for
 * two reasons: accessibility tests need to construct the *rendered* state
 * without a file picker or a real browser, and Stage 2's editor will re-render
 * these same regions after every edit.
 *
 * Every function takes an explicit `document` so it works in jsdom as well as
 * the browser, and returns detached nodes rather than mutating the page.
 */

import { t, LOCALES } from '../lib/i18n.js'

/**
 * Turn image bytes into something an <img> can display.
 * Overridden in tests, where object URLs are meaningless.
 * @typedef {(bytes: Uint8Array) => string} ImageUrlFactory
 */
export const objectUrlFactory = (bytes) =>
  URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))

/**
 * Editable capture metadata: author, duration, recorded date, step count.
 *
 * Every row is shown even when empty, so an author can *add* a missing value
 * rather than only edit an existing one. `onField(field, value)` reports each
 * edit; the caller updates the model in place (no re-render) so typing keeps
 * focus, exactly as the title and alt fields do.
 *
 * The step count shows `declaredStepCount` when the author has set one, else
 * the real number of steps — see `setCaptureMeta`.
 */
export function buildEditableMeta(document, capture, lang, onField) {
  const rows = [
    ['author', 'capture.author', capture.author ?? '', 'text'],
    ['duration', 'capture.duration', capture.duration ?? '', 'text'],
    ['date', 'capture.date', capture.date ?? '', 'text'],
    ['steps', 'capture.stepCount', String(capture.declaredStepCount ?? capture.steps.length), 'number'],
  ]

  return rows.map(([field, labelKey, value, type]) => {
    const id = `f-meta-${field}`
    const wrap = document.createElement('div')
    wrap.className = 'field'

    const label = document.createElement('label')
    label.className = 'field-label'
    label.htmlFor = id
    label.textContent = t(labelKey, lang)

    const input = document.createElement('input')
    input.type = type
    if (type === 'number') input.min = '0'
    input.id = id
    input.value = value
    input.addEventListener('input', () => onField(field, input.value))

    wrap.append(label, input)
    return wrap
  })
}

/** <li> per parser warning, as a translated sentence. */
export function buildWarnings(document, capture, lang) {
  return capture.warnings.map((warning) => {
    const li = document.createElement('li')
    li.textContent = t(`warning.${warning.code}`, lang, { index: warning.stepIndex })
    return li
  })
}

/**
 * <li> per step: label, text, and figure.
 * @param {ImageUrlFactory} [imageUrl]
 */
export function buildSteps(document, capture, lang, imageUrl = objectUrlFactory) {
  const total = capture.steps.length

  return capture.steps.map((step) => {
    const li = document.createElement('li')
    li.className = 'step'

    const body = document.createElement('div')
    body.className = 'step__body'

    const label = document.createElement('span')
    label.className = 'step__label'
    label.textContent = t('step.label', lang, { index: step.index, total })

    const text = document.createElement('p')
    text.className = 'step__text'
    const translated = step.text[lang]
    const stepText = translated ?? step.text[capture.sourceLang]

    if (stepText) {
      text.textContent = stepText
      // Until Stage 2 supplies a translation we fall back to the source
      // language. Content in another language MUST declare it, or a screen
      // reader pronounces English with French phonetics (WCAG 3.1.2).
      if (!translated && capture.sourceLang !== lang) {
        text.lang = LOCALES[capture.sourceLang] ?? capture.sourceLang
      }
    } else {
      text.textContent = t('step.noText', lang)
      text.classList.add('step__missing')
    }

    body.append(label, text)

    const figure = document.createElement('figure')
    figure.className = 'step__figure'

    if (step.images.length) {
      for (const image of step.images) {
        const img = document.createElement('img')
        img.src = imageUrl(image.bytes)
        // Stage 2 replaces this with author-confirmed alt text. Until then it
        // says plainly that alt text is outstanding rather than pretending.
        img.alt = image.alt[lang] ?? t('step.imagePending', lang, { index: step.index })
        if (image.width && image.height) {
          img.width = image.width
          img.height = image.height
        }
        figure.append(img)
      }
    } else {
      const missing = document.createElement('p')
      missing.className = 'step__missing'
      missing.textContent = t('step.noImage', lang)
      figure.append(missing)
    }

    li.append(body, figure)
    return li
  })
}

/** Re-apply every `data-i18n` string and set the document language. */
export function applyStaticStrings(document, lang) {
  document.documentElement.lang = LOCALES[lang] ?? lang
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n, lang)
  }
}

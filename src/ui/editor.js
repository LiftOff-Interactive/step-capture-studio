/**
 * The editable step list.
 *
 * Pure builders, like render.js — they take an explicit `document`, return
 * detached nodes, and report user intent through a `handlers` object rather
 * than touching application state themselves. That keeps the whole surface
 * testable under jsdom, which matters here more than anywhere else: this is
 * the most control-dense part of the app and therefore the easiest to make
 * inaccessible by accident.
 *
 * Accessibility decisions worth keeping:
 *   - Each step is a <fieldset> with a <legend>, so every control inside is
 *     announced with the step it belongs to. Without that, a screen reader
 *     user hears "Alt text" twenty times with no way to tell them apart.
 *   - Every control has a real <label for>, never a placeholder-as-label.
 *   - Both language fields are shown at once rather than following the page
 *     toggle, so an author can see what is still missing in the other language.
 *   - Duplicate steps are flagged in text, not by colour alone.
 */

import { t, LOCALES } from '../lib/i18n.js'
import { duplicatePairs } from '../lib/authoring.js'
import { NARRATIVE_FIELDS } from '../lib/case-study.js'

/**
 * Stable, unique, and valid as an HTML id.
 * Exported so app.js can address a specific control without re-rendering —
 * see the confirmation-checkbox sync in its `onAlt` handler.
 */
export const fieldId = (...parts) => `f-${parts.join('-').replace(/[^a-zA-Z0-9_-]/g, '_')}`

function labelled(document, { id, labelText, control, help, helpId }) {
  const label = document.createElement('label')
  label.className = 'field-label'
  label.htmlFor = id
  label.textContent = labelText

  control.id = id
  if (help) control.setAttribute('aria-describedby', helpId)

  const wrap = document.createElement('div')
  wrap.className = 'field'
  wrap.append(label, control)

  if (help) {
    const hint = document.createElement('p')
    hint.className = 'hint'
    hint.id = helpId
    hint.textContent = help
    wrap.append(hint)
  }
  return wrap
}

function checkbox(document, { id, labelText, checked, onChange }) {
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.id = id
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))

  const label = document.createElement('label')
  label.htmlFor = id
  label.textContent = labelText

  const wrap = document.createElement('div')
  wrap.className = 'checkbox'
  wrap.append(input, label)
  return wrap
}

/**
 * Build the editable step list.
 *
 * @param {Document} document
 * @param {object} capture
 * @param {string} lang            page language, for chrome strings
 * @param {object} handlers        { onStepText, onAlt, onConfirmAlt, onDecorative, onMerge, onDelete }
 * @param {(bytes: Uint8Array) => string} imageUrl
 */
export function buildEditableSteps(document, capture, lang, handlers, imageUrl) {
  const total = capture.steps.length
  const languages = capture.languages ?? ['en']
  const duplicates = new Map(duplicatePairs(capture).map((pair) => [pair.merge, pair.keep]))

  return capture.steps.map((step) => {
    const li = document.createElement('li')
    li.className = 'step step--editing'

    const fieldset = document.createElement('fieldset')
    fieldset.className = 'step__fields'

    const legend = document.createElement('legend')
    legend.textContent = t('step.label', lang, { index: step.index, total })
    fieldset.append(legend)

    // --- duplicate notice: stated in text, never colour alone -------------
    const duplicateOf = duplicates.get(step.index)
    if (duplicateOf) {
      const notice = document.createElement('p')
      notice.className = 'step__duplicate'
      notice.textContent = t('editor.duplicateNotice', lang, { previous: duplicateOf })

      const merge = document.createElement('button')
      merge.type = 'button'
      merge.className = 'button button--quiet'
      merge.textContent = t('editor.merge', lang, { previous: duplicateOf })
      merge.addEventListener('click', () => handlers.onMerge(step.index))

      notice.append(' ', merge)
      fieldset.append(notice)
    }

    // --- screenshot -------------------------------------------------------
    if (step.images.length) {
      const figure = document.createElement('figure')
      figure.className = 'step__figure'
      for (const image of step.images) {
        const img = document.createElement('img')
        img.src = imageUrl(image.bytes)
        // In the editor the image is described by the adjacent alt-text field,
        // so marking it decorative here avoids reading a draft twice.
        img.alt = ''
        if (image.width && image.height) {
          img.width = image.width
          img.height = image.height
        }
        figure.append(img)
      }
      fieldset.append(figure)
    }

    // --- step text, one field per language --------------------------------
    for (const code of languages) {
      const textarea = document.createElement('textarea')
      textarea.rows = 2
      textarea.value = step.text[code] ?? ''
      textarea.lang = LOCALES[code] ?? code
      textarea.addEventListener('input', () =>
        handlers.onStepText(step.index, code, textarea.value)
      )

      fieldset.append(
        labelled(document, {
          id: fieldId('step', step.index, 'text', code),
          labelText: t('editor.stepText', lang, { lang: t(`lang.name.${code}`, lang) }),
          control: textarea,
        })
      )
    }

    // --- alt text per image, per language ---------------------------------
    for (const image of step.images) {
      const group = document.createElement('div')
      group.className = 'alt-group'

      group.append(
        checkbox(document, {
          id: fieldId('dec', step.index, image.id),
          labelText: t('editor.decorative', lang),
          checked: Boolean(image.decorative),
          onChange: (value) => handlers.onDecorative(step.index, image.id, value),
        })
      )

      if (!image.decorative) {
        for (const code of languages) {
          const input = document.createElement('input')
          input.type = 'text'
          input.value = image.alt?.[code] ?? ''
          input.lang = LOCALES[code] ?? code
          input.addEventListener('input', () =>
            handlers.onAlt(step.index, image.id, code, input.value)
          )

          const helpId = fieldId('althelp', step.index, image.id, code)
          group.append(
            labelled(document, {
              id: fieldId('alt', step.index, image.id, code),
              labelText: t('editor.altText', lang, { lang: t(`lang.name.${code}`, lang) }),
              control: input,
              help: t('editor.altHelp', lang),
              helpId,
            })
          )

          group.append(
            checkbox(document, {
              id: fieldId('altok', step.index, image.id, code),
              labelText: t('editor.confirmAlt', lang),
              checked: Boolean(image.altConfirmed?.[code]),
              onChange: (value) => handlers.onConfirmAlt(step.index, image.id, code, value),
            })
          )
        }
      }

      fieldset.append(group)
    }

    // --- case-study narrative, source language only ----------------------
    // Only the source language is edited here. The French comes through the
    // translation round trip, which already exists — duplicating 20 more
    // fields would double the form for no gain.
    for (const field of NARRATIVE_FIELDS) {
      const passage = step.narrative?.[field]?.[capture.sourceLang]
      const group = document.createElement('div')
      group.className = 'narrative-group'

      const area = document.createElement('textarea')
      area.rows = 2
      area.value = passage?.text ?? ''
      area.lang = LOCALES[capture.sourceLang] ?? capture.sourceLang
      area.addEventListener('input', () =>
        handlers.onNarrative(step.index, field, capture.sourceLang, area.value)
      )

      group.append(
        labelled(document, {
          id: fieldId('narr', step.index, field),
          labelText: t(`caseStudy.${field}`, lang),
          control: area,
        })
      )

      // The review control appears ONLY for drafted text. An authored passage
      // has nothing to confirm, and showing a permanent unticked box would
      // imply otherwise.
      if (passage?.drafted && passage.text) {
        const notice = document.createElement('p')
        notice.className = 'narrative-drafted'
        notice.textContent = t('caseStudy.unreviewed', lang)
        group.append(notice)
        group.append(
          checkbox(document, {
            id: fieldId('narrok', step.index, field),
            labelText: t('caseStudy.confirm', lang),
            checked: false,
            onChange: (value) => value && handlers.onConfirmNarrative(step.index, field, capture.sourceLang),
          })
        )
      }

      fieldset.append(group)
    }

    // --- destructive action, last ----------------------------------------
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'button button--quiet'
    // Accessible name carries the step number so it is distinguishable out of
    // context, where a screen reader lists every button on the page.
    remove.textContent = t('editor.delete', lang, { index: step.index })
    remove.addEventListener('click', () => handlers.onDelete(step.index))
    fieldset.append(remove)

    li.append(fieldset)
    return li
  })
}

/**
 * The one-line export-readiness summary, as text.
 *
 * Deliberately returns a string rather than an element. The summary lives in a
 * persistent live region in index.html that is never replaced — if this
 * returned a node, a caller could rebuild it and silently kill the
 * announcement, because a live region added at the same moment its content
 * changes is not announced.
 */
export function readinessSummaryText(readiness, lang) {
  return readiness.ready
    ? t('export.ready', lang)
    : t('export.blocked', lang, { count: readiness.blockers.length })
}

/** The detailed blocker list. Safe to rebuild — it is not a live region. */
export function buildBlockerList(document, readiness, lang) {
  const list = document.createElement('ul')
  list.className = 'readiness__list'
  // Cap the list — 10 unconfirmed images across 2 languages is 20 identical
  // lines, which buries the useful information rather than surfacing it.
  for (const blocker of readiness.blockers.slice(0, 8)) {
    const li = document.createElement('li')
    li.textContent = t(`blocker.${blocker.code}`, lang, {
      index: blocker.stepIndex,
      lang: t(`lang.name.${blocker.lang}`, lang),
    })
    list.append(li)
  }
  return list
}

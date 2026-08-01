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
import { duplicatePairs, stepVerification } from '../lib/authoring.js'
import { NARRATIVE_FIELDS, includesWorkedExample } from '../lib/case-study.js'

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
 * The capture title, one field per language.
 *
 * Kept out of the step list because it belongs to the whole capture, and out of
 * the metadata list because that is read-only. Both languages are shown at once
 * — like the step fields — so an author can see which one is still missing.
 *
 * @param {Document} document
 * @param {object} capture
 * @param {string} lang       page language, for the field labels
 * @param {(lang: string, value: string) => void} onTitle
 */
export function buildTitleFields(document, capture, lang, onTitle) {
  const languages = capture.languages ?? ['en']
  const titles =
    typeof capture.title === 'string'
      ? { [capture.sourceLang]: capture.title }
      : capture.title ?? {}

  const wrap = document.createElement('div')
  for (const code of languages) {
    const input = document.createElement('input')
    input.type = 'text'
    input.value = titles[code] ?? ''
    input.lang = LOCALES[code] ?? code
    input.addEventListener('input', () => onTitle(code, input.value))

    wrap.append(
      labelled(document, {
        id: fieldId('title', code),
        labelText: t('editor.title', lang, { lang: t(`lang.name.${code}`, lang) }),
        control: input,
      })
    )
  }
  return wrap
}

/**
 * One numbered button per step, for the tabbed layout's step picker.
 *
 * The visible label is just the number — the accessible name is the full
 * "Step {index} of {total}", so a screen reader listing the buttons hears
 * position and extent, not thirteen bare digits. The active chip carries
 * aria-current; app.js keeps that in sync without rebuilding, so focus is
 * never destroyed under the finger that just clicked.
 *
 * @param {Document} document
 * @param {number} total
 * @param {number} activeIndex     1-based step currently shown
 * @param {string} lang            page language, for the accessible names
 * @param {(index: number) => void} onSelect
 */
export function buildStepChips(document, total, activeIndex, lang, onSelect) {
  return Array.from({ length: total }, (_, i) => {
    const index = i + 1
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'step-chip'
    chip.textContent = String(index)
    chip.setAttribute('aria-label', t('step.label', lang, { index, total }))
    if (index === activeIndex) chip.setAttribute('aria-current', 'true')
    chip.addEventListener('click', () => onSelect(index))
    return chip
  })
}

/**
 * Build the editable step list.
 *
 * Each step's fieldset is split into two halves (mock-up slide 7): the fields
 * to fix — step text, alt text, explanations — in `.step__main`, and the
 * screenshot with its check/delete/replace controls in `.step__side`. Pure
 * structure; the two-column arrangement is CSS, and narrow screens stack.
 *
 * @param {Document} document
 * @param {object} capture
 * @param {string} lang            page language, for chrome strings
 * @param {object} handlers        { onStepText, onAlt, onVerifyStep, onDecorative, onReplaceImage, onMerge, onDelete }
 * @param {(bytes: Uint8Array) => string} imageUrl
 */
export function buildEditableSteps(document, capture, lang, handlers, imageUrl) {
  const total = capture.steps.length
  const languages = capture.languages ?? ['en']
  const duplicates = new Map(duplicatePairs(capture).map((pair) => [pair.merge, pair.keep]))

  return capture.steps.map((step) => {
    const li = document.createElement('li')
    li.className = 'step step--editing'
    // Lets a re-render put focus back in the step the author was working in,
    // rather than at the top of the list.
    li.dataset.stepIndex = String(step.index)

    const fieldset = document.createElement('fieldset')
    fieldset.className = 'step__fields'

    const legend = document.createElement('legend')
    legend.textContent = t('step.label', lang, { index: step.index, total })
    fieldset.append(legend)

    const main = document.createElement('div')
    main.className = 'step__main'
    const side = document.createElement('div')
    side.className = 'step__side'

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

    // --- screenshot (appended to the side column below, after the controls) ---
    let figure = null
    if (step.images.length) {
      figure = document.createElement('figure')
      figure.className = 'step__figure'
      for (const image of step.images) {
        const wrap = document.createElement('div')
        wrap.className = 'step__image'

        const img = document.createElement('img')
        img.src = imageUrl(image.bytes)
        // In the editor the image is described by the adjacent alt-text field,
        // so marking it decorative here avoids reading a draft twice.
        img.alt = ''
        if (image.width && image.height) {
          img.width = image.width
          img.height = image.height
        }
        wrap.append(img)

        // Swap the file behind this slot when a screenshot came out wrong.
        // The canonical accessible file-button pattern: a real <label> styled as
        // a button, and a visually-hidden but still focusable <input>. Keyboard
        // users tab to the input and press Enter/Space; the label lights up via
        // :focus-within so the focus stays visible. PNG/JPEG only — the two
        // formats the tool round-trips and Word embeds.
        const replace = document.createElement('div')
        replace.className = 'step__replace'

        const fileId = fieldId('replacefile', step.index, image.id)

        const label = document.createElement('label')
        label.className = 'button button--quiet'
        label.htmlFor = fileId
        label.textContent = t('editor.replaceImage', lang)

        const file = document.createElement('input')
        file.type = 'file'
        file.id = fileId
        file.className = 'visually-hidden'
        file.accept = 'image/png,image/jpeg'
        file.addEventListener('change', () => {
          const picked = file.files?.[0]
          if (picked) handlers.onReplaceImage(step.index, image.id, picked)
          // Clear, so picking the same filename again still fires `change`.
          file.value = ''
        })

        replace.append(label, file)
        wrap.append(replace)
        figure.append(wrap)
      }
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

      main.append(
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

        }
      }

      main.append(group)
    }

    // --- case-study narrative, source language only ----------------------
    // Only the source language is edited here. The French comes through the
    // translation round trip, which already exists — duplicating 20 more
    // fields would double the form for no gain.
    //
    // Absent entirely when the worked example is switched off. Two fields per
    // step is the bulk of this form, and they are the only ones that do not
    // feed the artifacts an author who opted out is actually exporting.
    for (const field of includesWorkedExample(capture) ? NARRATIVE_FIELDS : []) {
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

      // The notice appears ONLY for drafted text. An authored passage has
      // nothing to confirm. Reviewing it is now part of the single per-step
      // check below, rather than its own control.
      if (passage?.drafted && passage.text) {
        const notice = document.createElement('p')
        notice.className = 'narrative-drafted'
        notice.textContent = t('caseStudy.unreviewed', lang)
        group.append(notice)
      }

      main.append(group)
    }

    // --- one verification control for the whole step ----------------------
    // Replaces a checkbox per image per language plus one per drafted
    // passage. Its state is DERIVED from the model every render, never
    // stored, so editing any field in the step unticks it on its own — the
    // box cannot assert a confirmation the author did not give.
    const verification = stepVerification(capture, step.index, languages)
    if (verification.applicable) {
      const box = checkbox(document, {
        id: fieldId('stepok', step.index),
        labelText: t('editor.verifyStep', lang),
        checked: verification.verified,
        onChange: (value) => handlers.onVerifyStep(step.index, value),
      })
      box.classList.add('step__verify')

      const hint = document.createElement('p')
      hint.className = 'hint'
      hint.id = fieldId('stepokhelp', step.index)
      // Say what ticking it actually asserts. The bulk confirmation in
      // feature-alt-text.md was specified as deliberately friction-ful; with
      // one box per step that friction is disclosure rather than a second click.
      hint.textContent = verification.blocked.length
        ? t('editor.verifyStepBlocked', lang)
        : t('editor.verifyStepHelp', lang)

      const input = box.querySelector('input')
      input.setAttribute('aria-describedby', hint.id)
      // Empty alt text cannot be confirmed by the model, so offering the
      // control would be offering something that silently does nothing.
      if (verification.blocked.length) input.disabled = true

      side.append(box, hint)
    }

    // --- destructive action, after the check ------------------------------
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'button button--quiet'
    // Accessible name carries the step number so it is distinguishable out of
    // context, where a screen reader lists every button on the page.
    remove.textContent = t('editor.delete', lang, { index: step.index })
    remove.addEventListener('click', () => handlers.onDelete(step.index))
    side.append(remove)

    if (figure) side.append(figure)

    fieldset.append(main, side)
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

/**
 * App shell: load a capture, let the author fix it, announce what happened.
 *
 * This module owns events, state and side effects only. DOM building lives in
 * render.js (read-only display, reused by Stage 3's artifact emitters) and
 * editor.js (the editable form), so both are testable under jsdom.
 *
 * Two behaviours here are load-bearing and easy to break:
 *   - Structural changes re-render the list, which would normally throw a
 *     keyboard user back to the top of the page. Focus is restored explicitly.
 *   - Undo works by keeping previous capture objects. Every authoring
 *     operation is immutable, so this costs nothing.
 */

import { parseSnagitDocx } from '../lib/parse-snagit.js'
import { DocxError } from '../lib/docx.js'
import { t, LANGUAGES } from '../lib/i18n.js'
import {
  setStepText,
  setAltText,
  confirmAltText,
  setDecorative,
  mergeStepIntoPrevious,
  deleteStep,
  seedAltText,
  exportReadiness,
} from '../lib/authoring.js'
import { applyStaticStrings, buildMeta, buildWarnings } from './render.js'
import { buildEditableSteps, buildBlockerList, readinessSummaryText, fieldId } from './editor.js'

const els = {
  unsupported: document.getElementById('unsupported'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  status: document.getElementById('status'),
  error: document.getElementById('error'),
  errorDetail: document.getElementById('error-detail'),
  capture: document.getElementById('capture'),
  captureMeta: document.getElementById('capture-meta'),
  warnings: document.getElementById('warnings'),
  warningsList: document.getElementById('warnings-list'),
  readiness: document.getElementById('readiness'),
  readinessSummary: document.getElementById('readiness-summary'),
  readinessBody: document.getElementById('readiness-body'),
  steps: document.getElementById('steps'),
  stepsList: document.getElementById('steps-list'),
  seedAlt: document.getElementById('seed-alt'),
  undo: document.getElementById('undo'),
  langToggle: document.getElementById('lang-toggle'),
}

const state = {
  lang: LANGUAGES[0],
  capture: null,
  /** Previous captures, newest last. Undo pops from here. */
  history: [],
  /** Object URLs we created, so they can be revoked on reload. */
  objectUrls: [],
  /** Last announced blocker count, so only real changes are spoken. */
  lastBlockerCount: null,
}

// --------------------------------------------------------------- helpers ---

const show = (el) => {
  el.hidden = false
}
const hide = (el) => {
  el.hidden = true
}

function setStatus(key, vars) {
  els.status.textContent = t(key, state.lang, vars)
}

function announce(key, vars) {
  // Re-assigning identical text does not re-announce, so clear first.
  els.status.textContent = ''
  els.status.textContent = t(key, state.lang, vars)
}

function releaseObjectUrls() {
  for (const url of state.objectUrls) URL.revokeObjectURL(url)
  state.objectUrls = []
}

function trackedImageUrl(bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
  state.objectUrls.push(url)
  return url
}

// ---------------------------------------------------------------- render ---

/**
 * Update the summary text in the persistent live region.
 *
 * `announce: false` still updates the visible text but suppresses the
 * announcement, by switching the region off across the mutation. That is for
 * cases where the wording changes but the meaning has not — a language switch
 * rewrites the sentence while the blocker count is identical, and announcing
 * it again would be noise on top of the toggle's own announcement.
 */
function setReadinessSummary(text, { announce }) {
  if (els.readinessSummary.textContent === text) return

  if (announce) {
    els.readinessSummary.textContent = text
    return
  }

  els.readinessSummary.setAttribute('aria-live', 'off')
  els.readinessSummary.textContent = text
  // Restore after the mutation has been observed, so this change is not queued.
  setTimeout(() => els.readinessSummary.setAttribute('aria-live', 'polite'), 0)
}

/**
 * @param {object} [options]
 * @param {boolean} [options.announce=true] false when only the wording changed
 */
function renderReadiness({ announce = true } = {}) {
  if (!state.capture) return hide(els.readiness)

  const readiness = exportReadiness(state.capture, state.capture.languages)
  const count = readiness.blockers.length

  // Only a real change in what is outstanding is worth interrupting for.
  // Typing into a field fires this on every keystroke; the count changes at
  // most once per edit, which debounces the announcement for free.
  const countChanged = count !== state.lastBlockerCount
  state.lastBlockerCount = count

  els.readinessSummary.classList.toggle('readiness--ready', readiness.ready)
  setReadinessSummary(readinessSummaryText(readiness, state.lang), {
    announce: announce && countChanged,
  })

  els.readinessBody.replaceChildren(buildBlockerList(document, readiness, state.lang))
  show(els.readiness)
}

function renderSteps() {
  els.stepsList.replaceChildren(
    ...buildEditableSteps(document, state.capture, state.lang, handlers, trackedImageUrl)
  )
}

function renderAll({ announceReadiness = true } = {}) {
  applyStaticStrings(document, state.lang)

  if (!state.capture) {
    setStatus('status.empty')
    return
  }

  els.captureMeta.replaceChildren(...buildMeta(document, state.capture, state.lang))

  if (state.capture.warnings.length) {
    els.warningsList.replaceChildren(...buildWarnings(document, state.capture, state.lang))
    show(els.warnings)
  } else {
    hide(els.warnings)
  }

  renderSteps()
  renderReadiness({ announce: announceReadiness })

  els.undo.hidden = state.history.length === 0
  show(els.capture)
  show(els.steps)
}

/**
 * Re-render the step list without stranding the keyboard.
 *
 * Replacing the list destroys the focused element, which would silently send a
 * keyboard or screen-reader user back to the top of the document.
 *
 * `preserveFocus` must be an explicit flag, not a nullable id: an earlier
 * version passed `focusId: null` to mean "ignore current focus", but `??`
 * treats null as nullish and fell through to `document.activeElement` anyway,
 * so focus stuck to whatever button had been pressed before.
 */
function rerenderSteps({ preserveFocus = true, fallbackPosition } = {}) {
  const activeId = preserveFocus ? document.activeElement?.id : null
  renderSteps()
  renderReadiness()
  els.undo.hidden = state.history.length === 0

  const restored = activeId && document.getElementById(activeId)
  if (restored) return restored.focus()

  if (fallbackPosition != null) {
    const items = els.stepsList.querySelectorAll('.step')
    const target = items[Math.min(fallbackPosition, items.length - 1)]
    const control = target?.querySelector('textarea, input, button')
    if (control) return control.focus()
  }
  els.seedAlt.focus()
}

function showError(code) {
  const key = `error.${code}`
  const message = t(key, state.lang)
  show(els.error)
  els.status.textContent = ''
  els.errorDetail.textContent = message === key ? t('error.UNKNOWN', state.lang) : message
}

// -------------------------------------------------------------- mutations ---

/** Apply an authoring operation, recording the previous capture for undo. */
function commit(next) {
  state.history.push(state.capture)
  state.capture = next
}

/** Field edits: update the model, refresh readiness, do NOT re-render. */
function editInPlace(next) {
  state.capture = next
  renderReadiness()
}

const handlers = {
  onStepText(stepIndex, lang, value) {
    editInPlace(setStepText(state.capture, stepIndex, lang, value))
  },

  onAlt(stepIndex, imageId, lang, value) {
    editInPlace(setAltText(state.capture, stepIndex, imageId, lang, value))

    // setAltText resets confirmation in the model. Sync the checkbox directly
    // rather than re-rendering, which would yank focus out of the field being
    // typed in. Without this the box stays ticked while the model says
    // unconfirmed — the UI claiming a confirmation the author never gave.
    const box = document.getElementById(fieldId('altok', stepIndex, imageId, lang))
    if (box?.checked) box.checked = false
  },

  onConfirmAlt(stepIndex, imageId, lang, confirmed) {
    if (!confirmed) {
      editInPlace(
        setAltText(
          state.capture,
          stepIndex,
          imageId,
          lang,
          currentAlt(stepIndex, imageId, lang) ?? ''
        )
      )
      return
    }
    try {
      editInPlace(confirmAltText(state.capture, stepIndex, imageId, lang))
    } catch {
      // Confirming empty alt text is refused by the model. Re-render so the
      // checkbox returns to its real state rather than lying about it.
      rerenderSteps()
    }
  },

  onDecorative(stepIndex, imageId, decorative) {
    // Changes which fields exist, so the list must be rebuilt.
    commit(setDecorative(state.capture, stepIndex, imageId, decorative))
    rerenderSteps({ focusId: document.activeElement?.id })
  },

  onMerge(stepIndex) {
    const previous = stepIndex - 1
    commit(mergeStepIntoPrevious(state.capture, stepIndex))
    // The button that was pressed no longer exists; land on the merged step.
    rerenderSteps({ preserveFocus: false, fallbackPosition: previous - 1 })
    announce('editor.merged', { previous })
  },

  onDelete(stepIndex) {
    commit(deleteStep(state.capture, stepIndex))
    // Land on whichever step took the deleted one's place.
    rerenderSteps({ preserveFocus: false, fallbackPosition: stepIndex - 1 })
    announce('editor.deleted', { index: stepIndex })
  },
}

function currentAlt(stepIndex, imageId, lang) {
  const step = state.capture.steps[stepIndex - 1]
  return step?.images.find((image) => image.id === imageId)?.alt?.[lang] ?? null
}

// ----------------------------------------------------------------- load ----

async function loadFile(file) {
  if (!file) return

  releaseObjectUrls()
  hide(els.error)
  hide(els.capture)
  hide(els.warnings)
  hide(els.steps)
  hide(els.readiness)
  setStatus('status.reading')

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    state.capture = await parseSnagitDocx(bytes)
    state.history = []
    // A new capture is a new baseline, so its outstanding count is announced.
    state.lastBlockerCount = null
    renderAll()
    setStatus('status.parsed', {
      count: state.capture.steps.length,
      title: state.capture.title || t('capture.untitled', state.lang),
    })
  } catch (error) {
    state.capture = null
    if (error instanceof DocxError) {
      showError(error.code)
    } else {
      console.error(error)
      showError('UNKNOWN')
    }
  }
}

// ---------------------------------------------------------------- events ---

els.fileInput.addEventListener('change', (event) => loadFile(event.target.files[0]))

// Drag and drop is an enhancement only — the file input alone is sufficient.
for (const type of ['dragenter', 'dragover']) {
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault()
    els.dropzone.classList.add('is-active')
  })
}

for (const type of ['dragleave', 'drop']) {
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault()
    els.dropzone.classList.remove('is-active')
  })
}

els.dropzone.addEventListener('drop', (event) => loadFile(event.dataTransfer?.files?.[0]))

els.seedAlt.addEventListener('click', () => {
  const count = countUnseeded()
  if (count === 0) {
    announce('editor.seededNone')
    return
  }
  commit(seedAltText(state.capture, state.capture.sourceLang))
  rerenderSteps()
  announce('editor.seeded', { count })
})

els.undo.addEventListener('click', () => {
  if (!state.history.length) return
  state.capture = state.history.pop()
  rerenderSteps()
  announce('editor.undone')
  if (els.undo.hidden) els.seedAlt.focus()
})

els.langToggle.addEventListener('click', () => {
  const index = LANGUAGES.indexOf(state.lang)
  state.lang = LANGUAGES[(index + 1) % LANGUAGES.length]
  // The readiness wording changes but the meaning does not, and the toggle
  // makes its own announcement — re-reading the count here would be noise.
  renderAll({ announceReadiness: false })
  // Announce in the language just switched to, per WCAG 4.1.3.
  els.status.textContent = t('lang.changed', state.lang)
  els.langToggle.focus()
})

function countUnseeded() {
  const lang = state.capture.sourceLang
  return state.capture.steps
    .flatMap((step) => step.images)
    .filter((image) => !image.decorative && image.alt?.[lang] == null).length
}

// ------------------------------------------------------------------ init ---

if (typeof DecompressionStream === 'undefined') {
  show(els.unsupported)
  els.fileInput.disabled = true
}

applyStaticStrings(document, state.lang)
setStatus('status.empty')

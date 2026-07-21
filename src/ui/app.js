/**
 * App shell: load a capture, render it, announce what happened.
 *
 * This module owns events, state and side effects only. The DOM building lives
 * in render.js so accessibility tests can construct the rendered state without
 * a browser, and so Stage 2's editor can re-render after every edit.
 *
 * Stage 1 only renders. Editing, alt text and translation are Stage 2 — but the
 * i18n and aria-live plumbing is built now, because bolting either on later
 * means re-testing every state.
 */

import { parseSnagitDocx } from '../lib/parse-snagit.js'
import { DocxError } from '../lib/docx.js'
import { t, LANGUAGES } from '../lib/i18n.js'
import { applyStaticStrings, buildMeta, buildWarnings, buildSteps } from './render.js'

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
  steps: document.getElementById('steps'),
  stepsList: document.getElementById('steps-list'),
  langToggle: document.getElementById('lang-toggle'),
}

const state = {
  lang: LANGUAGES[0],
  capture: null,
  /** Object URLs we created, so they can be revoked on reload. */
  objectUrls: [],
}

// --------------------------------------------------------------- helpers ---

function setStatus(key, vars) {
  els.status.textContent = t(key, state.lang, vars)
}

const show = (el) => {
  el.hidden = false
}
const hide = (el) => {
  el.hidden = true
}

function releaseObjectUrls() {
  for (const url of state.objectUrls) URL.revokeObjectURL(url)
  state.objectUrls = []
}

/** Track every URL we mint so reloading a capture cannot leak them. */
function trackedImageUrl(bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
  state.objectUrls.push(url)
  return url
}

// ---------------------------------------------------------------- render ---

function render() {
  applyStaticStrings(document, state.lang)

  if (!state.capture) {
    setStatus('status.empty')
    return
  }

  els.captureMeta.replaceChildren(...buildMeta(document, state.capture, state.lang))
  els.stepsList.replaceChildren(
    ...buildSteps(document, state.capture, state.lang, trackedImageUrl)
  )

  if (state.capture.warnings.length) {
    els.warningsList.replaceChildren(...buildWarnings(document, state.capture, state.lang))
    show(els.warnings)
  } else {
    hide(els.warnings)
  }

  show(els.capture)
  show(els.steps)

  setStatus('status.parsed', {
    count: state.capture.steps.length,
    title: state.capture.title || t('capture.untitled', state.lang),
  })
}

function showError(code) {
  const key = `error.${code}`
  const message = t(key, state.lang)
  show(els.error)
  // Announced by the role="alert" region. Clear the polite status first so the
  // two regions cannot announce contradictory things in sequence.
  els.status.textContent = ''
  els.errorDetail.textContent = message === key ? t('error.UNKNOWN', state.lang) : message
}

// ----------------------------------------------------------------- load ----

async function loadFile(file) {
  if (!file) return

  releaseObjectUrls()
  hide(els.error)
  hide(els.capture)
  hide(els.warnings)
  hide(els.steps)
  setStatus('status.reading')

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    state.capture = await parseSnagitDocx(bytes)
    render()
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

els.dropzone.addEventListener('drop', (event) => {
  loadFile(event.dataTransfer?.files?.[0])
})

els.langToggle.addEventListener('click', () => {
  const index = LANGUAGES.indexOf(state.lang)
  state.lang = LANGUAGES[(index + 1) % LANGUAGES.length]
  render()
  // Announce in the language just switched to, per WCAG 4.1.3.
  els.status.textContent = t('lang.changed', state.lang)
  els.langToggle.focus()
})

// ------------------------------------------------------------------ init ---

if (typeof DecompressionStream === 'undefined') {
  show(els.unsupported)
  els.fileInput.disabled = true
}

applyStaticStrings(document, state.lang)
setStatus('status.empty')

/**
 * App shell: load a capture, render it, announce what happened.
 *
 * Stage 1 only renders. Editing, alt text and translation are Stage 2 — but the
 * i18n and aria-live plumbing is built now, because bolting either on later
 * means re-testing every state.
 */

import { parseSnagitDocx } from '../lib/parse-snagit.js'
import { DocxError } from '../lib/docx.js'
import { t, LOCALES, LANGUAGES } from '../lib/i18n.js'

const els = {
  html: document.documentElement,
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

/** Re-render every element carrying a data-i18n key. */
function applyStaticStrings() {
  els.html.lang = LOCALES[state.lang]
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n, state.lang)
  }
}

function setStatus(key, vars) {
  els.status.textContent = t(key, state.lang, vars)
}

function show(el) {
  el.hidden = false
}

function hide(el) {
  el.hidden = true
}

function releaseObjectUrls() {
  for (const url of state.objectUrls) URL.revokeObjectURL(url)
  state.objectUrls = []
}

// ---------------------------------------------------------------- render ---

function renderMeta(capture) {
  const rows = [
    ['capture.author', capture.author],
    ['capture.duration', capture.duration],
    ['capture.date', capture.date],
    ['capture.stepCount', String(capture.steps.length)],
  ].filter(([, value]) => value)

  els.captureMeta.replaceChildren(
    ...rows.flatMap(([key, value]) => {
      const dt = document.createElement('dt')
      dt.textContent = t(key, state.lang)
      const dd = document.createElement('dd')
      dd.textContent = value
      return [dt, dd]
    })
  )
}

function renderWarnings(capture) {
  if (!capture.warnings.length) {
    hide(els.warnings)
    return
  }

  els.warningsList.replaceChildren(
    ...capture.warnings.map((warning) => {
      const li = document.createElement('li')
      li.textContent = t(`warning.${warning.code}`, state.lang, { index: warning.stepIndex })
      return li
    })
  )
  show(els.warnings)
}

function renderSteps(capture) {
  const total = capture.steps.length

  els.stepsList.replaceChildren(
    ...capture.steps.map((step) => {
      const li = document.createElement('li')
      li.className = 'step'

      const body = document.createElement('div')
      body.className = 'step__body'

      const label = document.createElement('span')
      label.className = 'step__label'
      label.textContent = t('step.label', state.lang, { index: step.index, total })

      const text = document.createElement('p')
      text.className = 'step__text'
      const translated = step.text[state.lang]
      const stepText = translated ?? step.text[capture.sourceLang]
      if (stepText) {
        text.textContent = stepText
        // Until Stage 2 supplies a translation we fall back to the source
        // language. Content in another language MUST declare it, or a screen
        // reader pronounces English with French phonetics (WCAG 3.1.2).
        if (!translated && capture.sourceLang !== state.lang) {
          text.lang = LOCALES[capture.sourceLang] ?? capture.sourceLang
        }
      } else {
        text.textContent = t('step.noText', state.lang)
        text.classList.add('step__missing')
      }

      body.append(label, text)

      const figure = document.createElement('figure')
      figure.className = 'step__figure'

      if (step.images.length) {
        for (const image of step.images) {
          const url = URL.createObjectURL(new Blob([image.bytes], { type: 'image/png' }))
          state.objectUrls.push(url)

          const img = document.createElement('img')
          img.src = url
          // Stage 2 replaces this with author-confirmed alt text. Until then it
          // states plainly that alt text is outstanding rather than pretending.
          img.alt = image.alt[state.lang] ?? t('step.imagePending', state.lang, { index: step.index })
          if (image.width && image.height) {
            img.width = image.width
            img.height = image.height
          }
          figure.append(img)
        }
      } else {
        const missing = document.createElement('p')
        missing.className = 'step__missing'
        missing.textContent = t('step.noImage', state.lang)
        figure.append(missing)
      }

      li.append(body, figure)
      return li
    })
  )
}

function render() {
  applyStaticStrings()

  if (!state.capture) {
    setStatus('status.empty')
    return
  }

  renderMeta(state.capture)
  renderWarnings(state.capture)
  renderSteps(state.capture)

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

applyStaticStrings()
setStatus('status.empty')

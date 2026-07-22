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
import { t, LANGUAGES, LOCALES } from '../lib/i18n.js'
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
import {
  buildTranslationPrompt,
  parseTranslationResponse,
  applyTranslation,
  TranslationError,
} from '../lib/translate.js'
import { saveDraft, loadDraft, clearDraft, rehydrate, DraftError } from '../lib/draft.js'
import { emitQuickSteps } from '../lib/emit-quick-steps.js'
import { emitWalkthrough } from '../lib/emit-walkthrough.js'
import { emitCaseStudy } from '../lib/emit-case-study.js'
import { emitDocx } from '../lib/emit-docx.js'
import {
  setNarrative,
  confirmNarrative,
  setScenario,
  caseStudyReadiness,
  hasNarrative,
  buildCaseStudyPrompt,
  applyCaseStudyResponse,
  SCENARIO_FIELDS,
} from '../lib/case-study.js'
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
  translate: document.getElementById('translate'),
  copyPrompt: document.getElementById('copy-prompt'),
  promptOutput: document.getElementById('prompt-output'),
  translationInput: document.getElementById('translation-input'),
  applyTranslation: document.getElementById('apply-translation'),
  steps: document.getElementById('steps'),
  stepsList: document.getElementById('steps-list'),
  seedAlt: document.getElementById('seed-alt'),
  undo: document.getElementById('undo'),
  langToggle: document.getElementById('lang-toggle'),
  draftPending: document.getElementById('draft-pending'),
  draftPendingText: document.getElementById('draft-pending-text'),
  discardDraft: document.getElementById('discard-draft'),
  saveState: document.getElementById('save-state'),
  downloadQuickSteps: document.getElementById('download-quick-steps'),
  downloadWalkthrough: document.getElementById('download-walkthrough'),
  downloadCaseStudy: document.getElementById('download-case-study'),
  downloadDocx: document.getElementById('download-docx'),
  caseStudy: document.getElementById('case-study'),
  casePrompt: document.getElementById('case-prompt'),
  casePromptOutput: document.getElementById('case-prompt-output'),
  caseDraftInput: document.getElementById('case-draft-input'),
  applyCaseDraft: document.getElementById('apply-case-draft'),
  scenario: Object.fromEntries(
    ['audience', 'context', 'outcome'].map((f) => [f, document.getElementById(`scenario-${f}`)])
  ),
  exportHint: document.getElementById('export-hint'),
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
  /**
   * The visible error, as {code, vars}. Error text is generated, not marked up
   * with data-i18n, so without this a francophone who switches language keeps
   * reading an English error.
   */
  lastError: null,
}

// --------------------------------------------------------------- helpers ---

/** Pending draft found at startup, waiting for its file to be re-dropped. */
let pendingDraft = null
let saveTimer = null

const formatWhen = (iso) => {
  try {
    return new Date(iso).toLocaleString(LOCALES[state.lang] ?? state.lang, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}


const show = (el) => {
  el.hidden = false
}
const hide = (el) => {
  el.hidden = true
}

/**
 * The status region has no data-i18n, so its key is tracked here — otherwise a
 * language change would leave the last message stranded in the old language.
 */
let currentStatus = { key: 'status.empty', vars: undefined }

function setStatus(key, vars) {
  currentStatus = { key, vars }
  els.status.textContent = t(key, state.lang, vars)
}

function announce(key, vars) {
  currentStatus = { key, vars }
  // Re-assigning identical text does not re-announce, so clear first.
  els.status.textContent = ''
  els.status.textContent = t(key, state.lang, vars)
}

/** Re-render the status in the current language, without re-announcing. */
function retranslateStatus() {
  els.status.textContent = t(currentStatus.key, state.lang, currentStatus.vars)
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

  // The gate, enforced at the control itself. `disabled` rather than hidden, so
  // the export is visibly present and its unavailability is discoverable —
  // a button that vanishes tells the author nothing about what to fix.
  els.downloadQuickSteps.disabled = !readiness.ready
  els.downloadWalkthrough.disabled = !readiness.ready
  els.downloadDocx.disabled = !readiness.ready
  // One .docx per language — a Word document has no toggle, so the button
  // names which language it will produce.
  els.downloadDocx.textContent = t('export.downloadDocx', state.lang, {
    lang: t(`lang.name.${state.lang}`, state.lang),
  })
  // The case study carries an extra condition: no unreviewed drafted prose,
  // and something to actually say. Its own gate, because an unreviewed
  // explanation must not block the other two artifacts.
  const narrative = caseStudyReadiness(state.capture, state.capture.languages)
  els.downloadCaseStudy.disabled =
    !readiness.ready || !narrative.ready || !hasNarrative(state.capture, state.capture.languages)
  els.exportHint.hidden = readiness.ready

  show(els.readiness)
}

function renderSteps() {
  els.stepsList.replaceChildren(
    ...buildEditableSteps(document, state.capture, state.lang, handlers, trackedImageUrl)
  )
}

function renderAll({ announceReadiness = true } = {}) {
  applyStaticStrings(document, state.lang)

  // Error text is generated rather than marked up with data-i18n, so it has to
  // be regenerated by hand or it stays in the previous language.
  if (state.lastError) {
    els.errorDetail.textContent = errorMessage(state.lastError.code, state.lastError.vars)
  }

  retranslateStatus()

  // Also generated rather than data-i18n markup, so it needs the same treatment.
  if (pendingDraft) {
    els.draftPendingText.textContent = t('draft.pending', state.lang, {
      when: formatWhen(pendingDraft.savedAt),
    })
  }

  if (!state.capture) return

  els.captureMeta.replaceChildren(...buildMeta(document, state.capture, state.lang))

  if (state.capture.warnings.length) {
    els.warningsList.replaceChildren(...buildWarnings(document, state.capture, state.lang))
    show(els.warnings)
  } else {
    hide(els.warnings)
  }

  renderSteps()
  renderReadiness({ announce: announceReadiness })

  for (const field of SCENARIO_FIELDS) {
    els.scenario[field].value = state.capture.scenario?.[field]?.[state.capture.sourceLang] ?? ''
  }

  els.undo.hidden = state.history.length === 0
  show(els.capture)
  show(els.translate)
  show(els.caseStudy)
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

/**
 * Show a translated error in the `role="alert"` region.
 *
 * The text is cleared before being set. Assigning identical `textContent` is
 * not a DOM mutation, so making the same mistake twice would otherwise be
 * announced only the first time — and repeating a mistake is exactly when
 * feedback matters most.
 *
 * @param {string} code stable error code, never a raw message
 * @param {object} [vars] substitutions for the translated string
 */
function showError(code, vars) {
  state.lastError = { code, vars }
  show(els.error)
  // Clear the polite status too, so the two regions cannot announce
  // contradictory things in sequence.
  els.status.textContent = ''
  els.errorDetail.textContent = ''
  els.errorDetail.textContent = errorMessage(code, vars)
}

function errorMessage(code, vars) {
  const key = `error.${code}`
  const message = t(key, state.lang, vars)
  return message === key ? t('error.UNKNOWN', state.lang) : message
}

/** Hide the error and forget it, so it is not resurrected by a re-render. */
function clearError() {
  state.lastError = null
  hide(els.error)
}

// -------------------------------------------------------------- mutations ---

/** Apply an authoring operation, recording the previous capture for undo. */
function commit(next) {
  state.history.push(state.capture)
  state.capture = next
  scheduleSave()
}

/** Field edits: update the model, refresh readiness, do NOT re-render. */
function editInPlace(next) {
  state.capture = next
  renderReadiness()
  scheduleSave()
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

  onNarrative(stepIndex, field, lang, value) {
    // Typing over a drafted passage IS the review — setNarrative marks it
    // authored, which is why no separate confirm step is needed after an edit.
    const wasDrafted = state.capture.steps[stepIndex - 1]?.narrative?.[field]?.[lang]?.drafted
    editInPlace(setNarrative(state.capture, stepIndex, field, lang, value))
    if (wasDrafted) rerenderSteps()
  },

  onConfirmNarrative(stepIndex, field, lang) {
    commit(confirmNarrative(state.capture, stepIndex, field, lang))
    rerenderSteps()
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
  clearError()
  hide(els.capture)
  hide(els.warnings)
  hide(els.steps)
  hide(els.readiness)
  hide(els.translate)
  hide(els.caseStudy)
  setStatus('status.reading')

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const fresh = await parseSnagitDocx(bytes)

    // A draft holds no screenshots, so this drop is what brings them back.
    // Rehydrating is refused unless the file is demonstrably the same
    // recording — restoring onto the wrong images would be silent and wrong.
    let restored = null
    if (pendingDraft) {
      try {
        restored = rehydrate(pendingDraft, fresh)
      } catch (error) {
        if (!(error instanceof DraftError)) throw error
        // Keep the draft: this may simply be the wrong file, and discarding
        // someone's work because they dropped the wrong thing is unforgivable.
        announce('draft.mismatch')
      }
    }

    state.capture = restored ? restored.capture : fresh
    state.history = []
    // A new capture is a new baseline, so its outstanding count is announced.
    state.lastBlockerCount = null
    renderAll()

    if (restored) {
      pendingDraft = null
      hide(els.draftPending)
      announce('draft.restored', {
        steps: state.capture.steps.length,
        images: restored.restoredImages,
      })
    } else if (!pendingDraft) {
      setStatus('status.parsed', {
        count: state.capture.steps.length,
        title: state.capture.title || t('capture.untitled', state.lang),
      })
    }
    scheduleSave()
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
  // Undo changes the document, so the draft must follow it back.
  scheduleSave()
  announce('editor.undone')
  if (els.undo.hidden) els.seedAlt.focus()
})

// ----------------------------------------------------------------- draft ---

/**
 * Persist after a short idle gap.
 *
 * Writing on every keystroke would thrash storage and make typing feel
 * sluggish, so edits coalesce. A failure is reported in text — silently losing
 * autosave is worse than not offering it, because the author stops being
 * careful once they believe their work is safe.
 */
function scheduleSave() {
  if (!state.capture) return
  // A draft is still waiting to be reunited with its file. Saving now would
  // overwrite work the author has not recovered yet — which is exactly the
  // thing autosave exists to prevent. Saving resumes once the draft is either
  // restored or deliberately discarded.
  if (pendingDraft) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      const { savedAt } = saveDraft(localStorage, state.capture)
      els.saveState.textContent = t('draft.saved', state.lang, { when: formatWhen(savedAt) })
    } catch (error) {
      els.saveState.textContent = t('draft.notSaved', state.lang)
      if (error instanceof DraftError) showError(error.code)
    }
  }, 800)
}

function discardPendingDraft() {
  clearDraft(localStorage)
  pendingDraft = null
  hide(els.draftPending)
  els.saveState.textContent = ''
  announce('draft.discarded')
}

/** At startup, look for work left behind by a previous session. */
function checkForPendingDraft() {
  try {
    pendingDraft = loadDraft(localStorage)
  } catch (error) {
    // An unreadable or outdated draft is discarded, with an explanation —
    // never loaded into a shape the code no longer expects.
    clearDraft(localStorage)
    pendingDraft = null
    if (error instanceof DraftError) showError(error.code)
    return
  }

  if (!pendingDraft) return
  els.draftPendingText.textContent = t('draft.pending', state.lang, {
    when: formatWhen(pendingDraft.savedAt),
  })
  show(els.draftPending)
}

els.discardDraft.addEventListener('click', discardPendingDraft)

// ---------------------------------------------------------------- export ---

/** Slug for a filename: safe on every filesystem, still recognisable. */
function fileSlug(text, fallback) {
  const slug = String(text ?? '')
    .normalize('NFD')
    // Combining diacritics, written as escapes so the source stays ASCII-safe.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug || fallback
}

/** Hand a generated artifact to the browser's download machinery. */
function downloadHtml(html, name) {
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), name)
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // Revoke on the next tick; revoking immediately can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Generate one artifact and hand it to the browser, reporting either way. */
function exportArtifact(emit, suffix) {
  clearError()
  const name = `${fileSlug(state.capture.title, 'capture')}-${suffix}.html`
  try {
    downloadHtml(emit(state.capture, { languages: state.capture.languages }), name)
    announce('export.downloaded', { name })
  } catch (error) {
    console.error(error)
    showError('EXPORT_FAILED', { reason: error.message })
  }
}

els.downloadQuickSteps.addEventListener('click', () => exportArtifact(emitQuickSteps, 'quick-steps'))
els.downloadCaseStudy.addEventListener('click', () => exportArtifact(emitCaseStudy, 'case-study'))

els.downloadDocx.addEventListener('click', async () => {
  clearError()
  const name = `${fileSlug(state.capture.title, 'capture')}-${state.lang}.docx`
  try {
    const bytes = await emitDocx(state.capture, { lang: state.lang })
    downloadBlob(
      new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      name
    )
    announce('export.downloaded', { name })
  } catch (error) {
    console.error(error)
    showError('EXPORT_FAILED', { reason: error.message })
  }
})

for (const field of SCENARIO_FIELDS) {
  els.scenario[field].addEventListener('input', () => {
    editInPlace(setScenario(state.capture, field, state.capture.sourceLang, els.scenario[field].value))
  })
}

els.casePrompt.addEventListener('click', async () => {
  clearError()
  let prompt
  try {
    prompt = buildCaseStudyPrompt(state.capture, state.capture.sourceLang)
  } catch (error) {
    return announceTranslationError(error)
  }
  els.casePromptOutput.value = prompt
  try {
    await navigator.clipboard.writeText(prompt)
    announce('translate.copied')
  } catch {
    announce('translate.builtNotCopied')
    els.casePromptOutput.focus()
    els.casePromptOutput.select()
  }
})

els.applyCaseDraft.addEventListener('click', () => {
  clearError()
  let result
  try {
    result = applyCaseStudyResponse(state.capture, els.caseDraftInput.value, state.capture.sourceLang)
  } catch (error) {
    if (error instanceof TranslationError) return announceTranslationError(error)
    console.error(error)
    return showError('UNKNOWN')
  }

  commit(result.capture)
  rerenderSteps()

  if (result.declined.length) {
    // A model declining to guess is a useful signal, not a failure to hide.
    announce('caseStudy.declined', { count: result.declined.length })
  } else {
    announce('caseStudy.drafted', { count: result.applied })
  }
})
els.downloadWalkthrough.addEventListener('click', () => exportArtifact(emitWalkthrough, 'walkthrough'))

// ------------------------------------------------------------ translation ---

/** Target language = the first configured language that is not the source. */
function targetLanguage() {
  return (state.capture.languages ?? []).find((code) => code !== state.capture.sourceLang) ?? 'fr'
}

/** Show a translation error using its stable code, never a raw message. */
function announceTranslationError(error) {
  showError(error.code, { ids: error.ids?.join(', ') })
}

els.copyPrompt.addEventListener('click', async () => {
  clearError()
  let prompt
  try {
    prompt = buildTranslationPrompt(state.capture, {
      from: state.capture.sourceLang,
      to: targetLanguage(),
    })
  } catch (error) {
    return announceTranslationError(error)
  }

  // Always render it into the readonly box: the clipboard API can be refused,
  // and a keyboard user may prefer to select it anyway.
  els.promptOutput.value = prompt

  try {
    await navigator.clipboard.writeText(prompt)
    announce('translate.copied')
  } catch {
    announce('translate.builtNotCopied')
    els.promptOutput.focus()
    els.promptOutput.select()
  }
})

els.applyTranslation.addEventListener('click', () => {
  clearError()
  const target = targetLanguage()

  let result
  try {
    const { entries } = parseTranslationResponse(els.translationInput.value)
    result = applyTranslation(state.capture, entries, target, state.capture.sourceLang)
  } catch (error) {
    if (error instanceof TranslationError) return announceTranslationError(error)
    console.error(error)
    return showError('UNKNOWN')
  }

  commit(result.capture)
  rerenderSteps()

  if (result.missing.length) {
    // Never a silent partial import — name what did not come back.
    announce('translate.appliedWithMissing', {
      count: result.applied,
      missing: result.missing.length,
      ids: result.missing.map((m) => m.id).join(', '),
    })
  } else {
    announce('translate.applied', { count: result.applied })
  }
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
checkForPendingDraft()

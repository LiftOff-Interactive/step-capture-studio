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
  setTitle,
  setAltText,
  setDecorative,
  mergeStepIntoPrevious,
  deleteStep,
  seedAltText,
  exportReadiness,
  verifyStep,
  unverifyStep,
  stepVerification,
} from '../lib/authoring.js'
import {
  buildTranslationPrompt,
  parseTranslationResponse,
  applyTranslation,
  TranslationError,
} from '../lib/translate.js'
import { emitQuickSteps } from '../lib/emit-quick-steps.js'
import { emitWalkthrough } from '../lib/emit-walkthrough.js'
import { emitCaseStudy } from '../lib/emit-case-study.js'
import { emitDocx } from '../lib/emit-docx.js'
import { emitProject } from '../lib/emit-project.js'
import { parseProject, ProjectError } from '../lib/parse-project.js'
import { artifactName, captureTitle, imageType } from '../lib/emit-common.js'
import {
  setNarrative,
  setScenario,
  caseStudyReadiness,
  hasNarrative,
  buildCaseStudyPrompt,
  applyCaseStudyResponse,
  SCENARIO_FIELDS,
} from '../lib/case-study.js'
import { applyStaticStrings, buildMeta, buildWarnings } from './render.js'
import {
  buildEditableSteps,
  buildTitleFields,
  buildBlockerList,
  readinessSummaryText,
  fieldId,
} from './editor.js'

/**
 * An export control and its twin at the foot of the step list.
 *
 * Returned as an array so every call site has to act on both. An earlier
 * shape held the two separately, which makes it possible to disable one and
 * leave the other live — and a download button that ignores the export gate
 * is the one bug this app cannot afford.
 */
function exportPair(id) {
  return [document.getElementById(id), document.getElementById(`${id}-bottom`)].filter(Boolean)
}

/** Apply a property to every control in a pair. */
function setOnPair(pair, property, value) {
  for (const element of pair) element[property] = value
}

const els = {
  unsupported: document.getElementById('unsupported'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  projectInput: document.getElementById('project-input'),
  loadDemo: document.getElementById('load-demo'),
  exportProject: document.getElementById('export-project'),
  status: document.getElementById('status'),
  error: document.getElementById('error'),
  errorDetail: document.getElementById('error-detail'),
  capture: document.getElementById('capture'),
  captureMeta: document.getElementById('capture-meta'),
  titleFields: document.getElementById('title-fields'),
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
  // Each export control appears twice: once in the panel above the editor and
  // once at the foot of the step list, where the author actually finishes.
  // Held as pairs so the gate and the labels can never be applied to one and
  // forgotten on the other.
  downloadQuickSteps: exportPair('download-quick-steps'),
  downloadWalkthrough: exportPair('download-walkthrough'),
  downloadCaseStudy: exportPair('download-case-study'),
  downloadDocx: exportPair('download-docx'),
  exportFooter: document.getElementById('export-footer'),
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
  // Label the blob with the format the bytes actually are, not a hardcoded PNG.
  // Browsers sniff and display either way, but a JPEG served as image/png is the
  // same bytes-vs-label mismatch the emitters were just fixed for.
  const url = URL.createObjectURL(new Blob([bytes], { type: imageType(bytes).mime }))
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
  setOnPair(els.downloadQuickSteps, 'disabled', !readiness.ready)
  setOnPair(els.downloadWalkthrough, 'disabled', !readiness.ready)
  setOnPair(els.downloadDocx, 'disabled', !readiness.ready)
  // One .docx per language — a Word document has no toggle, so the button
  // names which language it will produce.
  setOnPair(
    els.downloadDocx,
    'textContent',
    t('export.downloadDocx', state.lang, { lang: t(`lang.name.${state.lang}`, state.lang) })
  )
  // The case study carries an extra condition: no unreviewed drafted prose,
  // and something to actually say. Its own gate, because an unreviewed
  // explanation must not block the other two artifacts.
  const narrative = caseStudyReadiness(state.capture, state.capture.languages)
  setOnPair(
    els.downloadCaseStudy,
    'disabled',
    !readiness.ready || !narrative.ready || !hasNarrative(state.capture, state.capture.languages)
  )
  els.exportHint.hidden = readiness.ready

  // The footer copy is hidden until the gate opens, rather than shown disabled
  // like the panel above. The panel's job is to explain what is still missing;
  // repeating that explanation at the bottom would just be noise, and an
  // author who has not finished has no reason to see a second set of buttons.
  els.exportFooter.hidden = !readiness.ready

  show(els.readiness)
}

/**
 * Rebuild the title fields from the model.
 *
 * Called on a full render AND after anything that can change the title behind
 * the author's back — the translation round trip now carries it. Without that
 * second call the field kept showing an empty French title while the model held
 * the translated one, and typing into the stale field would have silently
 * overwritten the translation.
 *
 * Editing is applied in place rather than re-rendering, for the same reason as
 * `onAlt`: rebuilding on every keystroke pulls focus out of the field.
 */
function renderTitleFields() {
  els.titleFields.replaceChildren(
    buildTitleFields(document, state.capture, state.lang, (code, value) => {
      editInPlace(setTitle(state.capture, code, value))
    })
  )
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

  if (!state.capture) return

  els.captureMeta.replaceChildren(...buildMeta(document, state.capture, state.lang))
  renderTitleFields()

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
function rerenderSteps({ preserveFocus = true, fallbackPosition, fallbackStepIndex } = {}) {
  const activeId = preserveFocus ? document.activeElement?.id : null
  renderSteps()
  renderReadiness()
  els.undo.hidden = state.history.length === 0

  const restored = activeId && document.getElementById(activeId)
  if (restored) return restored.focus()

  // Land back in the step the author was working in. Falling through to
  // `seedAlt` sends focus to a button above the whole list, which the browser
  // then scrolls to — reading as the page jumping to the top after a click.
  if (fallbackStepIndex != null) {
    const step = els.stepsList.querySelector(`[data-step-index="${fallbackStepIndex}"]`)
    const control = step?.querySelector('input, textarea, button')
    if (control) return control.focus()
  }

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
}

/** Field edits: update the model, refresh readiness, do NOT re-render. */
function editInPlace(next) {
  state.capture = next
  renderReadiness()
}

/**
 * Bring one step's verification checkbox back in line with the model, without
 * rebuilding the list.
 *
 * Typing must not re-render — that would pull focus out of the field being
 * typed in — so the checkbox has to be updated in place. It has three things
 * to keep in sync, and missing any one of them makes the control lie:
 *   - `checked`, or it claims a confirmation the edit just withdrew;
 *   - `disabled`, or filling in the last empty alt field leaves the box
 *     permanently unclickable, since nothing else triggers a re-render;
 *   - the hint, which otherwise still tells the author to fill in a field
 *     they have already filled in.
 */
function syncStepVerification(stepIndex) {
  const box = document.getElementById(fieldId('stepok', stepIndex))
  if (!box) return

  const verification = stepVerification(state.capture, stepIndex, state.capture.languages)
  const blocked = verification.blocked.length > 0

  box.checked = verification.verified
  box.disabled = blocked

  const hint = document.getElementById(fieldId('stepokhelp', stepIndex))
  if (hint) {
    hint.textContent = blocked
      ? t('editor.verifyStepBlocked', state.lang)
      : t('editor.verifyStepHelp', state.lang)
  }
}

const handlers = {
  onStepText(stepIndex, lang, value) {
    editInPlace(setStepText(state.capture, stepIndex, lang, value))
  },

  onAlt(stepIndex, imageId, lang, value) {
    editInPlace(setAltText(state.capture, stepIndex, imageId, lang, value))

    // setAltText resets confirmation in the model. Sync the step's checkbox
    // directly rather than re-rendering, which would yank focus out of the
    // field being typed in. Without this the box stays ticked while the model
    // says unconfirmed — the UI claiming a confirmation the author never gave,
    // which is the worst bug this feature has had (feature-alt-text.md).
    syncStepVerification(stepIndex)
  },

  onNarrative(stepIndex, field, lang, value) {
    // Typing over a drafted passage IS the review — setNarrative marks it
    // authored, which is why no separate confirm step is needed after an edit.
    const wasDrafted = state.capture.steps[stepIndex - 1]?.narrative?.[field]?.[lang]?.drafted
    editInPlace(setNarrative(state.capture, stepIndex, field, lang, value))
    if (wasDrafted) rerenderSteps()
  },

  /**
   * One control confirms everything outstanding in a step.
   *
   * The re-render is unavoidable — confirming drafted narrative removes its
   * "not yet reviewed" notice, so the step's markup genuinely changes. But the
   * checkbox itself keeps a stable id across the rebuild, so focus is restored
   * to it rather than falling back to the top of the page.
   */
  onVerifyStep(stepIndex, verified) {
    commit(
      verified
        ? verifyStep(state.capture, stepIndex, state.capture.languages)
        : unverifyStep(state.capture, stepIndex, state.capture.languages)
    )
    rerenderSteps({ fallbackStepIndex: stepIndex })
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

    state.capture = fresh
    state.history = []
    // A new capture is a new baseline, so its outstanding count is announced.
    state.lastBlockerCount = null
    renderAll()

    setStatus('status.parsed', {
      count: state.capture.steps.length,
      title: captureTitle(state.capture, state.lang),
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

/**
 * Restore a previously exported project file.
 *
 * Unlike `loadFile` this does no `.docx` parsing at all — the project file
 * already holds the finished model, screenshots included. It is the only way
 * back into a session once the tab has closed.
 */
async function loadProjectFile(file) {
  if (!file) return
  try {
    await loadProjectText(await file.text())
    announce('project.imported', { count: state.capture.steps.length })
  } catch (error) {
    reportProjectFailure(error)
  }
}

/** Parse project HTML and adopt it. Throws; callers report. */
async function loadProjectText(html) {
  releaseObjectUrls()
  clearError()
  hide(els.capture)
  hide(els.warnings)
  hide(els.steps)
  hide(els.readiness)
  hide(els.translate)
  hide(els.caseStudy)
  setStatus('status.reading')

  const restored = parseProject(html)
  state.capture = restored
  state.history = []
  state.lastBlockerCount = null
  renderAll()
}

function reportProjectFailure(error) {
  state.capture = null
  if (error instanceof ProjectError) {
    showError(error.code, { detail: error.detail ?? '' })
  } else {
    console.error(error)
    showError('UNKNOWN')
  }
}

// ---------------------------------------------------------------- events ---

els.fileInput.addEventListener('change', (event) => loadFile(event.target.files[0]))
els.projectInput.addEventListener('change', (event) => loadProjectFile(event.target.files[0]))

/**
 * The bundled sample.
 *
 * It is an ordinary project file that happens to ship with the site, so it goes
 * through the very same importer as one the user picks — there is no second
 * code path to keep working, and the demo cannot quietly rot while imports
 * still pass.
 *
 * This is the one fetch the app makes, and it is for an asset of this same
 * site. No capture leaves the browser; the privacy claim is unchanged.
 */
els.loadDemo.addEventListener('click', async () => {
  clearError()
  setStatus('status.reading')
  try {
    const response = await fetch('assets/demo/testing-windows-audio.project.html')
    if (!response.ok) throw new Error(`demo fetch failed: ${response.status}`)
    await loadProjectText(await response.text())
    announce('demo.loaded', { count: state.capture.steps.length })
  } catch (error) {
    console.error(error)
    showError('DEMO_UNAVAILABLE')
  }
})

els.exportProject.addEventListener('click', () => {
  if (!state.capture) return
  clearError()
  const name = `${artifactName(captureTitle(state.capture, state.lang), 'Project')}.html`
  try {
    downloadHtml(emitProject(state.capture), name)
    announce('project.exported', { name })
  } catch (error) {
    console.error(error)
    showError('EXPORT_FAILED', { reason: error.message })
  }
})

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

// ---------------------------------------------------------------- export ---

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

/**
 * Generate one artifact and hand it to the browser, reporting either way.
 *
 * The filename comes from the same `artifactName` the emitter puts in
 * `<title>`, so a downloaded file and the PDF it prints to agree.
 */
function exportArtifact(emit, suffix) {
  clearError()
  const name = `${artifactName(captureTitle(state.capture, state.lang), suffix)}.html`
  try {
    downloadHtml(emit(state.capture, { languages: state.capture.languages }), name)
    announce('export.downloaded', { name })
  } catch (error) {
    console.error(error)
    showError('EXPORT_FAILED', { reason: error.message })
  }
}

/** Bind one handler to both copies of an export control. */
function onExportClick(pair, handler) {
  for (const element of pair) element.addEventListener('click', handler)
}

onExportClick(els.downloadQuickSteps, () => exportArtifact(emitQuickSteps, 'QuickStep'))
onExportClick(els.downloadCaseStudy, () => exportArtifact(emitCaseStudy, 'CaseStudy'))

onExportClick(els.downloadDocx, async () => {
  clearError()
  // `_Document_EN`. The language marker is a success criterion, not decoration:
  // one file per language, and the filename has to say which.
  const name = `${artifactName(captureTitle(state.capture, state.lang), 'Document')}_${state.lang.toUpperCase()}.docx`
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
onExportClick(els.downloadWalkthrough, () => exportArtifact(emitWalkthrough, 'Walkthrough'))

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
  // The round trip now carries the guide title, which lives outside the step
  // list — without this the field keeps showing the old value while the model
  // holds the translation, and typing in it would overwrite what just arrived.
  renderTitleFields()

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

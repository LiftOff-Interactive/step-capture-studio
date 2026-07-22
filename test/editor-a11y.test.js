/**
 * Accessibility and behaviour of the editable step list.
 *
 * This is the most control-dense surface in the app — for the real sample it is
 * 10 textareas, 20 alt inputs, 30 checkboxes and 11 buttons — so it is the
 * easiest place to produce something that passes axe and is still unusable.
 * These tests therefore check both machine conformance AND the things axe
 * cannot see: that every control is distinguishable out of context, and that
 * the model refuses to record a decision the author did not make.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { JSDOM } from 'jsdom'
import axe from 'axe-core'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, exportReadiness } from '../src/lib/authoring.js'
import { applyStaticStrings } from '../src/ui/render.js'
import { buildEditableSteps, buildBlockerList, readinessSummaryText } from '../src/ui/editor.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const AXE_OPTIONS = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
  rules: { 'color-contrast': { enabled: false } },
}
const KNOWN_INCOMPLETE = new Set(['landmark-one-main', 'page-has-heading-one'])

const noopHandlers = {
  onStepText() {},
  onAlt() {},
  onConfirmAlt() {},
  onDecorative() {},
  onMerge() {},
  onDelete() {},
}

async function editorDom(capture, lang = 'en', handlers = noopHandlers) {
  const html = await readFile(resolve(projectRoot, 'index.html'), 'utf8')
  const css = await readFile(resolve(projectRoot, 'src/ui/styles.css'), 'utf8')

  const dom = new JSDOM(html, {
    url: 'http://localhost:8080/',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
  })
  const { document } = dom.window

  const style = document.createElement('style')
  style.textContent = css
  document.head.append(style)

  applyStaticStrings(document, lang)
  document
    .getElementById('steps-list')
    .replaceChildren(...buildEditableSteps(document, capture, lang, handlers, () => 'data:,'))
  const readiness = exportReadiness(capture, capture.languages)
  // Mirrors app.js: the summary's text is updated in place, and only the list
  // below it is rebuilt.
  document.getElementById('readiness-summary').textContent = readinessSummaryText(readiness, lang)
  document.getElementById('readiness-body').replaceChildren(buildBlockerList(document, readiness, lang))
  document.getElementById('steps').hidden = false
  document.getElementById('readiness').hidden = false

  dom.window.eval(axe.source)
  return dom
}

function assertAxeClean(results, label) {
  const describe = (rs) =>
    rs.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n  ')
  assert.equal(results.violations.length, 0, `${label} violations:\n  ${describe(results.violations)}`)
  const unexpected = results.incomplete.filter((r) => !KNOWN_INCOMPLETE.has(r.id))
  assert.equal(unexpected.length, 0, `${label} needs-review:\n  ${describe(unexpected)}`)
}

const load = () => parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))

// ------------------------------------------------------------------ tests ---

test('editor is axe clean in English', async () => {
  const dom = await editorDom(seedAltText(await load()), 'en')
  assertAxeClean(await dom.window.axe.run(dom.window.document, AXE_OPTIONS), 'editor (en)')
  dom.window.close()
})

test('editor is axe clean in French', async () => {
  const dom = await editorDom(seedAltText(await load()), 'fr')
  assertAxeClean(await dom.window.axe.run(dom.window.document, AXE_OPTIONS), 'editor (fr)')
  dom.window.close()
})

test('editor is axe clean with a decorative image (fields removed)', async () => {
  const { setDecorative } = await import('../src/lib/authoring.js')
  let capture = await load()
  capture = setDecorative(capture, 1, capture.steps[0].images[0].id, true)
  const dom = await editorDom(seedAltText(capture), 'en')

  assertAxeClean(await dom.window.axe.run(dom.window.document, AXE_OPTIONS), 'editor (decorative)')
  dom.window.close()
})

test('every form control has a programmatic label', async () => {
  const dom = await editorDom(seedAltText(await load()), 'en')
  const { document } = dom.window

  const controls = [...document.querySelectorAll('#steps-list textarea, #steps-list input')]
  assert.ok(controls.length >= 30, `expected a dense form, got ${controls.length} controls`)

  // Index labels by their `for` value rather than building a selector per
  // control — ids are sanitised, but this avoids escaping concerns entirely.
  const labelsFor = new Map()
  for (const label of document.querySelectorAll('label[for]')) {
    labelsFor.set(label.getAttribute('for'), label.textContent.trim())
  }

  for (const control of controls) {
    assert.ok(control.id, 'control has an id')
    assert.ok(labelsFor.has(control.id), `control ${control.id} has a <label for>`)
    assert.ok(labelsFor.get(control.id), `label for ${control.id} is not empty`)
  }
  dom.window.close()
})

test('control ids are unique across the whole form', async () => {
  // 10 steps x 2 languages x several controls collide instantly if ids are not
  // scoped by step and image.
  const dom = await editorDom(seedAltText(await load()), 'en')
  const ids = [...dom.window.document.querySelectorAll('[id]')].map((el) => el.id)
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)

  assert.deepEqual(duplicates, [], 'no duplicate ids')
  dom.window.close()
})

test('each step is grouped so its controls are announced in context', async () => {
  // Without a fieldset/legend a screen reader announces "Alt text" twenty times
  // with no way to tell which step each belongs to.
  const dom = await editorDom(seedAltText(await load()), 'en')
  const { document } = dom.window

  const groups = [...document.querySelectorAll('#steps-list fieldset')]
  assert.equal(groups.length, ENGLISH_STEPS.length)

  groups.forEach((group, i) => {
    const legend = group.querySelector('legend')
    assert.ok(legend, `step ${i + 1} has a legend`)
    assert.match(legend.textContent, new RegExp(`Step ${i + 1} of ${ENGLISH_STEPS.length}`))
  })
  dom.window.close()
})

test('destructive buttons are distinguishable out of context', async () => {
  // Screen readers can list every button on a page. Ten buttons all reading
  // "Delete step" would be useless, so each name carries its step number.
  const dom = await editorDom(seedAltText(await load()), 'en')

  const names = [...dom.window.document.querySelectorAll('#steps-list button')].map((b) =>
    b.textContent.trim()
  )
  const deletes = names.filter((n) => n.startsWith('Delete'))

  assert.equal(deletes.length, ENGLISH_STEPS.length)
  assert.equal(new Set(deletes).size, deletes.length, 'every delete button has a unique name')
  dom.window.close()
})

test('duplicate steps are flagged in text, not by colour alone', async () => {
  const dom = await editorDom(seedAltText(await load()), 'en')
  const notices = [...dom.window.document.querySelectorAll('.step__duplicate')]

  assert.equal(notices.length, 1, 'exactly the one real duplicate')
  assert.match(notices[0].textContent, /Repeats step 3/)
  assert.ok(notices[0].querySelector('button'), 'offers the merge, does not perform it')
  dom.window.close()
})

test('merge is offered, never applied automatically', async () => {
  let merged = null
  const capture = seedAltText(await load())
  const dom = await editorDom(capture, 'en', { ...noopHandlers, onMerge: (i) => (merged = i) })

  assert.equal(merged, null, 'nothing merged just by rendering')
  dom.window.document.querySelector('.step__duplicate button').dispatchEvent(
    new dom.window.Event('click', { bubbles: true })
  )
  assert.equal(merged, 4, 'clicking asks to merge step 4')
  dom.window.close()
})

test('editing a field reports the new value to the handler', async () => {
  const edits = []
  const dom = await editorDom(seedAltText(await load()), 'en', {
    ...noopHandlers,
    onStepText: (index, lang, value) => edits.push({ index, lang, value }),
  })
  const { document, Event } = dom.window

  const textarea = document.getElementById('f-step-1-text-en')
  assert.ok(textarea, 'step 1 English textarea exists')
  textarea.value = 'Open Microsoft Edge from the taskbar'
  textarea.dispatchEvent(new Event('input', { bubbles: true }))

  assert.deepEqual(edits, [
    { index: 1, lang: 'en', value: 'Open Microsoft Edge from the taskbar' },
  ])
  dom.window.close()
})

test('both language fields are present even when one is empty', async () => {
  const dom = await editorDom(seedAltText(await load()), 'en')
  const { document } = dom.window

  assert.ok(document.getElementById('f-step-1-text-en'), 'English step text')
  assert.ok(document.getElementById('f-step-1-text-fr'), 'French step text')
  assert.equal(document.getElementById('f-step-1-text-fr').value, '', 'French empty, still visible')
  dom.window.close()
})

test('language fields declare their own language', async () => {
  // A French input inside an English page must say so, or a screen reader reads
  // French text with English phonetics (WCAG 3.1.2).
  const dom = await editorDom(seedAltText(await load()), 'en')
  const { document } = dom.window

  assert.equal(document.getElementById('f-step-1-text-fr').lang, 'fr-CA')
  assert.equal(document.getElementById('f-step-1-text-en').lang, 'en-CA')
  dom.window.close()
})

test('confirm checkboxes start unchecked for seeded drafts', async () => {
  const dom = await editorDom(seedAltText(await load()), 'en')
  const boxes = [...dom.window.document.querySelectorAll('#steps-list input[type="checkbox"]')]
  const confirms = boxes.filter((b) => b.id.startsWith('f-stepok'))

  assert.ok(confirms.length > 0)
  assert.ok(
    confirms.every((b) => !b.checked),
    'a seeded draft must never render as already confirmed'
  )
  dom.window.close()
})

test('one verification checkbox per step, not one per image per language', async () => {
  const capture = seedAltText(await load())
  const dom = await editorDom(capture, 'en')
  const { document } = dom.window

  for (const step of document.querySelectorAll('#steps-list .step')) {
    const verify = step.querySelectorAll('input[id^="f-stepok"]')
    assert.ok(verify.length <= 1, 'a step must never offer more than one verification control')
  }

  const total = document.querySelectorAll('#steps-list input[id^="f-stepok"]').length
  assert.equal(total, capture.steps.length, 'every step with something to confirm gets exactly one')
  dom.window.close()
})

test('the verification checkbox id is derivable, so it can be synced without a re-render', async () => {
  // Regression test. Editing alt text resets confirmation in the model. If the
  // checkbox is not synced, the UI shows the step ticked while the model says
  // unconfirmed — claiming a confirmation the author never gave. app.js
  // addresses the box by id rather than re-rendering, which would yank focus
  // out of the field being typed in. That contract is what this locks in.
  const { fieldId } = await import('../src/ui/editor.js')
  const dom = await editorDom(seedAltText(await load()), 'en')

  const box = dom.window.document.getElementById(fieldId('stepok', 1))

  assert.ok(box, 'the verification checkbox is addressable by derived id')
  assert.equal(box.type, 'checkbox')
  dom.window.close()
})

test('the verification checkbox reports the model, so it cannot claim a false confirmation', async () => {
  const { verifyStep, setAltText } = await import('../src/lib/authoring.js')
  const { fieldId } = await import('../src/ui/editor.js')
  let base = seedAltText(await load())
  const languages = base.languages

  // seedAltText only seeds the source language. Empty alt text cannot be
  // confirmed at all, so the other language has to be filled in before a step
  // is verifiable — which is the export gate working as designed.
  for (const step of base.steps) {
    for (const image of step.images) {
      for (const lang of languages) {
        if (!image.alt?.[lang]?.trim()) base = setAltText(base, step.index, image.id, lang, `alt ${lang}`)
      }
    }
  }

  // Confirmed in the model -> ticked in the UI.
  let capture = base
  for (const step of base.steps) capture = verifyStep(capture, step.index, languages)
  let dom = await editorDom(capture, 'en')
  assert.equal(dom.window.document.getElementById(fieldId('stepok', 1)).checked, true)
  dom.window.close()

  // Edit one alt text in one language: confirmation is reset, so the single
  // step checkbox must untick even though the other language is still fine.
  const imageId = capture.steps[0].images[0].id
  capture = setAltText(capture, 1, imageId, languages[0], 'something else entirely')
  dom = await editorDom(capture, 'en')
  assert.equal(
    dom.window.document.getElementById(fieldId('stepok', 1)).checked,
    false,
    'one edit anywhere in the step must untick the step'
  )
  // ...and only that step.
  assert.equal(dom.window.document.getElementById(fieldId('stepok', 2)).checked, true)
  dom.window.close()
})

test('readiness summary states what is blocking export', async () => {
  const dom = await editorDom(seedAltText(await load()), 'en')
  const { document } = dom.window

  assert.match(
    document.getElementById('readiness-summary').textContent,
    /still need attention before export/
  )
  assert.ok(
    document.getElementById('readiness-body').querySelectorAll('li').length > 0,
    'lists specific blockers'
  )
  dom.window.close()
})

test('the readiness summary is a live region so the count is announced', async () => {
  // WCAG 4.1.3. Without this the count changes silently: a sighted user sees
  // 30 become 29, a screen-reader user gets nothing.
  const dom = await editorDom(seedAltText(await load()), 'en')
  const summary = dom.window.document.getElementById('readiness-summary')

  assert.equal(summary.getAttribute('role'), 'status')
  assert.equal(summary.getAttribute('aria-live'), 'polite')
  // Only the digit changes between updates; without aria-atomic a screen reader
  // may announce "29" with no indication of what 29 refers to.
  assert.equal(summary.getAttribute('aria-atomic'), 'true')
  dom.window.close()
})

test('the live region survives a re-render of the blocker list', async () => {
  // THE regression this design exists to prevent. A live region created at the
  // same moment its content changes is not announced, so if the summary were
  // rebuilt by replaceChildren along with the list, announcements would break
  // silently — everything would still look correct on screen.
  const capture = seedAltText(await load())
  const dom = await editorDom(capture, 'en')
  const { document } = dom.window

  const before = document.getElementById('readiness-summary')
  const readiness = exportReadiness(capture, capture.languages)

  // Re-render the list the way app.js does, twice.
  for (let i = 0; i < 2; i++) {
    document
      .getElementById('readiness-body')
      .replaceChildren(buildBlockerList(document, readiness, 'en'))
  }

  const after = document.getElementById('readiness-summary')
  assert.equal(before, after, 'the summary element is the same node, never replaced')
  assert.ok(
    !document.getElementById('readiness-body').contains(after),
    'the summary is outside the container that gets rebuilt'
  )
  dom.window.close()
})

test('buildBlockerList returns only the list, so the summary cannot be swept away', async () => {
  // Structural guarantee: the builder cannot return the summary, so no caller
  // can accidentally rebuild it.
  const capture = seedAltText(await load())
  const dom = await editorDom(capture, 'en')
  const list = buildBlockerList(dom.window.document, exportReadiness(capture, ['en']), 'en')

  assert.equal(list.tagName, 'UL')
  assert.equal(list.querySelector('[role="status"]'), null, 'contains no live region')
  dom.window.close()
})

test('the translation panel is axe clean once visible', async () => {
  // It is hidden by default, and hidden content is not in the accessibility
  // tree — so axe would silently skip it unless it is revealed first.
  const dom = await editorDom(seedAltText(await load()), 'en')
  const { document } = dom.window
  document.getElementById('translate').hidden = false

  assertAxeClean(await dom.window.axe.run(document, AXE_OPTIONS), 'translation panel')
  dom.window.close()
})

test('both translation textareas have real labels', async () => {
  const dom = await editorDom(seedAltText(await load()), 'en')
  const { document } = dom.window
  document.getElementById('translate').hidden = false

  const labels = new Map(
    [...document.querySelectorAll('label[for]')].map((l) => [l.getAttribute('for'), l.textContent.trim()])
  )
  for (const id of ['prompt-output', 'translation-input']) {
    assert.ok(labels.get(id), `${id} has a non-empty label`)
  }
  // The prompt box is output, not input — it must say so programmatically.
  assert.equal(document.getElementById('prompt-output').readOnly, true)
  dom.window.close()
})

test('summary text reflects readiness in both languages', async () => {
  const capture = seedAltText(await load())
  const blocked = exportReadiness(capture, ['en'])

  assert.match(readinessSummaryText(blocked, 'en'), /still need attention/)
  assert.match(readinessSummaryText(blocked, 'fr'), /nécessitent votre attention/)

  assert.equal(readinessSummaryText({ ready: true, blockers: [] }, 'en'), 'Ready to export.')
  assert.equal(readinessSummaryText({ ready: true, blockers: [] }, 'fr'), 'Prêt à exporter.')
})

test('editor screenshots are marked decorative — the alt field describes them', async () => {
  // The adjacent alt-text input holds the draft. Repeating it as the image's
  // own alt would read the same string twice in a row.
  const dom = await editorDom(seedAltText(await load()), 'en')
  const images = [...dom.window.document.querySelectorAll('#steps-list img')]

  assert.ok(images.length > 0)
  for (const img of images) {
    assert.equal(img.getAttribute('alt'), '', 'explicitly empty, not missing')
  }
  dom.window.close()
})

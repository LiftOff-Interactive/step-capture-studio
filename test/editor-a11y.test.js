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
import { buildEditableSteps, buildReadiness } from '../src/ui/editor.js'
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
  document
    .getElementById('readiness-body')
    .replaceChildren(
      ...buildReadiness(document, exportReadiness(capture, capture.languages), lang)
    )
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
  const confirms = boxes.filter((b) => b.id.startsWith('f-altok'))

  assert.ok(confirms.length > 0)
  assert.ok(
    confirms.every((b) => !b.checked),
    'a seeded draft must never render as already confirmed'
  )
  dom.window.close()
})

test('the confirm checkbox id is derivable, so it can be synced without a re-render', async () => {
  // Regression test. Editing alt text resets confirmation in the model. If the
  // checkbox is not synced, the UI shows "Alt text is correct" ticked while the
  // model says unconfirmed — claiming a confirmation the author never gave.
  // app.js addresses the box by id rather than re-rendering, which would yank
  // focus out of the field being typed in. That contract is what this locks in.
  const { fieldId } = await import('../src/ui/editor.js')
  const capture = seedAltText(await load())
  const dom = await editorDom(capture, 'en')

  const imageId = capture.steps[0].images[0].id
  const box = dom.window.document.getElementById(fieldId('altok', 1, imageId, 'en'))

  assert.ok(box, 'the confirm checkbox is addressable by derived id')
  assert.equal(box.type, 'checkbox')
  dom.window.close()
})

test('readiness summary states what is blocking export', async () => {
  const dom = await editorDom(seedAltText(await load()), 'en')
  const body = dom.window.document.getElementById('readiness-body')

  assert.match(body.textContent, /still need attention before export/)
  assert.ok(body.querySelectorAll('li').length > 0, 'lists specific blockers')
  dom.window.close()
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

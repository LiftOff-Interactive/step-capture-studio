/**
 * Tests for the HTML walkthrough — the artifact learners actually use.
 *
 * The property under most scrutiny is that ONE document serves two modes. It
 * is easy to build a viewer that works beautifully with scripting and leaves a
 * blank page without it, and that failure is invisible to anyone testing in a
 * normal browser. So the no-JavaScript state is exercised as a first-class
 * state throughout, not treated as a degraded copy.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { JSDOM } from 'jsdom'
import axe from 'axe-core'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, confirmAltText, setStepText, setAltText } from '../src/lib/authoring.js'
import { emitWalkthrough } from '../src/lib/emit-walkthrough.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const AXE_OPTIONS = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
  rules: { 'color-contrast': { enabled: false } },
}
const KNOWN_INCOMPLETE = new Set(['landmark-one-main', 'page-has-heading-one'])

async function authored() {
  let capture = seedAltText(await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS })))
  for (const step of capture.steps) {
    capture = setStepText(capture, step.index, 'fr', `Étape ${step.index} en français`)
    for (const image of step.images) {
      capture = confirmAltText(capture, step.index, image.id, 'en')
      capture = setAltText(capture, step.index, image.id, 'fr', `Capture ${step.index}`)
      capture = confirmAltText(capture, step.index, image.id, 'fr')
    }
  }
  return capture
}

function open(html, { scripts = false, url = 'https://example.invalid/guide.html' } = {}) {
  return new JSDOM(html, {
    runScripts: scripts ? 'dangerously' : 'outside-only',
    pretendToBeVisual: true,
    url,
  })
}

async function axeClean(dom, label) {
  dom.window.eval(axe.source)
  const r = await dom.window.axe.run(dom.window.document, AXE_OPTIONS)
  const d = (rs) => rs.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n  ')
  assert.equal(r.violations.length, 0, `${label} violations:\n  ${d(r.violations)}`)
  const unexpected = r.incomplete.filter((x) => !KNOWN_INCOMPLETE.has(x.id))
  assert.equal(unexpected.length, 0, `${label} needs-review:\n  ${d(unexpected)}`)
}

// ------------------------------------------------------------ no JavaScript ---

test('without scripting, every step is present and readable', async () => {
  const dom = open(emitWalkthrough(await authored()), { scripts: false })
  const { document } = dom.window

  const steps = [...document.querySelectorAll('.step')]
  assert.equal(steps.length, ENGLISH_STEPS.length)
  for (const step of steps) {
    assert.equal(step.hidden, false, 'nothing is hidden without scripting')
  }
  assert.equal(document.documentElement.classList.contains('js'), false)
  assert.match(document.body.textContent, /Click on the web browser/)
  assert.match(document.body.textContent, /Étape 1 en français/)
  dom.window.close()
})

test('without scripting the rail is a working table of contents', async () => {
  // Ordinary fragment anchors to real ids, so jumping works natively.
  const dom = open(emitWalkthrough(await authored()), { scripts: false })
  const { document } = dom.window

  const links = [...document.querySelectorAll('.rail a')]
  assert.equal(links.length, ENGLISH_STEPS.length)
  links.forEach((link, i) => {
    const href = link.getAttribute('href')
    assert.equal(href, `#step-${i + 1}`)
    assert.ok(document.getElementById(href.slice(1)), `${href} resolves to a real element`)
  })
  dom.window.close()
})

test('without scripting the viewer-only controls stay hidden', async () => {
  const dom = open(emitWalkthrough(await authored()), { scripts: false })
  const { document } = dom.window

  assert.equal(document.getElementById('step-prev').hidden, true)
  assert.equal(document.getElementById('step-next').hidden, true)
  assert.equal(document.getElementById('lang-toggle').hidden, true)
  dom.window.close()
})

// --------------------------------------------------------------- enhanced ---

test('with scripting it becomes a one-step-at-a-time viewer', async () => {
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const { document } = dom.window

  assert.ok(document.documentElement.classList.contains('js'))
  const visible = [...document.querySelectorAll('.step')].filter((s) => !s.hidden)
  assert.equal(visible.length, 1, 'exactly one step shown')
  assert.equal(visible[0].id, 'step-1')
  assert.equal(document.getElementById('step-prev').hidden, false)
  dom.window.close()
})

test('progress is stated in text and lives in a region present from parse time', async () => {
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const progress = dom.window.document.getElementById('step-progress')

  assert.equal(progress.getAttribute('role'), 'status')
  assert.equal(progress.getAttribute('aria-live'), 'polite')
  assert.match(progress.textContent, /Step 1 of 10|Step 1 of 5/)
  dom.window.close()
})

test('Next and Previous move through the steps and update progress', async () => {
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const { document, Event } = dom.window
  const next = document.getElementById('step-next')
  const prev = document.getElementById('step-prev')

  assert.equal(prev.disabled, true, 'no previous step at the start')

  next.dispatchEvent(new Event('click', { bubbles: true }))
  assert.equal([...document.querySelectorAll('.step')].filter((s) => !s.hidden)[0].id, 'step-2')
  assert.match(document.getElementById('step-progress').textContent, /2 of/)
  assert.equal(prev.disabled, false)

  prev.dispatchEvent(new Event('click', { bubbles: true }))
  assert.equal([...document.querySelectorAll('.step')].filter((s) => !s.hidden)[0].id, 'step-1')
  dom.window.close()
})

test('the last step disables Next rather than wrapping silently', async () => {
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const { document, Event } = dom.window
  const next = document.getElementById('step-next')

  for (let i = 0; i < ENGLISH_STEPS.length + 3; i++) next.dispatchEvent(new Event('click', { bubbles: true }))

  assert.equal(next.disabled, true)
  assert.equal(
    [...document.querySelectorAll('.step')].filter((s) => !s.hidden)[0].id,
    `step-${ENGLISH_STEPS.length}`
  )
  dom.window.close()
})

test('arrow, Home and End keys navigate', async () => {
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const { document } = dom.window
  const shown = () => [...document.querySelectorAll('.step')].filter((s) => !s.hidden)[0].id
  const key = (k) => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true }))

  key('ArrowRight'); assert.equal(shown(), 'step-2')
  key('ArrowDown'); assert.equal(shown(), 'step-3')
  key('ArrowLeft'); assert.equal(shown(), 'step-2')
  key('End'); assert.equal(shown(), `step-${ENGLISH_STEPS.length}`)
  key('Home'); assert.equal(shown(), 'step-1')
  dom.window.close()
})

test('a modifier key is not hijacked', async () => {
  // Ctrl+Arrow and friends belong to the browser and the screen reader.
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const { document } = dom.window
  document.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true })
  )
  assert.equal([...document.querySelectorAll('.step')].filter((s) => !s.hidden)[0].id, 'step-1')
  dom.window.close()
})

test('focus moves to the step itself, not left behind on the button', async () => {
  // Otherwise a keyboard user advances and hears nothing: the content changed
  // somewhere they are not.
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const { document, Event } = dom.window

  document.getElementById('step-next').dispatchEvent(new Event('click', { bubbles: true }))
  assert.equal(document.activeElement.id, 'step-2')
  assert.equal(document.activeElement.getAttribute('tabindex'), '-1', 'focusable but not tabbable')
  dom.window.close()
})

test('the rail marks the current step semantically, not just visually', async () => {
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const { document, Event } = dom.window

  const currents = () => [...document.querySelectorAll('.rail a[aria-current="step"]')]
  assert.equal(currents().length, 1)
  assert.equal(currents()[0].getAttribute('href'), '#step-1')

  document.getElementById('step-next').dispatchEvent(new Event('click', { bubbles: true }))
  assert.equal(currents().length, 1, 'exactly one current step at all times')
  assert.equal(currents()[0].getAttribute('href'), '#step-2')
  dom.window.close()
})

test('clicking a rail link selects that step', async () => {
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const { document, Event } = dom.window

  document.querySelectorAll('.rail a')[2].dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

  assert.equal([...document.querySelectorAll('.step')].filter((s) => !s.hidden)[0].id, 'step-3')
  assert.equal(document.activeElement.id, 'step-3', 'focus follows')
  dom.window.close()
})

test('navigation survives a context where the URL cannot be updated', async () => {
  // Regression test. history.replaceState throws on an opaque URL (about:srcdoc
  // iframes, some sandboxes). Unguarded, that exception killed the click
  // handler and the rail stopped working entirely. Keeping the fragment in sync
  // is a nicety; navigating is the feature.
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const { document, Event } = dom.window
  dom.window.history.replaceState = () => {
    throw new Error('SecurityError: cannot use history API for this document')
  }

  document.querySelectorAll('.rail a')[3].dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

  assert.equal(
    [...document.querySelectorAll('.step')].filter((s) => !s.hidden)[0].id,
    'step-4',
    'the step still changes'
  )
  dom.window.close()
})

test('a deep link opens on that step', async () => {
  // The same fragment works with scripting off (native anchor) and on.
  const dom = open(emitWalkthrough(await authored()), {
    scripts: true,
    url: 'https://example.invalid/guide.html#step-4',
  })
  const { document } = dom.window

  assert.equal([...document.querySelectorAll('.step')].filter((s) => !s.hidden)[0].id, 'step-4')
  assert.match(document.getElementById('step-progress').textContent, /4 of/)
  dom.window.close()
})

// --------------------------------------------------------------- bilingual ---

test('alt text is carried per language and swapped with the toggle', async () => {
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const { document, Event } = dom.window
  const img = document.querySelector('.step img')

  assert.match(img.getAttribute('alt'), /^Screenshot showing: /, 'starts in the primary language')
  assert.equal(img.getAttribute('data-alt-fr'), 'Capture 1')

  document.getElementById('lang-toggle').dispatchEvent(new Event('click', { bubbles: true }))
  // Synchronously — the toggle dispatches an event rather than relying on a
  // MutationObserver, which fires a microtask later and would leave the alt
  // text briefly describing the wrong language.
  assert.equal(img.getAttribute('alt'), 'Capture 1', 'alt follows the language')
  dom.window.close()
})

test('the progress string is translated when the language changes', async () => {
  const dom = open(emitWalkthrough(await authored()), { scripts: true })
  const { document, Event } = dom.window

  assert.match(document.getElementById('step-progress').textContent, /^Step 1 of/)
  document.getElementById('lang-toggle').dispatchEvent(new Event('click', { bubbles: true }))
  assert.match(document.getElementById('step-progress').textContent, /^Étape 1 sur/)
  dom.window.close()
})

test('every image has alt text and it is never empty for a real screenshot', async () => {
  const dom = open(emitWalkthrough(await authored()))
  for (const img of dom.window.document.querySelectorAll('.step img')) {
    assert.ok(img.getAttribute('alt')?.trim(), 'non-empty alt')
  }
  dom.window.close()
})

test('screenshots are inlined, so the file needs no network', async () => {
  const html = emitWalkthrough(await authored())

  assert.ok(!/<link\b/i.test(html) && !/<script[^>]+src=/i.test(html))
  assert.ok(!/url\((?!['"]?data:)/i.test(html), 'no url() outside data URIs')
  const images = html.match(/src="data:image\/png;base64,/g) ?? []
  assert.equal(images.length, ENGLISH_STEPS.length, 'one inlined screenshot per step')
})

test('screenshots are never lazy-loaded', async () => {
  // Regression test. loading="lazy" gains nothing when the bytes are already
  // inline, and a lazy image that was never scrolled into view can print blank
  // or stay undecoded while its step is hidden — silent failures in the file
  // a learner actually receives.
  const html = emitWalkthrough(await authored())
  assert.ok(!/loading="lazy"/.test(html), 'no lazy loading in a self-contained artifact')
})

// ----------------------------------------------------------- accessibility ---

test('axe clean with scripting', async () => {
  await axeClean(open(emitWalkthrough(await authored()), { scripts: true }), 'walkthrough')
})

test('axe clean without scripting', async () => {
  await axeClean(open(emitWalkthrough(await authored()), { scripts: false }), 'walkthrough (no JS)')
})

test('heading structure is sound in both modes', async () => {
  for (const scripts of [false, true]) {
    const dom = open(emitWalkthrough(await authored()), { scripts })
    const levels = [...dom.window.document.querySelectorAll('h1,h2,h3,h4')].map((h) => +h.tagName[1])
    assert.equal(levels.filter((l) => l === 1).length, 1, `one h1 (scripts=${scripts})`)
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i] - levels[i - 1] <= 1, `no skipped level (scripts=${scripts})`)
    }
    dom.window.close()
  }
})

test('a step stacks its screenshot above its instruction, with nothing in between', async () => {
  // The layout Mike wants, pinned so it cannot drift back. The viewer is TWO
  // columns — the step rail, then the picture and its sentence together on the
  // right. For a while each step was itself split into picture beside sentence,
  // making three columns; that read as two unrelated panels rather than one
  // step, and narrowed both. Reverted 2026-08-05.
  const html = emitWalkthrough(await authored(), { languages: ['en', 'fr'] })
  const { document } = new JSDOM(html).window

  for (const step of document.querySelectorAll('.step')) {
    const kids = [...step.children].map((el) => el.tagName.toLowerCase())
    assert.deepEqual(
      kids,
      ['h3', 'figure', 'div'],
      `${step.id} should be heading, screenshot, instruction — flat and in that order`
    )
    assert.ok(
      step.querySelector(':scope > figure'),
      `${step.id} keeps its figure as a direct child, not inside a layout wrapper`
    )
  }
})

test('the viewer is two columns, and a step is not subdivided into more', async () => {
  const html = emitWalkthrough(await authored(), { languages: ['en'] })

  // The rail plus one content column. That is the whole grid.
  assert.match(html, /\.viewer \{[^}]*display:\s*grid/, 'the viewer is the grid')
  assert.match(html, /grid-template-columns:\s*17rem minmax\(0, 1fr\)/, 'rail plus content')

  // Nothing may re-split a step. A container query is how it happened before.
  assert.doesNotMatch(html, /@container/, 'no container query subdividing a step')
  assert.doesNotMatch(html, /\.step \{[^}]*display:\s*grid/, '.step is not itself a grid')
  assert.doesNotMatch(html, /step__media/, 'the wrapper that fed that grid is gone')
})

test('a tall screenshot cannot push its own instruction off the screen', async () => {
  // This is the defect the side-by-side split was introduced to fix, and it is
  // still real: at full width a tall picture used to put ~500px between itself
  // and the sentence describing it, so inside the all-in-one panel a step
  // measured 644px in a 596px frame. Capping the image is what solves it now,
  // which makes max-height load-bearing rather than decorative.
  const html = emitWalkthrough(await authored(), { languages: ['en'] })
  assert.match(html, /\.step img \{[^}]*max-height:\s*70vh/, 'the screenshot is capped')

  const print = html.slice(html.indexOf('@media print'))
  assert.match(print, /\.step \{[^}]*display:\s*block/, 'print stacks deterministically')
})

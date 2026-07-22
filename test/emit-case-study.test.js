/**
 * Tests for the case-study artifact.
 *
 * The load-bearing test in this file is the one asserting the emitter REFUSES
 * to render unreviewed drafted text. Everything else is ordinary artifact
 * hygiene; that one is the reason the feature exists.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { JSDOM } from 'jsdom'
import axe from 'axe-core'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, confirmAltText, setStepText, setAltText } from '../src/lib/authoring.js'
import {
  setNarrative,
  setScenario,
  confirmNarrative,
  applyCaseStudyResponse,
} from '../src/lib/case-study.js'
import { emitCaseStudy } from '../src/lib/emit-case-study.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const AXE_OPTIONS = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
  rules: { 'color-contrast': { enabled: false } },
}
const KNOWN_INCOMPLETE = new Set(['landmark-one-main', 'page-has-heading-one'])

/** Alt text and both languages complete, so only narrative is under test. */
async function base() {
  let c = seedAltText(await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS })))
  for (const step of c.steps) {
    c = setStepText(c, step.index, 'fr', `Étape ${step.index} en français`)
    for (const img of step.images) {
      c = confirmAltText(c, step.index, img.id, 'en')
      c = setAltText(c, step.index, img.id, 'fr', `Capture ${step.index}`)
      c = confirmAltText(c, step.index, img.id, 'fr')
    }
  }
  c = setScenario(c, 'audience', 'en', 'New staff in their first week')
  c = setScenario(c, 'context', 'en', 'Opening the course handbook')
  return c
}

/** A capture whose narrative is entirely author-written. */
async function authored() {
  let c = await base()
  for (const step of c.steps) {
    c = setNarrative(c, step.index, 'why', 'en', `Step ${step.index} matters because of X`)
    c = setNarrative(c, step.index, 'ifSkipped', 'en', `Skipping step ${step.index} breaks Y`)
  }
  return c
}

const open = (html, { scripts = false } = {}) =>
  new JSDOM(html, { runScripts: scripts ? 'dangerously' : 'outside-only', pretendToBeVisual: true })

async function axeClean(dom, label) {
  dom.window.eval(axe.source)
  const r = await dom.window.axe.run(dom.window.document, AXE_OPTIONS)
  const d = (rs) => rs.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n  ')
  assert.equal(r.violations.length, 0, `${label} violations:\n  ${d(r.violations)}`)
  const unexpected = r.incomplete.filter((x) => !KNOWN_INCOMPLETE.has(x.id))
  assert.equal(unexpected.length, 0, `${label} needs-review:\n  ${d(unexpected)}`)
}

// ------------------------------------------------------------- the refusal ---

test('it REFUSES to render unreviewed drafted narrative', async () => {
  // The reason this feature exists. An artifact that quietly launders a model's
  // guess into apparent authority is the specific failure being designed out,
  // so the emitter is a second lock behind the UI gate.
  const { capture } = applyCaseStudyResponse(await authored(), 's1w ||| A model wrote this', 'en')

  assert.throws(
    () => emitCaseStudy(capture, { languages: ['en'] }),
    /refusing to emit unreviewed drafted narrative/
  )
})

test('the refusal names exactly what is unreviewed', async () => {
  const { capture } = applyCaseStudyResponse(await authored(), 's3b ||| Drafted', 'en')

  assert.throws(
    () => emitCaseStudy(capture, { languages: ['en'] }),
    /step 3 ifSkipped \(en\)/
  )
})

test('once reviewed, the same text renders', async () => {
  // Confirming changes nothing about the words — only who stands behind them.
  const { capture } = applyCaseStudyResponse(await authored(), 's1w ||| A model wrote this', 'en')
  const confirmed = confirmNarrative(capture, 1, 'why', 'en')

  const html = emitCaseStudy(confirmed, { languages: ['en'] })
  assert.match(html, /A model wrote this/)
})

test('it refuses to emit a case study with no explanations at all', async () => {
  const empty = await base()
  assert.throws(() => emitCaseStudy(empty, { languages: ['en'] }), /no explanations/)
})

// ---------------------------------------------------------------- content ---

test('the scenario the author supplied appears', async () => {
  const dom = open(emitCaseStudy(await authored(), { languages: ['en'] }))
  const text = dom.window.document.querySelector('.scenario').textContent

  assert.match(text, /New staff in their first week/)
  assert.match(text, /Opening the course handbook/)
  dom.window.close()
})

test('an empty scenario field is omitted rather than shown blank', async () => {
  // "outcome" was never filled in.
  const dom = open(emitCaseStudy(await authored(), { languages: ['en'] }))
  const text = dom.window.document.querySelector('.scenario').textContent

  assert.ok(!/What success looks like/.test(text), 'no empty row')
  dom.window.close()
})

test('every step carries its screenshot, action and both notes', async () => {
  const dom = open(emitCaseStudy(await authored(), { languages: ['en'] }))
  const { document } = dom.window

  const steps = [...document.querySelectorAll('.case-step')]
  assert.equal(steps.length, ENGLISH_STEPS.length)
  for (const [i, step] of steps.entries()) {
    assert.ok(step.querySelector('img'), `step ${i + 1} has a screenshot`)
    assert.match(step.querySelector('.case-action').textContent, /\S/)
    assert.equal(step.querySelectorAll('.case-note').length, 2, 'why and ifSkipped')
  }
  dom.window.close()
})

test('a step with no explanation simply has no note', async () => {
  let c = await base()
  c = setNarrative(c, 1, 'why', 'en', 'Only step one is explained')
  const dom = open(emitCaseStudy(c, { languages: ['en'] }))
  const steps = [...dom.window.document.querySelectorAll('.case-step')]

  assert.equal(steps[0].querySelectorAll('.case-note').length, 1)
  assert.equal(steps[1].querySelectorAll('.case-note').length, 0, 'absent, not blank')
  dom.window.close()
})

test('narrative is escaped, not injected', async () => {
  let c = await base()
  c = setNarrative(c, 1, 'why', 'en', 'Because <script>alert(1)</script> matters & so on')
  const html = emitCaseStudy(c, { languages: ['en'] })

  assert.ok(!/<script>alert\(1\)<\/script>/.test(html))
  assert.match(html, /&lt;script&gt;/)
})

// ------------------------------------------------------------- artifact ---

test('self-contained: no external request of any kind', async () => {
  const html = emitCaseStudy(await authored(), { languages: ['en'] })

  assert.ok(!/<link\b/i.test(html) && !/<script[^>]+src=/i.test(html))
  assert.ok(!/url\((?!['"]?data:)/i.test(html), 'no url() outside data URIs')
  assert.ok(!/loading="lazy"/.test(html), 'inlined images are never lazy-loaded')
  assert.equal((html.match(/src="data:image\/png;base64,/g) ?? []).length, ENGLISH_STEPS.length)
})

test('axe clean, with and without scripting', async () => {
  const html = emitCaseStudy(await authored())
  await axeClean(open(html, { scripts: true }), 'case study')
  await axeClean(open(html, { scripts: false }), 'case study (no JS)')
})

test('heading structure is sound', async () => {
  const dom = open(emitCaseStudy(await authored()))
  const levels = [...dom.window.document.querySelectorAll('h1,h2,h3,h4')].map((h) => +h.tagName[1])

  assert.equal(levels.filter((l) => l === 1).length, 1)
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] - levels[i - 1] <= 1, `no skip at ${levels[i - 1]} -> ${levels[i]}`)
  }
  dom.window.close()
})

test('without scripting both languages are readable', async () => {
  let c = await authored()
  c = setNarrative(c, 1, 'why', 'fr', 'Parce que cela débloque le quart de travail')
  const dom = open(emitCaseStudy(c), { scripts: false })

  const text = dom.window.document.body.textContent
  assert.match(text, /Step 1 matters because of X/)
  assert.match(text, /Parce que cela débloque le quart de travail/)
  dom.window.close()
})

test('French narrative declares its own language', async () => {
  let c = await authored()
  c = setNarrative(c, 1, 'why', 'fr', 'Texte français')
  const dom = open(emitCaseStudy(c))

  const fr = [...dom.window.document.querySelectorAll('[data-lang-block="fr"]')]
  assert.ok(fr.length > 0)
  for (const el of fr) assert.equal(el.getAttribute('lang'), 'fr-CA')
  dom.window.close()
})

/**
 * Regression: chrome was rendered once against `languages[0]`.
 *
 * Step text was correctly per-language, so the document looked bilingual while
 * every heading, label and section title stayed English no matter what the
 * toggle said. The translations existed the whole time — they were being asked
 * for in the wrong language.
 */
test('headings and labels are translated, not just step text', async () => {
  const dom = open(emitCaseStudy(await authored()))
  const { document } = dom.window

  const inFrench = (text) =>
    [...document.querySelectorAll('[data-lang-block="fr"]')].some((el) =>
      el.textContent.includes(text)
    )

  assert.ok(inFrench('Étude de cas'), 'the case-study heading needs a French block')
  assert.ok(inFrench('À propos de cette procédure'), 'the scenario heading needs a French block')

  // Chrome must be symmetric. Content deliberately is not — an unwritten
  // French explanation is omitted rather than shown blank — so this checks the
  // headings only, which is exactly where the bug lived.
  for (const heading of document.querySelectorAll('h2, h3')) {
    const en = heading.querySelectorAll('[data-lang-block="en"]').length
    const fr = heading.querySelectorAll('[data-lang-block="fr"]').length
    assert.equal(en, fr, `heading "${heading.textContent.trim()}" is not bilingual`)
  }
  dom.window.close()
})

/**
 * Regression: alt text was pinned to `languages[0]`.
 *
 * In French the visible text switched and every image went on describing
 * itself in English — a WCAG 1.1.1 failure invisible to a print check and to
 * axe, which cannot judge whether alt text is in the right language.
 */
test('alt text follows the language, it is not pinned to the primary', async () => {
  const dom = open(emitCaseStudy(await authored()))
  const images = [...dom.window.document.querySelectorAll('.case-step img')]

  assert.ok(images.length > 0, 'the fixture needs at least one image')
  for (const img of images) {
    const en = img.getAttribute('data-alt-en')
    const fr = img.getAttribute('data-alt-fr')
    assert.ok(en, 'English alt text must travel with the image')
    assert.ok(fr, 'French alt text must travel with the image')
    assert.equal(img.getAttribute('alt'), en, 'the default alt matches the primary language')
  }
  dom.window.close()
})

test('the document title carries the artifact name, so print files correctly', async () => {
  const c = await authored()
  c.title = 'Testing Windows Audio'
  const dom = open(emitCaseStudy(c))

  assert.equal(dom.window.document.title, 'TestingWindowsAudio_CaseStudy')
  // The visible heading stays prose — only <title> carries the file name.
  assert.equal(dom.window.document.querySelector('h1').textContent, 'Testing Windows Audio')
  dom.window.close()
})

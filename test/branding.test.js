/**
 * Tests for branding.
 *
 * The load-bearing ones: that the default is genuinely a no-op (a capture made
 * before branding existed must render as it always did), that a failing colour
 * blocks export the way missing alt text does, and that the reader's own text
 * size preference is not overridden.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { JSDOM } from 'jsdom'

import {
  FONT_KEYS,
  ICON_SLOTS,
  brandingCss,
  brandingIcon,
  brandingLogo,
  brandingOf,
  brandingReadiness,
  contrastRatio,
  darkHighlight,
  defaultBranding,
  isHexColour,
  setBranding,
  bestOn,
} from '../src/lib/branding.js'
import { exportReadiness, seedAltText, confirmAltText, setStepText, setAltText } from '../src/lib/authoring.js'
import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { emitProject } from '../src/lib/emit-project.js'
import { parseProject } from '../src/lib/parse-project.js'
import { emitAllInOne } from '../src/lib/emit-all-in-one.js'
import { setIncludeWorkedExample } from '../src/lib/case-study.js'
import { makeCapture, makePng, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const dom = new JSDOM('')
const parse = (html) => parseProject(html, dom.window.DOMParser)
const open = (html) => new JSDOM(html).window.document

async function exportReady() {
  let c = seedAltText(await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS })))
  for (const step of c.steps) {
    c = setStepText(c, step.index, 'fr', `Étape ${step.index}`)
    for (const img of step.images) {
      c = confirmAltText(c, step.index, img.id, 'en')
      c = setAltText(c, step.index, img.id, 'fr', `Capture ${step.index}`)
      c = confirmAltText(c, step.index, img.id, 'fr')
    }
  }
  return c
}

// ----------------------------------------------------------------- model ---

test('a capture with no branding gets the defaults', () => {
  assert.deepEqual(brandingOf({}), defaultBranding())
  assert.deepEqual(brandingOf(undefined), defaultBranding())
})

test('the default is a no-op: no gradient, no images, the accent already shipped', () => {
  // A capture made before this existed must render exactly as it always did.
  // Defaulting to a house style would restyle everyone's work on next export.
  const b = defaultBranding()
  assert.equal(b.gradientFrom, null)
  assert.equal(b.gradientTo, null)
  assert.equal(b.highlight, '#0b5cab', 'the accent BASE_CSS already used')
  assert.equal(b.logo, null)
  assert.equal(b.background, null)
  assert.deepEqual(Object.values(b.icons), ICON_SLOTS.map(() => null))

  const css = brandingCss({})
  assert.doesNotMatch(css, /linear-gradient\(135deg/, 'no header gradient by default')
  assert.doesNotMatch(css, /background-image/, 'no background image by default')
})

test('setBranding is a patch and never mutates its input', () => {
  const before = { branding: defaultBranding() }
  const snapshot = JSON.stringify(before)
  const after = setBranding(before, { highlight: '#123456' })

  assert.equal(after.branding.highlight, '#123456')
  assert.equal(after.branding.fontBody, 'system', 'untouched fields survive')
  assert.equal(JSON.stringify(before), snapshot)
})

test('icons patch per slot rather than replacing the whole map', () => {
  const one = setBranding({}, { icons: { walkthrough: new Uint8Array([1]) } })
  const two = setBranding(one, { icons: { quickReference: new Uint8Array([2]) } })
  assert.ok(two.branding.icons.walkthrough, 'the first slot is still set')
  assert.ok(two.branding.icons.quickReference)
})

// -------------------------------------------------------------- contrast ---

test('contrast ratios match the WCAG reference values', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21)
  assert.equal(Math.round(contrastRatio('#ffffff', '#ffffff')), 1)
  assert.equal(contrastRatio('not a colour', '#ffffff'), null)
})

test('the text colour on a brand colour is derived, never asked for', () => {
  assert.equal(bestOn('#000000'), '#ffffff')
  assert.equal(bestOn('#ffffff'), '#111418')
  // Whatever it picks must actually pass on the colour it picked it for.
  for (const colour of ['#0f5f7a', '#c8102e', '#ffd700', '#4b0082']) {
    assert.ok(contrastRatio(colour, bestOn(colour)) >= 4.5, `${colour} gets a readable on-colour`)
  }
})

test('the dark-scheme highlight is derived and always clears AA', () => {
  // One brand colour cannot serve a white page and a near-black one. Asking for
  // a second would contradict "a single highlight colour", so it is derived.
  for (const colour of ['#0b5cab', '#c8102e', '#004b23', '#000000']) {
    const derived = darkHighlight(colour)
    assert.ok(contrastRatio(derived, '#14171a') >= 4.5, `${colour} works on the dark page`)
    assert.ok(contrastRatio(derived, '#1e2226') >= 4.5, `${colour} works on the dark surface`)
  }
})

test('a light-scheme contrast failure blocks export, with the measured ratio', async () => {
  const capture = setBranding(await exportReady(), { highlight: '#f2c1c1' })
  const { ready, blockers } = exportReadiness(capture, capture.languages)

  assert.equal(ready, false)
  const hit = blockers.find((b) => b.code === 'BRANDING_HIGHLIGHT_CONTRAST')
  assert.ok(hit, 'it reaches the same gate as alt text')
  assert.ok(hit.ratio < 4.5 && hit.ratio > 1, `reports the ratio (${hit.ratio}), not just a failure`)
})

test('a readable highlight does not block', async () => {
  const capture = setBranding(await exportReady(), { highlight: '#7a0019' })
  assert.equal(exportReadiness(capture, capture.languages).ready, true)
})

test('half a gradient is refused, and named', () => {
  const { ready, blockers } = brandingReadiness(setBranding({}, { gradientFrom: '#0f5f7a' }))
  assert.equal(ready, false)
  assert.equal(blockers[0].code, 'COLOUR_INVALID')
  assert.equal(blockers[0].field, 'gradientTo')
})

test('a gradient whose two ends need opposite text colours is caught', () => {
  // The header takes one text colour, derived from the first stop. Running from
  // near-black to near-white leaves no correct answer, and this is where it
  // surfaces rather than in an unreadable artifact.
  const { ready, blockers } = brandingReadiness(
    setBranding({}, { gradientFrom: '#101010', gradientTo: '#fafafa' })
  )
  assert.equal(ready, false)
  assert.ok(blockers.some((b) => b.code === 'GRADIENT_CONTRAST' && b.field === 'gradientTo'))
})

test('isHexColour accepts only full six-digit hex', () => {
  assert.equal(isHexColour('#0b5cab'), true)
  assert.equal(isHexColour('#FFF'), false)
  assert.equal(isHexColour('rgb(1,2,3)'), false)
  assert.equal(isHexColour(null), false)
})

// ------------------------------------------------------------------- css ---

test('the reader’s own text size preference is scaled, not overridden', () => {
  // An absolute px on <html> silently discards a larger default set by someone
  // who needs it. A percentage scales whatever they chose.
  const css = brandingCss(setBranding({}, { baseSize: 20 }))
  assert.match(css, /html \{ font-size: 125\.0%; \}/)
  assert.doesNotMatch(css, /html \{ font-size: \d+px/)
})

test('sizes outside the usable range are clamped, not obeyed', () => {
  assert.match(brandingCss(setBranding({}, { baseSize: 400 })), /font-size: 137\.5%/)
  assert.match(brandingCss(setBranding({}, { baseSize: 2 })), /font-size: 87\.5%/)
  assert.match(brandingCss(setBranding({}, { baseSize: 'huge' })), /font-size: 100\.0%/)
})

test('every font choice resolves to a stack ending in a generic family', () => {
  for (const key of FONT_KEYS) {
    const css = brandingCss(setBranding({}, { fontBody: key }))
    assert.match(css, /--font-body: .*(sans-serif|serif|monospace);/, `${key} ends generically`)
  }
  // An unknown key falls back rather than emitting nothing.
  assert.match(brandingCss(setBranding({}, { fontBody: 'nope' })), /--font-body: system-ui/)
})

test('a gradient renders as a gradient, with a derived text colour', () => {
  const css = brandingCss(setBranding({}, { gradientFrom: '#0f5f7a', gradientTo: '#12839c' }))
  assert.match(css, /linear-gradient\(135deg, #0f5f7a, #12839c\)/)
  assert.match(css, /color: #ffffff/, 'white on a dark teal')
})

test('a background image is inlined and scrimmed', () => {
  const css = brandingCss(setBranding({}, { background: makePng(4, 4) }))
  assert.match(css, /background-image: linear-gradient\(var\(--scrim\), var\(--scrim\)\), url\("data:image\/png/)
  assert.match(css, /background-attachment: fixed/)
})

// -------------------------------------------------------------- artifacts ---

test('the logo is inlined, and empty alt means decorative', () => {
  const capture = setBranding({}, { logo: makePng(8, 8) })
  assert.match(brandingLogo(capture, 'en').src, /^data:image\/png;base64,/)
  assert.equal(brandingLogo(capture, 'en').alt, '', 'no alt supplied means decorative')

  const described = setBranding(capture, { logoAlt: { en: 'Acme', fr: 'Acme' } })
  assert.equal(brandingLogo(described, 'fr').alt, 'Acme')
  assert.equal(brandingLogo({}, 'en'), null, 'no logo, no element')
})

test('an uploaded card icon reaches the dashboard, and stays decorative', async () => {
  // The card's own title names it directly underneath, so alt text on the icon
  // would make a screen reader announce the card twice.
  let capture = setIncludeWorkedExample(await exportReady(), false)
  capture = setBranding(capture, { icons: { walkthrough: makePng(16, 16) } })

  assert.match(brandingIcon(capture, 'walkthrough'), /^data:image\/png/)
  assert.equal(brandingIcon(capture, 'quickReference'), null)

  const doc = open(await emitAllInOne(capture, { languages: ['en'] }))
  const custom = doc.querySelectorAll('img.aio-card__icon--custom')
  assert.equal(custom.length, 1, 'one card carries artwork')
  assert.equal(custom[0].getAttribute('alt'), '', 'and it is decorative')
  assert.equal(doc.querySelectorAll('span.aio-card__icon').length, 2, 'the rest keep the tile')
})

// ------------------------------------------------------------ round trip ---

test('branding survives the project-file round trip', async () => {
  const logo = makePng(6, 6, [200, 10, 10])
  const icon = makePng(5, 5, [10, 200, 10])
  let capture = await exportReady()
  capture = setBranding(capture, {
    fontBody: 'serif',
    fontHeading: 'slab',
    baseSize: 18,
    headingScale: 1.4,
    gradientFrom: '#0f5f7a',
    gradientTo: '#12839c',
    highlight: '#7a0019',
    logo,
    logoAlt: { en: 'Acme', fr: 'Acme' },
    background: makePng(4, 4),
    icons: { workedExample: icon },
  })

  const back = parse(emitProject(capture))
  const b = back.branding

  assert.equal(b.fontBody, 'serif')
  assert.equal(b.fontHeading, 'slab')
  assert.equal(b.baseSize, 18)
  assert.equal(b.headingScale, 1.4)
  assert.equal(b.gradientFrom, '#0f5f7a')
  assert.equal(b.gradientTo, '#12839c')
  assert.equal(b.highlight, '#7a0019')
  assert.deepEqual([...b.logo], [...logo], 'the logo bytes come back identical')
  assert.equal(b.logoAlt.en, 'Acme')
  assert.ok(b.background, 'and the background')
  assert.deepEqual([...b.icons.workedExample], [...icon])
  assert.equal(b.icons.walkthrough, null, 'empty slots stay empty')
})

test('a project file written before branding existed loads with the defaults', async () => {
  const html = emitProject(await exportReady()).replace(/<section class="branding"[\s\S]*?<\/section>/, '')
  assert.deepEqual(parse(html).branding, defaultBranding())
})

test('a hand-edited colour that is not hex is dropped, not carried into the gate', async () => {
  // It would otherwise surface as an export blocker on a file the author only
  // nudged, with nothing on screen explaining where it came from.
  const html = emitProject(await exportReady()).replace(
    /data-highlight="[^"]*"/,
    'data-highlight="cornflowerblue"'
  )
  assert.equal(parse(html).branding.highlight, defaultBranding().highlight)
})

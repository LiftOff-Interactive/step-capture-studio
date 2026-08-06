/**
 * The tokens are the single definition of the palette. These tests exist to
 * keep it that way.
 *
 * The palette used to live in three places at once — `--brand` and `--aio-brand`
 * were the same teal under two names, `--text-muted` and `--muted` the same
 * grey. Nothing caught it, because every individual file was self-consistent
 * and every assertion passed. A branded dashboard shipped with unbranded cards.
 *
 * So the assertion here is structural rather than visual: no colour may be
 * written down anywhere except tokens.css.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { setTokens, tokensCss, tokensReady } from '../src/lib/tokens.js'
import { emitWalkthrough } from '../src/lib/emit-walkthrough.js'
import { emitQuickSteps } from '../src/lib/emit-quick-steps.js'
import { emitCaseStudy } from '../src/lib/emit-case-study.js'
import { emitAllInOne } from '../src/lib/emit-all-in-one.js'
import { emitProject } from '../src/lib/emit-project.js'
import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import { seedAltText, confirmAltText } from '../src/lib/authoring.js'
import { setNarrative } from '../src/lib/case-study.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')

const TOKENS = read('src/ui/tokens.css')

/**
 * Files that consume the tokens and must never declare a colour themselves.
 * branding.js is absent on purpose: it is the derivation logic, so naming
 * colours is its job.
 */
const CONSUMERS = [
  'src/ui/styles.css',
  'src/lib/emit-common.js',
  'src/lib/emit-all-in-one.js',
  'src/lib/emit-project.js',
]

const hexes = (css) => (css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toLowerCase())

test('every colour in the project is declared in tokens.css and nowhere else', () => {
  for (const file of CONSUMERS) {
    const found = [...new Set(hexes(read(file)))]
    assert.deepEqual(
      found,
      [],
      `${file} writes a colour literal (${found.join(', ')}). Add it to tokens.css and use var().`,
    )
  }
})

test('tokens.css defines both schemes, and dark overrides every colour it should', () => {
  // Match the blocks themselves rather than splitting on ':root' — the file's
  // own comment says "nothing but :root belongs here", and splitting on that
  // string sliced the prose off as if it were the light block, which made this
  // assertion vacuous. Mutation testing is the only reason that was noticed.
  const blocks = [...TOKENS.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1])
  assert.equal(blocks.length, 2, 'expected exactly a light and a dark :root block')
  const [light, dark] = blocks
  // Sizes are scheme-independent; colours are not. Anything with a hex in the
  // light block that dark leaves alone is a colour that will not adapt.
  const named = (block) =>
    new Set([...block.matchAll(/(--[a-z-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => m[1]))
  const unadapted = [...named(light)].filter((n) => !named(dark).has(n))
  assert.deepEqual(
    unadapted,
    [],
    `these colours have no dark-scheme value: ${unadapted.join(', ')}`,
  )
})

test('every emitted artifact inlines the real tokens', async () => {
  // English only, alt text confirmed: enough to clear the export gate, which is
  // what these emitters check before they will produce anything at all.
  let capture = seedAltText(await parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS })))
  for (const step of capture.steps) {
    for (const image of step.images) {
      capture = confirmAltText(capture, step.index, image.id, 'en')
    }
    capture = setNarrative(capture, step.index, 'why', 'en', `Step ${step.index} matters`)
  }
  const only = { languages: ['en'] }
  const artifacts = {
    walkthrough: emitWalkthrough(capture, only),
    quickSteps: emitQuickSteps(capture, only),
    caseStudy: emitCaseStudy(capture, only),
    allInOne: await emitAllInOne(capture, only),
    project: emitProject(capture),
  }
  for (const [name, html] of Object.entries(artifacts)) {
    assert.ok(html.includes('--brand: #155f82'), `${name} is missing the token block`)
    assert.ok(
      html.includes(tokensCss()),
      `${name} inlines something other than the tokens.css that ships`,
    )
  }
})

test('tokensCss refuses to guess when nothing was loaded', () => {
  assert.ok(tokensReady(), 'the preload should have loaded tokens')
  assert.throws(() => setTokens('not a stylesheet'), /:root/)
  assert.throws(() => setTokens(null), /tokens\.css/)
  // Still intact after the rejected attempts — a bad call must not clear them.
  assert.ok(tokensCss().includes(':root'))
})

/**
 * Tests for the case study's narrative layer.
 *
 * One invariant dominates: **a passage a model wrote must never be
 * indistinguishable from one a human stood behind.** Most of what follows
 * exists to prove that distinction cannot be lost by accident, and that the
 * export gate cannot be satisfied by anything other than a real review.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { parseSnagitDocx } from '../src/lib/parse-snagit.js'
import {
  setNarrative,
  confirmNarrative,
  setScenario,
  caseStudyReadiness,
  hasNarrative,
  buildCaseStudyPrompt,
  applyCaseStudyResponse,
  NARRATIVE_FIELDS,
  SCENARIO_FIELDS,
} from '../src/lib/case-study.js'
import { makeCapture, ENGLISH_STEPS } from './helpers/synthetic.mjs'

const load = () => parseSnagitDocx(makeCapture({ steps: ENGLISH_STEPS }))

/** A capture with the author's grounding filled in. */
async function grounded() {
  let c = await load()
  c = setScenario(c, 'audience', 'en', 'New staff in their first week')
  c = setScenario(c, 'context', 'en', 'Opening the course handbook before a shift')
  c = setScenario(c, 'outcome', 'en', 'The handbook is open and readable')
  return c
}

// ------------------------------------------------------------- the shape ---

test('the parser gives every step an empty, unmarked narrative', async () => {
  const capture = await load()
  for (const step of capture.steps) {
    for (const field of NARRATIVE_FIELDS) {
      assert.deepEqual(step.narrative[field].en, { text: null, drafted: false })
    }
  }
})

test('scenario fields exist and start empty', async () => {
  const capture = await load()
  for (const field of SCENARIO_FIELDS) {
    assert.equal(capture.scenario[field].en, null)
  }
})

// ---------------------------------------------------------- authored text ---

test('text a person types is authored, never drafted', async () => {
  const capture = setNarrative(await load(), 1, 'why', 'en', 'Because the shift cannot start without it')

  assert.equal(capture.steps[0].narrative.why.en.text, 'Because the shift cannot start without it')
  assert.equal(capture.steps[0].narrative.why.en.drafted, false, 'a human wrote it')
})

test('authored text never blocks export', async () => {
  const capture = setNarrative(await load(), 1, 'why', 'en', 'Authored explanation')
  assert.deepEqual(caseStudyReadiness(capture, ['en']), { ready: true, blockers: [] })
})

test('an empty narrative is allowed — claiming nothing is not a defect', async () => {
  // The gate distinguishes "no claim" from "unverified claim". Only the second
  // is a problem; requiring every field would push authors to fill them with
  // whatever the model said.
  const capture = await load()
  assert.equal(caseStudyReadiness(capture, ['en']).ready, true)
  assert.equal(hasNarrative(capture, ['en']), false)
})

test('operations do not mutate the capture they are given', async () => {
  const capture = await load()
  const before = JSON.stringify(capture, (k, v) => (k === 'bytes' ? undefined : v))

  setNarrative(capture, 1, 'why', 'en', 'x')
  setScenario(capture, 'audience', 'en', 'y')

  assert.equal(JSON.stringify(capture, (k, v) => (k === 'bytes' ? undefined : v)), before)
})

test('unknown fields are rejected rather than silently stored', async () => {
  const capture = await load()
  assert.throws(() => setNarrative(capture, 1, 'nonsense', 'en', 'x'), RangeError)
  assert.throws(() => setScenario(capture, 'nonsense', 'en', 'x'), RangeError)
})

// ------------------------------------------------------------ the prompt ---

test('the prompt carries the author grounding and the whole step sequence', async () => {
  const prompt = buildCaseStudyPrompt(await grounded(), 'en')

  assert.match(prompt, /New staff in their first week/)
  assert.match(prompt, /Opening the course handbook before a shift/)
  for (const text of ENGLISH_STEPS) assert.ok(prompt.includes(text), `sequence includes "${text}"`)
})

test('the prompt forbids invention and offers a way to decline', async () => {
  // The whole reason a human supplies the scenario is so the model does not
  // have to guess. Saying so explicitly is cheap insurance.
  const prompt = buildCaseStudyPrompt(await grounded(), 'en')

  assert.match(prompt, /do not invent it/i)
  assert.match(prompt, /Do not invent policy names, system names/i)
  assert.match(prompt, /better to write a cautious, general sentence/i)
  assert.match(prompt, /NEEDS AUTHOR/)
})

test('the prompt asks only for fields that are still empty', async () => {
  let capture = await grounded()
  capture = setNarrative(capture, 1, 'why', 'en', 'Already written by the author')
  const prompt = buildCaseStudyPrompt(capture, 'en')

  assert.ok(!/^s1w \|\|\|/m.test(prompt), 'an authored passage is not sent out to be rewritten')
  assert.match(prompt, /^s1b \|\|\|/m, 'the empty one still is')
})

test('a fully written case study refuses to build a prompt', async () => {
  let capture = await grounded()
  for (const step of capture.steps) {
    for (const field of NARRATIVE_FIELDS) capture = setNarrative(capture, step.index, field, 'en', 'Written')
  }
  assert.throws(() => buildCaseStudyPrompt(capture, 'en'), (e) => e.code === 'NOTHING_TO_DRAFT')
})

// ------------------------------------------------- applying a draft back ---

test('everything the model returns is marked drafted', async () => {
  const capture = await grounded()
  const { capture: next, applied } = applyCaseStudyResponse(
    capture,
    's1w ||| It unlocks the shift\ns1b ||| The shift cannot start',
    'en'
  )

  assert.equal(applied, 2)
  assert.equal(next.steps[0].narrative.why.en.text, 'It unlocks the shift')
  assert.equal(next.steps[0].narrative.why.en.drafted, true, 'a model wrote it')
  assert.equal(next.steps[0].narrative.ifSkipped.en.drafted, true)
})

test('drafted text blocks export until reviewed', async () => {
  const capture = await grounded()
  const { capture: drafted } = applyCaseStudyResponse(capture, 's1w ||| Drafted text', 'en')
  const { ready, blockers } = caseStudyReadiness(drafted, ['en'])

  assert.equal(ready, false)
  assert.equal(blockers.length, 1)
  assert.deepEqual(
    { code: blockers[0].code, stepIndex: blockers[0].stepIndex, field: blockers[0].field },
    { code: 'NARRATIVE_UNREVIEWED', stepIndex: 1, field: 'why' }
  )
})

test('confirming is the only thing that clears the mark', async () => {
  const capture = await grounded()
  const { capture: drafted } = applyCaseStudyResponse(capture, 's1w ||| Drafted text', 'en')
  assert.equal(caseStudyReadiness(drafted, ['en']).ready, false)

  const confirmed = confirmNarrative(drafted, 1, 'why', 'en')
  assert.equal(confirmed.steps[0].narrative.why.en.drafted, false)
  assert.equal(confirmed.steps[0].narrative.why.en.text, 'Drafted text', 'the words are unchanged')
  assert.equal(caseStudyReadiness(confirmed, ['en']).ready, true)
})

test('editing a drafted passage makes it authored', async () => {
  // Rewriting it IS the review.
  const capture = await grounded()
  const { capture: drafted } = applyCaseStudyResponse(capture, 's1w ||| Model text', 'en')
  const edited = setNarrative(drafted, 1, 'why', 'en', 'What the author actually thinks')

  assert.equal(edited.steps[0].narrative.why.en.drafted, false)
  assert.equal(caseStudyReadiness(edited, ['en']).ready, true)
})

test('an empty passage cannot be confirmed into existence', async () => {
  const capture = await load()
  assert.throws(() => confirmNarrative(capture, 1, 'why', 'en'), /cannot confirm an empty/)
})

test('NEEDS AUTHOR is recorded as a refusal, not as narrative', async () => {
  // A model declining to guess is a useful signal. Storing it as prose would
  // bury it, and it would then need "reviewing" like any other draft.
  const capture = await grounded()
  const { capture: next, applied, declined } = applyCaseStudyResponse(
    capture,
    's1w ||| NEEDS AUTHOR\ns1b ||| The shift cannot start',
    'en'
  )

  assert.equal(applied, 1)
  assert.equal(declined.length, 1)
  assert.deepEqual({ stepIndex: declined[0].stepIndex, field: declined[0].field }, { stepIndex: 1, field: 'why' })
  assert.equal(next.steps[0].narrative.why.en.text, null, 'nothing was stored for it')
})

test('an unknown id aborts the whole import', async () => {
  const capture = await grounded()
  assert.throws(
    () => applyCaseStudyResponse(capture, 's1w ||| Fine\ns99w ||| Belongs to another capture', 'en'),
    (e) => e.code === 'UNKNOWN_IDS'
  )
})

test('unparseable prose is rejected', async () => {
  const capture = await grounded()
  assert.throws(
    () => applyCaseStudyResponse(capture, 'Certainly! Here are some thoughts about your steps.', 'en'),
    (e) => e.code === 'UNPARSEABLE_RESPONSE'
  )
})

test('a drafted passage cannot masquerade as authored through a round trip', async () => {
  // The end-to-end statement of the invariant: draft, serialise, revive, and
  // the mark is still there.
  const capture = await grounded()
  const { capture: drafted } = applyCaseStudyResponse(capture, 's1w ||| Model text', 'en')
  const revived = JSON.parse(JSON.stringify(drafted, (k, v) => (k === 'bytes' ? undefined : v)))

  assert.equal(revived.steps[0].narrative.why.en.drafted, true)
  assert.equal(caseStudyReadiness(revived, ['en']).ready, false)
})

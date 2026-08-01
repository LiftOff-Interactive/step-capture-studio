/**
 * Which artifacts the all-in-one dashboard bundles.
 *
 * The dashboard used to be all four, always. It is a handout — the one file a
 * learner is actually given — and an author preparing it for a particular
 * audience has good reason to leave a format out: the Quick Reference is noise
 * for someone doing a task for the first time, and the Word download is not
 * wanted at all when the handout is meant to be read on screen.
 *
 * This is only about the BUNDLE. Every artifact stays individually downloadable
 * on the Export page whatever is ticked here — unticking a part says "not in
 * the dashboard", never "do not produce this".
 */

import { includesWorkedExample } from './case-study.js'

/** The four cards, in the order the dashboard lays them out. */
export const AIO_PARTS = ['walkthrough', 'stepGuide', 'workedExample', 'quickReference']

/** Everything in, which is what the dashboard always did. */
export const defaultParts = () => Object.fromEntries(AIO_PARTS.map((part) => [part, true]))

/**
 * The parts this capture will actually bundle.
 *
 * The worked example has a second, stronger switch of its own on its phase. If
 * the capture produces no worked example at all, no amount of ticking here can
 * put one in the dashboard — so that master switch wins, and the UI shows this
 * checkbox disabled rather than ticked-but-ignored.
 */
export function allInOneParts(capture) {
  const stored = capture?.allInOne ?? {}
  const parts = Object.fromEntries(
    AIO_PARTS.map((part) => [part, stored[part] !== false])
  )
  if (!includesWorkedExample(capture)) parts.workedExample = false
  return parts
}

/** Include or exclude one part. Pure, like the rest of the authoring layer. */
export function setAllInOnePart(capture, part, included) {
  if (!AIO_PARTS.includes(part)) throw new RangeError(`unknown all-in-one part ${part}`)
  return {
    ...capture,
    allInOne: { ...defaultParts(), ...(capture.allInOne ?? {}), [part]: Boolean(included) },
  }
}

/**
 * True when the dashboard would have at least one card.
 *
 * An all-in-one of nothing is a header and an empty grid — a file that looks
 * broken rather than deliberately empty — so the caller disables the download
 * instead of producing one.
 */
export function hasAnyPart(capture) {
  return Object.values(allInOneParts(capture)).some(Boolean)
}

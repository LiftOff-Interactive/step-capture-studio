/**
 * Branding: the author's fonts, colours, logo and imagery, applied to every
 * artifact this tool produces.
 *
 * Three constraints shape everything here.
 *
 * **No external requests, ever.** That rules out web fonts, so typography is a
 * short list of stacks that resolve against fonts already on the reader's
 * machine. An artifact that phoned a CDN for a typeface would break the privacy
 * claim the whole tool rests on, and would render wrong offline.
 *
 * **Contrast is measured, not trusted.** A brand colour is supplied by someone
 * who was not thinking about WCAG, and an artifact that fails AA because of a
 * hex value is exactly as inaccessible as one that fails because of missing alt
 * text. So the same treatment: measured, reported with the ratio, and blocking.
 * Text colours that sit *on* a brand colour are not asked for at all — they are
 * derived, because that is a question with a right answer.
 *
 * **Everything travels inside the file.** Logo, background and card icons are
 * inlined as data URIs like every screenshot, so an artifact stays one
 * self-contained document.
 */

import { toDataUri } from './emit-common.js'

/**
 * Font stacks, not fonts.
 *
 * Each ends in a generic family, so a reader missing every named face still
 * gets the right *kind* of type. Deliberately short: a long list invites
 * choosing by name rather than by how the artifact reads.
 */
export const FONT_STACKS = {
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  neutral: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  humanist: '"Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  slab: 'Rockwell, "Roboto Slab", Georgia, serif',
  mono: 'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace',
}

export const FONT_KEYS = Object.keys(FONT_STACKS)

/** The AIO cards that can carry an uploaded icon. Order matches the dashboard. */
export const ICON_SLOTS = ['walkthrough', 'stepGuide', 'workedExample', 'quickReference']

/** Bounds for the size controls. Outside these the artifact stops being usable. */
export const SIZE_LIMITS = { min: 14, max: 22 }
export const SCALE_LIMITS = { min: 1.1, max: 1.5 }

/**
 * The default is the palette the artifacts already shipped with, expressed as
 * branding. That matters: a capture made before this existed must render
 * byte-identically, so "no branding" and "the default branding" have to be the
 * same thing rather than two code paths.
 */
export function defaultBranding() {
  return {
    fontBody: 'system',
    fontHeading: 'system',
    baseSize: 16,
    headingScale: 1.25,
    // No gradient until the author asks for one. The artifacts shipped with a
    // plain rule under the header; defaulting to teal would restyle every
    // existing capture on the next export, which is not a default's job.
    gradientFrom: null,
    gradientTo: null,
    // The accent BASE_CSS already uses, so the default really is a no-op.
    highlight: '#0b5cab',
    logo: null,
    // Per language, like every other author-written string. Empty is legitimate
    // and means decorative — see documentHeader.
    logoAlt: {},
    background: null,
    icons: Object.fromEntries(ICON_SLOTS.map((slot) => [slot, null])),
  }
}

/** Branding on a capture, tolerating captures written before it existed. */
export function brandingOf(capture) {
  const base = defaultBranding()
  const supplied = capture?.branding ?? {}
  return {
    ...base,
    ...supplied,
    icons: { ...base.icons, ...(supplied.icons ?? {}) },
  }
}

/** Apply a partial change. Pure, like the rest of the authoring layer. */
export function setBranding(capture, patch) {
  const next = { ...brandingOf(capture), ...patch }
  if (patch.icons) next.icons = { ...brandingOf(capture).icons, ...patch.icons }
  return { ...capture, branding: next }
}

/**
 * The logo as `documentHeader` wants it, or null when none was supplied.
 * Inlined like every other image so the artifact stays self-contained.
 */
export function brandingLogo(capture, lang) {
  const b = brandingOf(capture)
  if (!b.logo) return null
  return { src: toDataUri(b.logo), alt: b.logoAlt?.[lang] ?? '' }
}

/** One AIO card's icon as a data URI, or null when that slot is empty. */
export function brandingIcon(capture, slot) {
  const bytes = brandingOf(capture).icons?.[slot]
  return bytes ? toDataUri(bytes) : null
}

// ------------------------------------------------------------- contrast ---

const HEX = /^#([0-9a-f]{6})$/i

/** True for the only colour format this accepts. Anything else is refused. */
export function isHexColour(value) {
  return typeof value === 'string' && HEX.test(value.trim())
}

function channels(hex) {
  const m = HEX.exec(String(hex).trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** WCAG relative luminance. */
function luminance(hex) {
  const rgb = channels(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * WCAG 2.1 contrast ratio, 1–21. Null when either colour is unparseable, so a
 * bad value surfaces as its own blocker rather than as a silent 1:1.
 */
export function contrastRatio(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Black or white, whichever reads better on the given colour.
 *
 * Derived rather than asked for. Making the author pick the text colour that
 * sits on their own brand colour is offering them a way to get it wrong, and
 * there are only two sensible answers.
 */
export function bestOn(background) {
  const onWhite = contrastRatio(background, '#ffffff')
  const onBlack = contrastRatio(background, '#111418')
  if (onWhite === null || onBlack === null) return '#111418'
  return onWhite >= onBlack ? '#ffffff' : '#111418'
}

/** Page backgrounds the artifacts use, light and dark, from BASE_CSS. */
const SURFACES = [
  { name: 'bg', light: '#ffffff', dark: '#14171a' },
  { name: 'surface', light: '#f4f6f8', dark: '#1e2226' },
]

const AA_TEXT = 4.5

const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')

/** Blend two colours. `amount` 0 gives the first, 1 the second. */
function mix(from, to, amount) {
  const a = channels(from)
  const b = channels(to)
  if (!a || !b) return from
  return `#${a.map((v, i) => hex2(v + (b[i] - v) * amount)).join('')}`
}

/**
 * The dark-scheme counterpart of the author's highlight.
 *
 * One brand colour cannot serve both schemes, which is why BASE_CSS already
 * ships two accents: a mid-tone blue that reads on white is 2.4:1 on near-black
 * and unusable. Asking the author for a second colour would contradict the
 * point — they have *a* brand colour — so the dark variant is derived by
 * blending theirs toward white until it clears AA on both dark surfaces. Hue is
 * preserved, so it still reads as the same colour.
 *
 * White is the floor: it passes on any dark surface, so this always terminates
 * with something usable.
 */
export function darkHighlight(highlight) {
  if (!isHexColour(highlight)) return '#ffffff'
  const passes = (candidate) =>
    SURFACES.every((surface) => contrastRatio(candidate, surface.dark) >= AA_TEXT)
  if (passes(highlight)) return highlight
  for (let i = 1; i <= 20; i += 1) {
    const candidate = mix(highlight, '#ffffff', i / 20)
    if (passes(candidate)) return candidate
  }
  return '#ffffff'
}

/**
 * Everything about this branding that would ship an artifact failing AA.
 *
 * Only the highlight is really under test. It is used for link text and control
 * labels, so it has to clear 4.5:1 against both page surfaces in both colour
 * schemes — four measurements, and the artifacts follow the reader's scheme, so
 * passing in light alone is not passing.
 *
 * The gradient is checked too, but against its own derived on-colour: that
 * should always pass, and a failure means a colour so mid-toned that neither
 * black nor white works on it, which the author does need telling about.
 *
 * @returns {{ready: boolean, blockers: Array<{code, field, ratio, against}>}}
 */
export function brandingReadiness(capture) {
  const branding = brandingOf(capture)
  const blockers = []

  const hasGradient = Boolean(branding.gradientFrom || branding.gradientTo)

  if (!isHexColour(branding.highlight)) {
    blockers.push({ code: 'COLOUR_INVALID', field: 'highlight', ratio: null, against: null })
  }
  if (hasGradient) {
    // Half a gradient is not a gradient. Naming the missing end is more useful
    // than silently falling back to one colour the author did not choose.
    for (const field of ['gradientFrom', 'gradientTo']) {
      if (!isHexColour(branding[field])) {
        blockers.push({ code: 'COLOUR_INVALID', field, ratio: null, against: null })
      }
    }
  }
  if (blockers.length) return { ready: false, blockers }

  // Light surfaces only. The dark scheme uses a variant derived from this one
  // and guaranteed to pass by construction (see darkHighlight), so measuring it
  // here would only ever report on this function's own arithmetic. What is
  // genuinely under test is whether the author's actual colour works on white —
  // and if it does not, that is a real finding about their brand, not about us.
  for (const surface of SURFACES) {
    const ratio = contrastRatio(branding.highlight, surface.light)
    if (ratio < AA_TEXT) {
      blockers.push({
        code: 'HIGHLIGHT_CONTRAST',
        field: 'highlight',
        ratio: Math.round(ratio * 100) / 100,
        against: surface.name,
      })
    }
  }

  if (hasGradient) {
    // The header's text colour is derived from the FIRST stop, so both stops
    // must carry it. A gradient that runs from a colour needing white text to
    // one needing black has no correct answer, and this is where that shows.
    const on = bestOn(branding.gradientFrom)
    for (const field of ['gradientFrom', 'gradientTo']) {
      const ratio = contrastRatio(branding[field], on)
      if (ratio < AA_TEXT) {
        blockers.push({
          code: 'GRADIENT_CONTRAST',
          field,
          ratio: Math.round(ratio * 100) / 100,
          against: 'header text',
        })
      }
    }
  }

  return { ready: blockers.length === 0, blockers }
}

// ------------------------------------------------------------------ css ---

const clamp = (value, { min, max }, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const stack = (key) => FONT_STACKS[key] ?? FONT_STACKS.system

/**
 * A lighter or darker step of the brand, for hover states.
 *
 * Moves *away* from the text that sits on it, so a dark brand lightens and a
 * light brand darkens. Hovering must never reduce the label's contrast.
 */
export function brandHover(brand) {
  if (!isHexColour(brand)) return brand
  return mix(brand, bestOn(brand) === '#ffffff' ? '#ffffff' : '#111418', 0.14)
}

/**
 * The wash a card sits on: the brand, mostly dissolved into the page.
 *
 * Derived rather than asked for, like every other colour that sits next to the
 * author's one choice. `scheme` picks which page it dissolves into.
 */
export function brandTint(brand, scheme = 'light') {
  if (!isHexColour(brand)) return brand
  const page = scheme === 'dark' ? '#14171a' : '#ffffff'
  return mix(brand, page, scheme === 'dark' ? 0.78 : 0.86)
}

/**
 * Branding as token overrides — the `:root` blocks and nothing else.
 *
 * Split out from brandingCss so the studio can paint itself with the very same
 * string the artifacts get. A preview generated by a second code path is a
 * preview that can lie; this one cannot drift because there is only one of it.
 *
 * **The `--brand` family moves only when the author has actually chosen a
 * colour.** The shell, its hover step and the card wash are left alone while
 * the highlight is still the default, because a default that silently restyles
 * every existing capture is not a default. That keeps "no branding" and "the
 * default branding" one code path, which is the invariant the whole feature
 * rests on — and it is why the derived tint not reproducing today's #dceaf7
 * exactly does not matter: at the default, nothing is emitted to reproduce.
 */
export function brandingTokensCss(capture) {
  const b = brandingOf(capture)
  const dark = darkHighlight(b.highlight)

  const chosen = b.highlight !== defaultBranding().highlight && isHexColour(b.highlight)
  const shell = (scheme) =>
    chosen
      ? `
  --brand: ${b.highlight};
  --on-brand: ${bestOn(b.highlight)};
  --brand-hover: ${brandHover(b.highlight)};
  --brand-tint: ${brandTint(b.highlight, scheme)};
  --brand-ink: ${bestOn(brandTint(b.highlight, scheme))};`
      : ''

  return `
:root {
  --accent: ${b.highlight};
  --on-accent: ${bestOn(b.highlight)};
  --font-body: ${stack(b.fontBody)};
  --font-heading: ${stack(b.fontHeading)};
  --scrim: rgba(255, 255, 255, .88);${shell('light')}
}
@media (prefers-color-scheme: dark) {
  :root {
    --scrim: rgba(20, 23, 26, .88);
    /* Derived, not supplied — one brand colour cannot clear AA on both a white
       and a near-black page. See darkHighlight. */
    --accent: ${dark};
    --on-accent: ${bestOn(dark)};${shell('dark').replace(/\n {2}/g, '\n    ')}
  }
}`.trim()
}

/**
 * The branding as CSS, injected after BASE_CSS so its variables win and before
 * each artifact's own rules so structure can still override.
 *
 * Sizes are expressed as a modular scale off one base, rather than a field per
 * heading level. Six independent size boxes is six ways to produce a document
 * whose headings do not step, and the request — "font and sizes for all areas"
 * — is served better by one ratio that keeps them in proportion.
 */
export function brandingCss(capture) {
  const b = brandingOf(capture)
  const size = clamp(b.baseSize, SIZE_LIMITS, 16)
  const scale = clamp(b.headingScale, SCALE_LIMITS, 1.25)
  const step = (n) => `${(scale ** n).toFixed(3)}rem`

  const background = b.background
    ? `
/* Author's background image. Fixed and covering, with a scrim over it: text
   over an arbitrary photograph is a contrast failure waiting to happen, and the
   scrim is what keeps the measured ratios above honest. */
body {
  background-image: linear-gradient(var(--scrim), var(--scrim)), url("${toDataUri(b.background)}");
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}`
    : ''

  const gradient =
    b.gradientFrom && b.gradientTo
      ? `
/* Two-tone header. The on-colour is derived, never supplied — see bestOn. */
.doc-header {
  background: linear-gradient(135deg, ${b.gradientFrom}, ${b.gradientTo});
  color: ${bestOn(b.gradientFrom)};
  padding: 1.25rem 1.5rem;
  border-radius: var(--radius);
  border-bottom: 0;
}
.doc-header .doc-meta { color: inherit; opacity: .85; }
.doc-header .lang-toggle { color: inherit; border-color: currentColor; }`
      : ''

  return `
${brandingTokensCss(capture)}

/*
 * Size as a PERCENTAGE of the reader's own default, not an absolute px.
 *
 * A reader who has set a larger default text size has usually done it because
 * they need it. Pinning html to 16px silently overrides that, and an artifact
 * whose whole point is being accessible has no business doing so. 100% is the
 * reader's setting; the author's control scales it.
 *
 * No backticks in this comment — it lives inside a template literal.
 */
html { font-size: ${((size / 16) * 100).toFixed(1)}%; }
body { font-family: var(--font-body); }
h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
h1 { font-size: ${step(3)}; }
h2 { font-size: ${step(2)}; }
h3 { font-size: ${step(1)}; }
h4, h5, h6 { font-size: ${step(0)}; }
.doc-logo { display: block; max-height: 3rem; width: auto; }
${gradient}
${background}
`.trim()
}

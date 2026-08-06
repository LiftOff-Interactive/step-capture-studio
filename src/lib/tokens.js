/**
 * Access to the design tokens, so an exported artifact can carry the same
 * `:root` the studio is using.
 *
 * `src/ui/tokens.css` is the single definition. The studio links it; the
 * artifacts have to inline it, because an artifact is one self-contained file
 * with no second request in it. So somebody has to hand the text to the
 * emitters, and this is the seam where that happens:
 *
 *   browser -> app.js fetches tokens.css during load and calls setTokens()
 *   tests   -> test/helpers/tokens.mjs reads the same file, via --import
 *
 * The tests therefore inline the real file rather than a copy of it, which is
 * the point: what gets measured is what ships.
 *
 * `tokensCss()` throws rather than returning '' when nothing has been loaded.
 * An artifact that quietly came out with no colours at all would look like a
 * styling bug in the template and take an hour to trace back to here.
 */

let loaded = null

/**
 * Supply the token stylesheet. Called once during startup.
 * @param {string} css the full text of src/ui/tokens.css
 */
export function setTokens(css) {
  if (typeof css !== 'string' || !css.includes(':root')) {
    throw new Error('setTokens: expected the text of tokens.css, with a :root block')
  }
  loaded = css.trim()
}

/** The token stylesheet, ready to inline. Throws if startup never loaded it. */
export function tokensCss() {
  if (loaded === null) {
    throw new Error(
      'tokensCss: design tokens were never loaded. The browser loads them in app.js; ' +
        'tests load them through test/helpers/tokens.mjs.',
    )
  }
  return loaded
}

/** Whether tokens are available, for callers that want to check before asking. */
export const tokensReady = () => loaded !== null

/**
 * One token's value, per colour scheme.
 *
 * Exists so the contrast maths can measure against the surfaces that actually
 * ship rather than against a copy of them. `branding.js` used to carry its own
 * list of page backgrounds with the comment "from BASE_CSS" — true when written,
 * and exactly the kind of hand-kept copy that goes stale silently.
 *
 * Falls back to the light value when dark does not override, which mirrors how
 * the cascade behaves.
 */
export function tokenValue(name, scheme = 'light') {
  const blocks = [...tokensCss().matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1])
  const find = (block) => block?.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1]?.trim()
  return (scheme === 'dark' ? find(blocks[1]) ?? find(blocks[0]) : find(blocks[0])) ?? null
}

/** Where the stylesheet lives, relative to index.html. One spelling of the path. */
export const TOKENS_URL = 'src/ui/tokens.css'

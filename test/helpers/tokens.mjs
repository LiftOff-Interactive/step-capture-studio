/**
 * Loads the real design tokens before any test runs.
 *
 * Preloaded for every test file via `node --import` in the test script, so no
 * individual test has to remember. Reading `src/ui/tokens.css` from disk rather
 * than keeping a copy here is deliberate: it means the artifacts under test
 * carry the same `:root` that ships, and a token changed in the stylesheet
 * cannot pass a suite that was measuring something else.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTokens } from '../../src/lib/tokens.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
setTokens(readFileSync(resolve(root, 'src/ui/tokens.css'), 'utf8'))

/**
 * Dev-only static server. ES modules cannot load from file://, so the app needs
 * a real origin to run locally.
 *
 * Uses only node:http — no dependency, matching the project's zero-dependency
 * rule even for tooling. This never ships; GitHub Pages serves the repo directly.
 *
 *   npm start          -> http://localhost:8080
 *   PORT=3000 npm start
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// Derived from this file's location, not cwd — so the project root is served
// no matter where the command was run from, and never a parent directory.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.PORT ?? 8080)

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)

  // Resolve inside root only — normalize then confirm containment, so encoded
  // traversal cannot escape the project directory.
  const resolved = join(root, normalize(requestPath))
  const target = requestPath.endsWith('/') ? join(resolved, 'index.html') : resolved

  if (target !== root && !target.startsWith(root + sep)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('403 Forbidden')
    return
  }

  try {
    const body = await readFile(target)
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extname(target)] ?? 'application/octet-stream',
      // Never cache in development — a stale module is a confusing bug.
      'Cache-Control': 'no-store',
    })
    response.end(body)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('404 Not Found')
  }
})

server.listen(port, () => {
  console.log(`serving ${root}`)
  console.log(`http://localhost:${port}`)
})

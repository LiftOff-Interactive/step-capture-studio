/**
 * Dev-only screenshot tool. Drives headless Chrome over the DevTools Protocol
 * to photograph the app, or the artifacts it exports, against the demo capture.
 *
 * Uses Node's own global WebSocket — no puppeteer, no dependency, matching the
 * project's zero-dependency rule even for tooling. This never ships.
 *
 *   node tools/shoot.mjs phases              -> the seven phases, English
 *   node tools/shoot.mjs phases --fr         -> the same in French
 *   node tools/shoot.mjs artifacts           -> the four exported HTML artifacts, branded
 *   OUT=docs/assets node tools/shoot.mjs phases
 *
 * Requires the dev server: `npm start` in another terminal.
 *
 * Two rules learned building this, both of which produced confident nonsense:
 *
 * 1. **Gate on what you want, never on what you want gone.** The first version
 *    waited for "No capture loaded yet" to disappear — which the error banner
 *    also satisfies. It shot the same failed screen seven times and reported
 *    success. Every wait below is positive: the panel is VISIBLE, the lang
 *    attribute HAS changed, the file EXISTS.
 * 2. **Every click must come after the document is complete.** Module scripts
 *    are deferred, so a click that lands early hits a button with no listener
 *    and fails silently. That bug produced a French run that was byte-identical
 *    to the English one.
 *
 * The duplicate-hash check at the end exists because both failures looked like
 * success. Identical output is a failure, not a result.
 */

import { spawn } from 'node:child_process'
import { mkdir, writeFile, readdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2] ?? 'phases'
const french = process.argv.includes('--fr')
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:8080'
const OUT = resolve(root, process.env.OUT ?? join('tools', 'shots'))
const PORT = Number(process.env.CDP_PORT ?? 9222)
const SCALE = Number(process.env.SCALE ?? 1.5)

// Chrome, wherever this machine keeps it. Edge is Chromium and speaks the same
// protocol, so it is a fine fallback on a Windows box with no Chrome.
const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

const PHASES = [
  ['start', 'Start here'],
  ['capture', 'Capture details'],
  ['worked', 'Worked example'],
  ['edit', 'Edit steps'],
  ['translate', 'Translate'],
  ['branding', 'Branding'],
  ['export', 'Export'],
]

/**
 * The four HTML artifacts. The two Word buttons are deliberately absent: a
 * .docx is not something this tool can photograph, and it is verified in Word
 * itself anyway (see feature-docx-writer.md).
 */
const ARTIFACTS = [
  ['download-all-in-one', 'all-in-one'],
  ['download-walkthrough', 'walkthrough'],
  ['download-case-study', 'worked-example'],
  ['download-quick-steps', 'quick-steps'],
]

/**
 * The branding used for the artifact shots. Deliberately the same values Mike
 * put through Word on 2026-08-05, so the HTML and the .docx tell one story
 * rather than two. #ad0b69 measures ~6.9:1 on white, so the export gate passes.
 */
const BRANDING = {
  'brand-font-body': 'mono',
  'brand-font-heading': 'humanist',
  'brand-size': '18',
  'brand-scale': '1.5',
  'brand-highlight': '#ad0b69',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Visible means laid out, not merely present — a hidden node fooled us once. */
const VISIBLE_PHASES =
  `[...document.querySelectorAll('[data-phase]')].filter(p=>p.offsetParent!==null).map(p=>p.dataset.phase)`
// Note the explicit null check: `?.offsetParent !== null` is *true* when the
// element is absent, which crashed on the exported artifacts — they have no
// alert region at all.
const VISIBLE_ALERT = `(() => {
  const a = document.querySelector('[role="alert"]')
  return a && a.offsetParent !== null ? a.textContent.trim() : ''
})()`

async function findTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const page = (await res.json()).find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('Chrome never exposed a page target')
}

function connect(url) {
  const ws = new WebSocket(url)
  const pending = new Map()
  const listeners = new Map()
  let seq = 0
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve: ok, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : ok(msg.result)
    } else if (msg.method) {
      for (const cb of listeners.get(msg.method) ?? []) cb(msg.params)
    }
  })
  return {
    ready: new Promise((r) => ws.addEventListener('open', r)),
    on: (method, cb) => listeners.set(method, [...(listeners.get(method) ?? []), cb]),
    send: (method, params = {}) =>
      new Promise((ok, reject) => {
        const id = ++seq
        pending.set(id, { resolve: ok, reject })
        ws.send(JSON.stringify({ id, method, params }))
      }),
    close: () => ws.close(),
  }
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.text} :: ${expression}`)
  return r.result.value
}

/** Poll until true. Aborts early if the app raises a visible error. */
async function waitFor(cdp, expression, label, timeout = 20000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await evaluate(cdp, `!!(${expression})`)) return
    const alert = await evaluate(cdp, VISIBLE_ALERT)
    if (alert) throw new Error(`the app showed an error while waiting for ${label}: "${alert}"`)
    await sleep(150)
  }
  throw new Error(`timed out waiting for ${label}`)
}

async function shoot(cdp, name) {
  const { contentSize } = await cdp.send('Page.getLayoutMetrics')
  const height = Math.min(Math.ceil(contentSize.height), 20000)
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(contentSize.width), height, scale: SCALE },
  })
  const buf = Buffer.from(data, 'base64')
  await writeFile(join(OUT, `${name}.png`), buf)
  const hash = createHash('sha1').update(buf).digest('hex').slice(0, 10)
  const kb = String(Math.round(buf.length / 1024)).padStart(5)
  console.log(`  ${name.padEnd(22)} ${kb} KB ${String(height).padStart(6)}px  ${hash}`)
  return hash
}

/** Identical images mean the run did nothing, however cheerful the log was. */
function assertDistinct(hashes) {
  const seen = new Map()
  for (const [name, hash] of hashes) seen.set(hash, [...(seen.get(hash) ?? []), name])
  const dupes = [...seen.values()].filter((g) => g.length > 1)
  if (dupes.length) {
    throw new Error(`identical screenshots — the run did nothing: ${dupes.map((g) => g.join(' = ')).join(', ')}`)
  }
}

/** Set a control the way a person would, so the app's listeners actually fire. */
const setControl = (id, value) => `(() => {
  const el = document.getElementById(${JSON.stringify(id)})
  if (!el) throw new Error('no control ' + ${JSON.stringify(id)})
  el.value = ${JSON.stringify(value)}
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return el.value
})()`

async function loadDemo(cdp) {
  await cdp.send('Page.navigate', { url: ORIGIN })
  await waitFor(cdp, `document.getElementById('load-demo')`, 'the app shell')
  // Deferred modules: nothing may be clicked before this.
  await waitFor(cdp, `document.readyState==='complete'`, 'the document to finish loading')
  await sleep(400)

  if (french) {
    const before = await evaluate(cdp, `document.documentElement.lang`)
    await evaluate(cdp, `document.getElementById('lang-toggle').click()`)
    await waitFor(cdp, `document.documentElement.lang!==${JSON.stringify(before)}`, 'the language to switch')
    console.log(`language: ${before} -> ${await evaluate(cdp, `document.documentElement.lang`)}`)
  }

  await evaluate(cdp, `document.getElementById('load-demo').click()`)
  // The importer advances to Capture details on success. That is the signal.
  await waitFor(cdp, `${VISIBLE_PHASES}.includes('capture')`, 'the demo capture to import')
  console.log(`loaded: ${await evaluate(cdp, `document.querySelector('[role="status"]')?.textContent.trim()`)}`)
}

async function shootPhases(cdp) {
  const hashes = new Map()
  for (const [i, [target, label]] of PHASES.entries()) {
    await evaluate(cdp, `document.querySelector('[data-phase-target="${target}"]').click()`)
    await waitFor(cdp, `${VISIBLE_PHASES}.includes('${target}')`, `the ${label} panel`)
    await sleep(450) // images and the contrast readout settle after the swap
    await evaluate(cdp, `window.scrollTo(0,0)`)
    await sleep(120)
    const name = `${french ? 'fr' : 'en'}-${String(i + 1).padStart(2, '0')}-${target}`
    hashes.set(name, await shoot(cdp, name))
  }
  assertDistinct(hashes)
  return hashes.size
}

async function shootArtifacts(cdp) {
  const downloads = join(OUT, '_downloads')
  await rm(downloads, { recursive: true, force: true })
  await mkdir(downloads, { recursive: true })

  await evaluate(cdp, `document.querySelector('[data-phase-target="branding"]').click()`)
  await waitFor(cdp, `${VISIBLE_PHASES}.includes('branding')`, 'the Branding panel')
  for (const [id, value] of Object.entries(BRANDING)) {
    console.log(`  ${id} = ${await evaluate(cdp, setControl(id, value))}`)
  }
  await sleep(400)
  const readout = await evaluate(
    cdp,
    `[...document.querySelectorAll('[data-phase="branding"] *')].map(e=>e.textContent).find(t=>/:1/.test(t)&&t.length<80)?.trim()`,
  )
  console.log(`  contrast readout: ${readout}`)

  await cdp.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloads,
    eventsEnabled: true,
  })
  await evaluate(cdp, `document.querySelector('[data-phase-target="export"]').click()`)
  await waitFor(cdp, `${VISIBLE_PHASES}.includes('export')`, 'the Export panel')

  for (const [id, label] of ARTIFACTS) {
    const disabled = await evaluate(cdp, `document.getElementById('${id}').disabled`)
    if (disabled) throw new Error(`${label}: the download is disabled — the export gate is blocking`)
    await evaluate(cdp, `document.getElementById('${id}').click()`)
    await waitFor(
      cdp,
      `true`, // the file check below is the real gate; this just yields a tick
      `${label} to start downloading`,
      1000,
    ).catch(() => {})
    await sleep(900)
  }

  const files = (await readdir(downloads)).filter((f) => f.endsWith('.html'))
  if (files.length !== ARTIFACTS.length) {
    throw new Error(`expected ${ARTIFACTS.length} .html downloads, got ${files.length}: ${files.join(', ')}`)
  }
  console.log(`  downloaded: ${files.join(', ')}`)

  const hashes = new Map()
  for (const [i, file] of files.sort().entries()) {
    await cdp.send('Page.navigate', { url: pathToFileURL(join(downloads, file)).href })
    await waitFor(cdp, `document.readyState==='complete'`, `${file} to render`)
    await sleep(700) // inlined base64 screenshots decode after load
    const name = `artifact-${String(i + 1).padStart(2, '0')}-${file.replace(/\.html$/, '').slice(0, 40)}`
    hashes.set(name, await shoot(cdp, name))
  }
  assertDistinct(hashes)
  return hashes.size
}

const profile = join(tmpdir(), `scs-shoot-${Date.now()}`)
await mkdir(OUT, { recursive: true })

const chrome = spawn(CANDIDATES[0], [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--window-size=1280,900',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' })

const noise = []
let failed = null
try {
  const cdp = connect(await findTarget())
  await cdp.ready
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'warning') {
      noise.push(`${p.type}: ${p.args.map((a) => a.description ?? a.value).join(' ')}`)
    }
  })
  cdp.on('Runtime.exceptionThrown', (p) =>
    noise.push(`exception: ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`))
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  })

  console.log(`${mode} -> ${OUT}`)
  await loadDemo(cdp)
  const count = mode === 'artifacts' ? await shootArtifacts(cdp) : await shootPhases(cdp)
  console.log(`\n${count} distinct screenshots`)
  cdp.close()
} catch (err) {
  failed = err
} finally {
  chrome.kill()
  await sleep(300)
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}

if (noise.length) console.log(`\nconsole noise:\n  ${noise.join('\n  ')}`)
if (failed) {
  console.error(`\nFAILED: ${failed.message}`)
  process.exit(1)
}

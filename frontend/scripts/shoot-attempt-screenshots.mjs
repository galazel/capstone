/**
 * Re-shoots the landing hero's assessment screenshots from the real attempt
 * page.
 *
 *   npm run shoot:attempt
 *
 * It boots its own Vite dev server, drives the Chrome already installed on the
 * machine over `/__preview/attempt/1?item=<type>` — the dev-only harness that
 * renders the genuine `LearnerAssessmentAttemptPage` against fixture data — and
 * writes one PNG per question type into `public/screenshots/`.
 *
 * Server and browser live in this one process on purpose: a separately-started
 * dev server does not reliably outlive the shell that spawned it, and a Chrome
 * driven by `--screenshot` alone fires before Vite has finished serving modules,
 * which is how you get a blank white frame.
 *
 * Options:
 *   --width=1440 --height=900     viewport (shots render at 2x for retina)
 *   --only=programming            one question type
 *   --chrome="C:\path\chrome.exe" explicit browser binary
 *   --port=5399                   dev server port
 *
 * The hero is the one place on the site that claims what sitting an exam looks
 * like, so it should be a photograph of the product, not a drawing of it. When
 * the attempt page changes, run this again rather than editing the landing page.
 */
import { existsSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import puppeteer from "puppeteer-core"
import { createServer } from "vite"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "..")
const OUT_DIR = resolve(ROOT, "public", "screenshots")

const SHOTS = [
  { item: "mcq", file: "attempt-multiple-choice.png", settle: "text" },
  { item: "short-answer", file: "attempt-short-answer.png", settle: "text" },
  { item: "descriptive", file: "attempt-descriptive.png", settle: "text" },
  { item: "programming", file: "attempt-programming.png", settle: "code" },
  { item: "diagram", file: "attempt-diagram.png", settle: "diagram" },
]

// What "ready to shoot" means per type. The written types are ready as soon as
// the answer surface is in the DOM; the programming item has to wait for
// CodeMirror to mount, and the diagram item for draw.io's iframe to paint.
const SETTLE = {
  text: { selector: "main", extraMs: 1200 },
  code: { selector: ".cm-content", extraMs: 2000 },
  diagram: { selector: "iframe", extraMs: 7000 },
}

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

function arg(name, fallback) {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const width = Number(arg("width", "1440"))
const height = Number(arg("height", "900"))
const port = Number(arg("port", "5399"))
const only = arg("only", null)
const chrome = arg("chrome", CHROME_CANDIDATES.find((path) => existsSync(path)))

if (!chrome) {
  console.error(
    "No Chrome or Edge binary found. Pass one explicitly:\n" +
      '  npm run shoot:attempt -- --chrome="C:\\path\\to\\chrome.exe"'
  )
  process.exit(1)
}

const targets = only ? SHOTS.filter((shot) => shot.item === only) : SHOTS
if (targets.length === 0) {
  console.error(`--only=${only} matched no question type.`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })

const server = await createServer({
  root: ROOT,
  configFile: resolve(ROOT, "vite.config.ts"),
  server: { port, strictPort: true },
  logLevel: "warn",
})
await server.listen()
const base = `http://localhost:${port}`
console.log(`dev server on ${base}`)

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  defaultViewport: { width, height, deviceScaleFactor: 2 },
  args: ["--hide-scrollbars", "--disable-gpu"],
})

try {
  for (const shot of targets) {
    const page = await browser.newPage()
    // The attempt page guards against navigating away mid-attempt; nothing can
    // answer that dialog in headless, so accept it before it can block close().
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}))

    const url = `${base}/__preview/attempt/1?item=${shot.item}`
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 })

    const settle = SETTLE[shot.settle]
    await page.waitForSelector(settle.selector, { timeout: 30000 })
    await new Promise((done) => setTimeout(done, settle.extraMs))

    const out = resolve(OUT_DIR, shot.file)
    await page.screenshot({ path: out })
    console.log(`shot ${shot.item} -> public/screenshots/${shot.file}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}

console.log(`\nDone. ${targets.length} screenshot(s) in public/screenshots/`)

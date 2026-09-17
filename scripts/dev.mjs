#!/usr/bin/env node
/**
 * BallerStats — one-command local development setup (`pnpm run dev`).
 *
 * Dependency-free Node ESM helper (node: builtins only) that prepares everything a fresh
 * clone needs before Vite starts:
 *
 *   1. prerequisites: usable Node version, pnpm available on PATH;
 *   2. install state: runs `pnpm install` when `node_modules` is missing or empty;
 *   3. `.env`: created from `.env.example`, then `VITE_NOSTROMO_URL` filled through a menu
 *      (an existing non-empty value is never overwritten, only reported);
 *   4. backend: `GET <VITE_NOSTROMO_URL>/api/health` with a short timeout, plus the option to
 *      start the sibling Nostromo repository and bootstrap its dev users;
 *   5. Vite: `pnpm exec vite` with inherited stdio, signals forwarded to the child.
 *
 * Non-interactive safety: when stdin is not a TTY (CI, pipes), nothing is ever prompted —
 * safe defaults are applied and logged.
 *
 * Developer-facing output is French (the language of CONTRIBUTING.md); code and comments
 * stay in English (see AGENTS.md).
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, constants as osConstants } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

// --- configuration -------------------------------------------------------------

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = path.join(ROOT_DIR, '.env')
const ENV_EXAMPLE_FILE = path.join(ROOT_DIR, '.env.example')
const ENV_KEY = 'VITE_NOSTROMO_URL'
const DEFAULT_BACKEND_URL = 'http://localhost:8090'
const HEALTH_PATH = '/api/health'

const NOSTROMO_DIR = path.join(homedir(), 'workspace', 'nostromo')
const NOSTROMO_SCRIPTS_DIR = path.join(NOSTROMO_DIR, 'infra', 'pocketbase', 'scripts')
const NOSTROMO_SERVE_SCRIPT = path.join(NOSTROMO_SCRIPTS_DIR, 'serve.sh')
const NOSTROMO_BOOTSTRAP_SCRIPT = path.join(NOSTROMO_SCRIPTS_DIR, 'bootstrap.sh')

// Vite 8 requires Node 20+; the project has no `engines` field, so this is the only gate.
const MIN_NODE_MAJOR = 20
const HEALTH_PROBE_TIMEOUT_MS = 2500
const BACKEND_READY_TIMEOUT_MS = 30_000
const BACKEND_POLL_INTERVAL_MS = 500
const PROGRESS_EVERY_ATTEMPTS = 10

const VITE_ARGS = ['exec', 'vite']
const VITE_URL = 'http://localhost:3000'
const IS_WINDOWS = process.platform === 'win32'
const INTERACTIVE = Boolean(process.stdin.isTTY)

const NEWLINE_PATTERN = /\r?\n/
const EXPORT_PREFIX_PATTERN = /^export\s+/
const INLINE_COMMENT_PATTERN = /\s+#.*$/
const TRAILING_SLASH_PATTERN = /\/+$/
const LOCAL_BACKEND_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i

// --- logging -------------------------------------------------------------------

const paint = (code, text) => (process.stdout.isTTY ? `\u001B[${code}m${text}\u001B[0m` : text)

const log = (message) => process.stdout.write(` ${message}\n`)
const heading = (message) => log(`\n${paint('1;36', `==> ${message}`)}`)
const done = (message) => log(`${paint('32', '✓')} ${message}`)
const warn = (message) => log(`${paint('33', '!')} ${message}`)
const die = (message) => {
  log(`${paint('31', '✗')} ${message}`)
  process.exit(1)
}

// --- prompts (interactive mode only) -------------------------------------------

let reader = null

const getReader = () => {
  if (!reader) {
    reader = createInterface({ input: process.stdin, output: process.stdout })
    reader.once('close', () => {
      reader = null
    })
  }
  return reader
}

const closeReader = () => {
  reader?.close()
  reader = null
}

/** Asks a question; resolves an empty string when stdin reaches EOF. */
const ask = (question) => {
  const active = getReader()
  return new Promise((resolve) => {
    const onClose = () => resolve('')
    active.once('close', onClose)
    active.question(` ${question} `, (answer) => {
      active.removeListener('close', onClose)
      resolve(answer ?? '')
    })
  })
}

/** Asks for a number in `[1, optionCount]`, retrying on invalid input. */
const askChoice = async (question, optionCount, defaultChoice) => {
  const answer = (await ask(question)).trim()
  if (answer === '') {
    return defaultChoice
  }
  const choice = Number.parseInt(answer, 10)
  if (choice >= 1 && choice <= optionCount) {
    return choice
  }
  warn(`Choix invalide : entrez un nombre entre 1 et ${optionCount}.`)
  return await askChoice(question, optionCount, defaultChoice)
}

/** Prints a numbered menu and resolves the chosen number (1-based). */
const askMenu = async ({ defaultChoice, options, title }) => {
  log('')
  log(title)
  for (const [index, option] of options.entries()) {
    log(` [${index + 1}] ${option}`)
  }
  return await askChoice(`Votre choix [${defaultChoice}] :`, options.length, defaultChoice)
}

// --- .env helpers --------------------------------------------------------------

/** Returns the key of an `.env` line (`export` prefix and padding removed), or null. */
const keyOfLine = (line) => {
  if (line.trim().startsWith('#')) {
    return null
  }
  const separator = line.indexOf('=')
  if (separator < 0) {
    return null
  }
  return line.slice(0, separator).trim().replace(EXPORT_PREFIX_PATTERN, '')
}

const valueOfLine = (line) => line.slice(line.indexOf('=') + 1)

const isQuoted = (value, quote) => value.length >= 2 && value.startsWith(quote) && value.endsWith(quote)

/** Strips surrounding quotes, then a trailing `# comment` on unquoted values. */
const unquote = (raw) => {
  const trimmed = raw.trim()
  if (isQuoted(trimmed, '"') || isQuoted(trimmed, "'")) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed.replace(INLINE_COMMENT_PATTERN, '').trim()
}

/** Reads a key from raw `.env` content (last line wins, like dotenv). */
const readEnvValue = (content) => {
  let raw = null
  for (const line of content.split(NEWLINE_PATTERN)) {
    if (keyOfLine(line) === ENV_KEY) {
      raw = valueOfLine(line)
    }
  }
  return raw === null ? null : unquote(raw)
}

/** Returns `.env` content with the key set: existing line replaced, else appended. */
const writeEnvValue = (content, value) => {
  const lines = content.split(NEWLINE_PATTERN)
  while (lines.length > 0 && lines.at(-1).trim() === '') {
    lines.pop()
  }
  const index = lines.findIndex((line) => keyOfLine(line) === ENV_KEY)
  if (index >= 0) {
    lines[index] = `${ENV_KEY}=${value}`
  } else {
    lines.push(`${ENV_KEY}=${value}`)
  }
  return `${lines.join('\n')}\n`
}

// --- backend helpers -----------------------------------------------------------

const stripTrailingSlash = (url) => url.replace(TRAILING_SLASH_PATTERN, '')

const isHttpUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const isLocalBackendUrl = (url) => LOCAL_BACKEND_PATTERN.test(url)

const healthUrlOf = (backendUrl) => `${backendUrl}${HEALTH_PATH}`

const checkHealth = async (healthUrl) => {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(HEALTH_PROBE_TIMEOUT_MS) })
    return response.ok
  } catch {
    return false
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Starts `serve.sh` detached so it outlives this helper, and tracks its early exit.
 * Returns a state object rather than the child: the polling loop only needs to know whether
 * the server died before answering.
 */
const startNostromoBackend = () => {
  const state = { code: null, exited: false }
  const child = spawn('bash', [NOSTROMO_SERVE_SCRIPT], {
    cwd: NOSTROMO_DIR,
    detached: true,
    stdio: 'ignore',
  })
  child.once('exit', (code) => {
    state.exited = true
    state.code = code
  })
  child.once('error', () => {
    state.exited = true
  })
  child.unref()
  return state
}

/** Polls the health endpoint once; returns 'ready', 'exited' (server died) or 'timeout'. */
const pollBackend = async (healthUrl, backend, deadline, attempt) => {
  if (await checkHealth(healthUrl)) {
    return 'ready'
  }
  if (backend.exited) {
    return 'exited'
  }
  if (Date.now() >= deadline) {
    return 'timeout'
  }
  if (attempt % PROGRESS_EVERY_ATTEMPTS === 0) {
    log(`… le backend démarre (${attempt * (BACKEND_POLL_INTERVAL_MS / 1000)} s)`)
  }
  await sleep(BACKEND_POLL_INTERVAL_MS)
  return await pollBackend(healthUrl, backend, deadline, attempt + 1)
}

const waitForBackend = (healthUrl, backend) => pollBackend(healthUrl, backend, Date.now() + BACKEND_READY_TIMEOUT_MS, 1)

// --- steps ---------------------------------------------------------------------

const pnpmCommand = () => (IS_WINDOWS ? 'pnpm.cmd' : 'pnpm')

const checkPrerequisites = () => {
  heading('Prérequis (Node, pnpm)')
  const major = Number.parseInt(process.versions.node.split('.')[0], 10)
  if (major < MIN_NODE_MAJOR) {
    die(
      `Node.js ${process.versions.node} est trop ancien : ce projet requiert Node.js ${MIN_NODE_MAJOR} ou plus récent.`
    )
  }
  done(`Node.js ${process.versions.node}`)

  const probe = spawnSync(pnpmCommand(), ['--version'], { encoding: 'utf8', shell: IS_WINDOWS })
  if (probe.error || probe.status !== 0) {
    die('pnpm introuvable dans le PATH. Installez-le (https://pnpm.io/installation) puis relancez « pnpm run dev ».')
  }
  done(`pnpm ${probe.stdout.trim()}`)
}

const ensureDependencies = () => {
  heading('Dépendances')
  const modulesDir = path.join(ROOT_DIR, 'node_modules')
  const installed = existsSync(modulesDir) && readdirSync(modulesDir).length > 0
  if (installed) {
    done('node_modules présent, rien à installer')
    return
  }
  log('node_modules absent ou vide : installation avec « pnpm install »…')
  const result = spawnSync(pnpmCommand(), ['install'], { cwd: ROOT_DIR, shell: IS_WINDOWS, stdio: 'inherit' })
  if (result.status !== 0) {
    die(
      `« pnpm install » a échoué (code ${result.status ?? 'inconnu'}). Corrigez l’erreur ci-dessus puis relancez « pnpm run dev ».`
    )
  }
  done('Dépendances installées')
}

const ensureEnvFile = () => {
  if (existsSync(ENV_FILE)) {
    return
  }
  if (existsSync(ENV_EXAMPLE_FILE)) {
    writeFileSync(ENV_FILE, readFileSync(ENV_EXAMPLE_FILE, 'utf8'), 'utf8')
    done('Fichier .env créé à partir de .env.example')
    return
  }
  writeFileSync(ENV_FILE, '', 'utf8')
  warn('.env.example introuvable : un .env vide a été créé')
}

const askBackendUrl = async () => {
  const answer = (await ask(`URL du backend (ex. ${DEFAULT_BACKEND_URL}) :`)).trim()
  if (answer === '') {
    return DEFAULT_BACKEND_URL
  }
  if (isHttpUrl(answer)) {
    return stripTrailingSlash(answer)
  }
  warn('URL invalide : elle doit commencer par http:// ou https://')
  return await askBackendUrl()
}

/** Asks which backend to configure; resolves null for "no backend" (local-only mode). */
const pickBackendUrl = async () => {
  if (!INTERACTIVE) {
    log(`stdin non interactif : choix par défaut [1] backend local ${DEFAULT_BACKEND_URL}`)
    return DEFAULT_BACKEND_URL
  }
  const choice = await askMenu({
    defaultChoice: 1,
    options: [
      `backend local ${DEFAULT_BACKEND_URL} (défaut)`,
      'saisir une URL',
      'continuer sans backend (mode local seul)',
    ],
    title: 'Quel backend utiliser ?',
  })
  if (choice === 1) {
    return DEFAULT_BACKEND_URL
  }
  if (choice === 2) {
    return await askBackendUrl()
  }
  return null
}

/** Ensures `.env` exists and holds a backend URL. Returns the URL, or null for local-only. */
const configureEnv = async () => {
  heading(`Configuration .env (${ENV_KEY})`)
  ensureEnvFile()
  const content = readFileSync(ENV_FILE, 'utf8')
  const configured = readEnvValue(content)

  if (configured) {
    if (!isHttpUrl(configured)) {
      warn(`${ENV_KEY}=${configured} ne ressemble pas à une URL http(s)`)
    }
    done(`${ENV_KEY} déjà définie : ${configured} (.env inchangé)`)
    return stripTrailingSlash(configured)
  }

  log(`${ENV_KEY} absente ou vide dans .env`)
  const url = await pickBackendUrl()
  if (!url) {
    warn('Mode local seul : l’app démarre sans backend')
    log('Le menu réapparaîtra au prochain « pnpm run dev »')
    return null
  }
  writeFileSync(ENV_FILE, writeEnvValue(content, url), 'utf8')
  done(`.env mis à jour : ${ENV_KEY}=${url}`)
  return url
}

/** Starts the sibling Nostromo backend and waits for its health endpoint. */
const startAndWaitForBackend = async (backendUrl) => {
  const healthUrl = healthUrlOf(backendUrl)
  log(`Démarrage en arrière-plan : bash ${NOSTROMO_SERVE_SCRIPT}`)
  const backend = startNostromoBackend()
  const status = await waitForBackend(healthUrl, backend)

  if (status === 'ready') {
    done(`Backend prêt : ${healthUrl} (il reste actif après l’arrêt de Vite)`)
    return true
  }
  if (status === 'exited') {
    warn(`serve.sh s’est arrêté immédiatement (code ${backend.code ?? 'inconnu'}) : binaire manquant ou port occupé ?`)
  } else {
    warn(`Backend toujours injoignable après ${BACKEND_READY_TIMEOUT_MS / 1000} s`)
  }
  log(`Pour voir les logs du backend : bash ${NOSTROMO_SERVE_SCRIPT}`)
  return false
}

const runNostromoBootstrap = () => {
  log('')
  log('Bootstrap : création du superuser et de l’utilisateur de dev (bootstrap.sh)…')
  const result = spawnSync('bash', [NOSTROMO_BOOTSTRAP_SCRIPT], { cwd: NOSTROMO_DIR, stdio: 'inherit' })
  if (result.status === 0) {
    done('Bootstrap terminé')
    return
  }
  warn(`Bootstrap en échec (code ${result.status ?? 'inconnu'}) : relancez « bash ${NOSTROMO_BOOTSTRAP_SCRIPT} »`)
}

/** Asks what to do when the configured backend does not answer. Resolves the choice number. */
const pickBackendRecovery = async (backendUrl) => {
  const localUrl = isLocalBackendUrl(backendUrl)
  const defaultChoice = localUrl ? 1 : 3
  if (!localUrl) {
    warn(`L’URL configurée (${backendUrl}) n’est pas locale : démarrer le backend local ne la rendra pas joignable`)
  }
  if (!INTERACTIVE) {
    log('stdin non interactif : choix par défaut [3] continuer sans backend (aucun service démarré)')
    return 3
  }
  return await askMenu({
    defaultChoice,
    options: [
      'démarrer le backend nostromo (serve.sh)',
      'démarrer le backend puis créer le superuser et l’utilisateur de dev (bootstrap.sh)',
      'continuer sans backend',
      'quitter',
    ],
    title: 'Que faire ?',
  })
}

const ensureBackend = async (backendUrl) => {
  heading('Backend Nostromo')
  const healthUrl = healthUrlOf(backendUrl)
  if (await checkHealth(healthUrl)) {
    done(`Backend joignable : ${healthUrl}`)
    return
  }
  warn(`Backend injoignable : ${healthUrl}`)

  if (!existsSync(NOSTROMO_SERVE_SCRIPT)) {
    warn(`Dépôt nostromo introuvable (${NOSTROMO_DIR}) : aucun démarrage automatique possible`)
    log('L’app démarre sans backend (mode local seul)')
    return
  }

  const choice = await pickBackendRecovery(backendUrl)
  if (choice === 3) {
    log('L’app démarre sans backend (mode local seul)')
    return
  }
  if (choice === 4) {
    log('Arrêt demandé : aucun service n’a été démarré')
    process.exit(0)
  }
  if (await startAndWaitForBackend(backendUrl)) {
    if (choice === 2) {
      runNostromoBootstrap()
    } else {
      done('Backend opérationnel')
    }
    return
  }
  warn('L’app démarre sans backend (mode local seul)')
}

const startVite = () => {
  closeReader()
  heading('Démarrage de Vite')
  log(`Vite sur ${VITE_URL} — Ctrl+C pour arrêter (le backend n’est pas géré par ce script)`)
  const child = spawn(pnpmCommand(), VITE_ARGS, { cwd: ROOT_DIR, shell: IS_WINDOWS, stdio: 'inherit' })
  child.once('error', (error) => {
    die(`Impossible de lancer « pnpm exec vite » : ${error.message}`)
  })
  child.once('exit', (code, signal) => {
    process.exit(code ?? (signal ? 128 + (osConstants.signals[signal] ?? 0) : 0))
  })
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal))
  }
}

// --- entry point ---------------------------------------------------------------

const main = async () => {
  heading('BallerStats — préparation de l’environnement de développement')
  if (!INTERACTIVE) {
    log('stdin non interactif (CI ou pipe) : aucune question ne sera posée, les choix par défaut s’appliquent')
  }
  checkPrerequisites()
  ensureDependencies()
  const backendUrl = await configureEnv()
  if (backendUrl) {
    await ensureBackend(backendUrl)
  }
  startVite()
}

await main().catch((error) => {
  die(`Échec inattendu de la préparation : ${error.message}`)
})

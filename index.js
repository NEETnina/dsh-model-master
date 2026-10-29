/**
 * 模型选择大师 — Host Service
 *
 * Provides backend facilities for the Model Master Web UI:
 *   1. `/api/model-master/probe` — Live streaming benchmark (measures TTFT in ms and TPS in tok/s)
 *      using DSH's native LLM provider runtime without exposing or hardcoding any keys.
 *   2. `/api/model-master/leaderboard` — Live LLM rankings (up to 100 scored models)
 *      built from OpenRouter's published benchmark payload: Artificial Analysis
 *      intelligence/coding/agentic indices plus Design Arena Elo. Daily auto-refresh
 *      and manual refresh, with a local cache fallback when offline.
 *   3. `/api/model-master/results` — Persistent local storage of speed test results
 *      (server-measured only) plus `/results/clear` to drop one entry or all.
 *
 * Zero personal privacy leaks: paths, keys, and tokens are strictly dynamic.
 *
 * @license MIT
 */

import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

export const name = 'model-master'
export const inject = ['llm']

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Resolve safe persistent data directory under DSH home (~/.dsh/model-master) */
function resolveDataDir() {
  const dshHome = process.env.DSH_HOME || path.resolve(os.homedir(), '.dsh')
  const dir = path.resolve(dshHome, 'model-master')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/** Check origin / loopback fence to guard local HTTP API */
function isAuthorized(req) {
  const rawHost = String(req.headers.host ?? '')
    .toLowerCase()
    .trim()

  // Exact host match only — `localhost.evil.com` must NOT pass as loopback.
  //
  // A bracketed IPv6 host keeps its brackets and optional port (`[::1]:3080`).
  // An unbracketed `::1` is a malformed Host header, but Node's HTTP parser
  // accepts it, so treat it as loopback too rather than rejecting it by
  // accident — either way it can only originate from this machine.
  const bracketEnd = rawHost.indexOf(']')
  const bare = rawHost.startsWith('[') && bracketEnd > 0 ? rawHost.slice(0, bracketEnd + 1) : rawHost
  const isLoopbackHost =
    bare === 'localhost' ||
    bare === 'localhost:80' ||
    /^localhost:\d+$/.test(bare) ||
    bare === '127.0.0.1' ||
    /^127\.0\.0\.1:\d+$/.test(bare) ||
    bare === '::1' ||
    bare === '[::1]' ||
    /^\[::1\]:\d+$/.test(bare)
  if (!isLoopbackHost) return false

  const origin = req.headers.origin
  if (origin) {
    try {
      // `new URL()` reports an IPv6 hostname without brackets (`::1`).
      const u = new URL(origin)
      if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) return false
    } catch {
      return false
    }
  }
  return true
}

/**
 * Benchmark results are measured exclusively by this server. Browser clients
 * never contribute numbers — earlier versions accepted "gateway-ping"
 * client-side estimates, which turned out to be name-based fabrications that
 * misled users. Those entries are purged on load, and nothing from a client
 * is accepted anymore.
 */

/** Read JSON request body */
async function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 1048576) reject(new Error('Request body too large'))
    })
    req.on('end', () => {
      try {
        resolve(body.trim() ? JSON.parse(body) : {})
      } catch (err) {
        reject(new Error('Invalid JSON: ' + err.message))
      }
    })
    req.on('error', reject)
  })
}

/** Format a Date in LOCAL time as `YYYY-MM-DD` (never UTC — see localDateStamp). */
function localDateStamp(d) {
  const dt = d instanceof Date ? d : new Date()
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Format a Date in LOCAL time as `YYYY-MM-DD HH:mm`. */
function localDateTimeText(d) {
  const dt = d instanceof Date ? d : new Date()
  return `${localDateStamp(dt)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

/** Load cached or updated leaderboard */
function loadLeaderboard(dataDir) {
  const cachePath = path.resolve(dataDir, 'leaderboard-cache.json')
  try {
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
      if (cached && Array.isArray(cached.models) && cached.models.length > 0) {
        return cached
      }
    }
  } catch {}

  // Nothing cached yet. Never substitute invented numbers: show an empty list
  // and let the first online survey populate it with real benchmark data.
  const now = new Date()
  return {
    updatedAt: now.getTime(),
    surveyDate: localDateStamp(now),
    surveyTimeText: localDateTimeText(now),
    isOnline: false,
    sourceKind: 'pending',
    source: '尚无数据 · 等待首次同步（OpenRouter 模型目录）',
    models: []
  }
}

/** Parse "Anthropic: Claude Opus 5.5" -> { org: 'Anthropic', title: 'Claude Opus 5.5' } */
function splitVendorPrefix(name) {
  const raw = String(name || '').trim()
  const idx = raw.indexOf(':')
  if (idx > 0 && idx < 40) {
    return { org: raw.slice(0, idx).trim(), title: raw.slice(idx + 1).trim() || raw }
  }
  return { org: '', title: raw }
}

/**
 * Build a leaderboard straight from OpenRouter's live model catalogue.
 *
 * Every number here comes from the provider's own `benchmarks` payload
 * (`artificial_analysis.intelligence_index` / `coding_index` / `agentic_index`
 * and the `design_arena` Elo table) — nothing is invented.
 * Entries with no score at all are dropped, so the list is only as long as the
 * real data allows (capped at MAX_LEADERBOARD_ROWS).
 */
const MAX_LEADERBOARD_ROWS = 100
const VARIANT_SUFFIX = /:(batch|free|extended|online|nitro|thinking)$/i

function buildLeaderboardFromOpenRouter(data) {
  const rows = []
  for (const m of Array.isArray(data) ? data : []) {
    if (!m || typeof m.id !== 'string') continue
    if (VARIANT_SUFFIX.test(m.id)) continue

    const aa = m.benchmarks?.artificial_analysis || {}
    const intelligence = typeof aa.intelligence_index === 'number' ? aa.intelligence_index : null
    const coding = typeof aa.coding_index === 'number' ? aa.coding_index : null
    const agentic = typeof aa.agentic_index === 'number' ? aa.agentic_index : null

    const arenaEntries = Array.isArray(m.benchmarks?.design_arena)
      ? m.benchmarks.design_arena.filter(d => d && typeof d.elo === 'number')
      : []
    const bestArena = arenaEntries.length ? arenaEntries.reduce((a, b) => (b.elo > a.elo ? b : a)) : null

    // No real score -> not a leaderboard row
    if (intelligence === null && coding === null && agentic === null && bestArena === null) continue

    const { org, title } = splitVendorPrefix(m.name || m.id)
    const shortId = String(m.id).split('/').pop() || m.id

    rows.push({
      id: m.id,
      name: title,
      org: org || String(m.id).split('/')[0] || '',
      shortId,
      intelligence,
      coding,
      agentic,
      arenaElo: bestArena ? bestArena.elo : null,
      arenaCategory: bestArena ? bestArena.category || null : null,
      context: typeof m.context_length === 'number' ? `${Math.round(m.context_length / 1024)}K` : null,
      pricing: m.pricing?.prompt
        ? {
            prompt: (Number(m.pricing.prompt) * 1e6).toFixed(2),
            completion: m.pricing.completion ? (Number(m.pricing.completion) * 1e6).toFixed(2) : null
          }
        : null,
      description: typeof m.description === 'string' ? m.description.slice(0, 240) : ''
    })
  }

  // Rank by the most authoritative available signal, then by secondary ones
  const key = r => r.intelligence ?? -1
  rows.sort((a, b) => {
    const d = key(b) - key(a)
    if (d !== 0) return d
    const ca = a.coding ?? -1,
      cb = b.coding ?? -1
    if (cb !== ca) return cb - ca
    return (b.arenaElo ?? -1) - (a.arenaElo ?? -1)
  })

  return rows.slice(0, MAX_LEADERBOARD_ROWS).map((r, i) => ({ ...r, rank: i + 1 }))
}

/**
 * Run live daily investigation of the leaderboard.
 *
 * `sourceKind` is the translatable part: the Host has no locale, so it names
 * the *kind* of provenance and the client renders the sentence in the user's
 * UI language. `source` stays as a plain-text fallback for API consumers.
 */
async function surveyDailyLeaderboard(dataDir) {
  const cachePath = path.resolve(dataDir, 'leaderboard-cache.json')
  let models = []
  let isOnline = false
  let sourceKind = 'offline'
  let source = 'OpenRouter 模型目录（离线，无可用榜单数据）'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      signal: controller.signal,
      headers: { 'User-Agent': 'DSH-Model-Master/1.0' }
    })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      const built = buildLeaderboardFromOpenRouter(data && data.data)
      if (built.length > 0) {
        models = built
        isOnline = true
        sourceKind = 'live'
        source = 'OpenRouter 模型目录 · Artificial Analysis 指数 + Design Arena Elo（每日同步）'
      }
    }
  } catch {}

  const now = new Date()
  const payload = {
    updatedAt: now.getTime(),
    surveyDate: localDateStamp(now),
    surveyTimeText: localDateTimeText(now),
    isOnline,
    sourceKind,
    source,
    models
  }

  try {
    const json = JSON.stringify(payload, null, 2)
    // Only touch the disk when the survey actually produced a different snapshot
    let unchanged = false
    try {
      if (fs.existsSync(cachePath)) unchanged = fs.readFileSync(cachePath, 'utf8') === json
    } catch {}
    if (!unchanged) fs.writeFileSync(cachePath, json, 'utf8')
  } catch {}

  return payload
}

/**
 * De-duplicating wrapper around surveyDailyLeaderboard.
 * Concurrent callers share one in-flight outbound request instead of each
 * firing its own copy at openrouter.ai.
 */
let surveyInFlight = null
let surveyLastAt = 0
// When a survey legitimately returns FEWER rows than the cap (upstream simply
// lacks more scored models), remember it so the short-cache staleness rule
// doesn't re-fire an outbound request on every GET — one burst per hour max.
let surveyShortMarkedAt = 0
const SURVEY_MIN_INTERVAL_MS = 60 * 1000
// Even a manual force-refresh keeps a short cooldown so a click-spamming user
// cannot hammer openrouter.ai with back-to-back outbound requests.
const SURVEY_FORCE_MIN_INTERVAL_MS = 10 * 1000

function surveyLeaderboardShared(dataDir, { force = false } = {}) {
  if (surveyInFlight) return surveyInFlight
  const minInterval = force ? SURVEY_FORCE_MIN_INTERVAL_MS : SURVEY_MIN_INTERVAL_MS
  if (Date.now() - surveyLastAt < minInterval) {
    return Promise.resolve(null)
  }
  surveyInFlight = surveyDailyLeaderboard(dataDir)
    .then(result => {
      surveyLastAt = Date.now()
      return result
    })
    .finally(() => {
      surveyInFlight = null
    })
  return surveyInFlight
}

// ── Version update check ─────────────────────────────────────────────────────
//
// The panel can tell the user that a newer release exists. Two rules shape it:
//
//   1. It never invents an answer. When GitHub is unreachable, `hasUpdate` is
//      null and the payload says offline — "unknown" is not "up to date", and
//      reporting an unverified "latest" is exactly the class of lie this plugin
//      refuses to tell about benchmark numbers.
//   2. It stays cheap. GitHub allows 60 unauthenticated requests per hour per
//      IP, so a result is cached for six hours and concurrent callers share one
//      in-flight request — the same shape as the leaderboard survey.

const UPDATE_REPO_SLUG = 'NEETnina/dsh-model-master'
const UPDATE_CACHE_FILE = 'update-check.json'
const UPDATE_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000
// A user-triggered check still keeps a short cooldown so a click-spamming user
// cannot burn the hourly quota in a few seconds.
const UPDATE_FORCE_MIN_INTERVAL_MS = 30 * 1000

/**
 * Read this plugin's own version from the package.json beside it.
 * Returns null rather than guessing when the file is missing or malformed.
 */
function readOwnVersion() {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw)
    const v = typeof pkg.version === 'string' ? pkg.version.trim() : ''
    return v.length > 0 ? v : null
  } catch {
    return null
  }
}

/**
 * Parse a semver-ish string into comparable parts.
 *
 * Accepts an optional leading `v` (GitHub tags carry one) and an optional
 * `-prerelease` suffix. Returns null when the string is not a version at all,
 * so callers can distinguish "older" from "could not tell".
 */
function parseVersion(raw) {
  if (typeof raw !== 'string') return null
  const s = raw.trim().replace(/^v/i, '')
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(s)
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? null
  }
}

/**
 * Compare two version strings.
 * Returns -1 (a older), 0 (equal), 1 (a newer), or null when either side is
 * unparseable. A release outranks its own prereleases, per semver.
 */
function compareVersions(a, b) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return null

  for (const key of ['major', 'minor', 'patch']) {
    if (pa[key] !== pb[key]) return pa[key] < pb[key] ? -1 : 1
  }

  if (pa.prerelease && !pb.prerelease) return -1
  if (!pa.prerelease && pb.prerelease) return 1
  if (pa.prerelease && pb.prerelease) {
    if (pa.prerelease === pb.prerelease) return 0
    return pa.prerelease < pb.prerelease ? -1 : 1
  }
  return 0
}

/** Read the last check result from disk. Returns null when absent or unusable. */
function loadUpdateCache(dataDir) {
  try {
    const cachePath = path.resolve(dataDir, UPDATE_CACHE_FILE)
    if (!fs.existsSync(cachePath)) return null
    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function saveUpdateCache(dataDir, payload) {
  try {
    fs.writeFileSync(path.resolve(dataDir, UPDATE_CACHE_FILE), JSON.stringify(payload, null, 2), 'utf8')
  } catch {}
}

/**
 * Ask GitHub for the newest published release.
 *
 * Never throws and never fabricates: every failure path returns a payload with
 * `hasUpdate: null` and an `error` string the UI can show verbatim.
 */
async function fetchLatestRelease(currentVersion) {
  // Two independent sources, because one is not enough on a filtered network.
  //
  //   api.github.com/repos/.../releases/latest  — richest (notes, date), but
  //     rate-limited to 60/hour unauthenticated and, in practice, the first
  //     thing to be blocked or answered with a stray status.
  //   github.com/.../releases/latest            — a plain 302 to /releases/tag/x.
  //     No API, no quota, no auth: it survives exactly the conditions that
  //     break the first one.
  //
  // Either source answers the only question the UI asks ("is there something
  // newer?"). Only the API can supply notes and a date, so those stay null when
  // the fallback is what answered — a missing field is honest, a guessed one is
  // not.
  let latest = null
  let releaseUrl = null
  let releaseNotes = null
  let publishedAt = null
  let via = null
  const failures = []
  // Set when the API answered 404. Corroborated by a fallback that also finds
  // no tag; overruled by a fallback that does.
  let apiSaidNoRelease = false

  // ── Source 1: the API ──
  {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO_SLUG}/releases/latest`, {
        signal: controller.signal,
        headers: {
          // GitHub rejects requests without one.
          'User-Agent': 'DSH-Model-Master',
          Accept: 'application/vnd.github+json'
        }
      })

      if (res.ok) {
        const data = await res.json()
        const tag = typeof data?.tag_name === 'string' ? data.tag_name.trim().replace(/^v/i, '') : ''
        if (tag) {
          latest = tag
          releaseUrl = typeof data?.html_url === 'string' ? data.html_url : null
          const notes = typeof data?.body === 'string' ? data.body.trim() : ''
          // Trimmed: the UI shows a hint, not a changelog. The link has the rest.
          releaseNotes = notes.length > 0 ? notes.slice(0, 400) : null
          publishedAt = data?.published_at ? Date.parse(data.published_at) || null : null
          via = 'api'
        } else {
          failures.push('release carried no tag')
        }
      } else {
        // A 404 normally means "no published release", but it is NOT taken as
        // final here. On a filtered network api.github.com returns 404 for a
        // repository whose releases are perfectly reachable over plain HTTPS —
        // observed on this very project. So remember it, and let the fallback
        // corroborate or overrule it.
        if (res.status === 404) apiSaidNoRelease = true
        failures.push(
          res.status === 404 ? 'api.github.com reported no release' : `api.github.com responded ${res.status}`
        )
      }
    } catch (err) {
      failures.push(
        err?.name === 'AbortError' ? 'api.github.com timed out' : `api.github.com: ${err?.message || 'request failed'}`
      )
    } finally {
      clearTimeout(timer)
    }
  }

  // ── Source 2: the plain web redirect ──
  if (!latest) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(`https://github.com/${UPDATE_REPO_SLUG}/releases/latest`, {
        signal: controller.signal,
        // Do not follow: the Location header is the answer, and following it
        // would download a whole HTML page for one string.
        redirect: 'manual',
        headers: { 'User-Agent': 'DSH-Model-Master' }
      })
      const location = res.headers.get('location')
      const match = location ? /\/releases\/tag\/([^/?#]+)/.exec(location) : null
      if (match) {
        const tag = decodeURIComponent(match[1]).trim().replace(/^v/i, '')
        if (tag) {
          latest = tag
          releaseUrl = `https://github.com/${UPDATE_REPO_SLUG}/releases/tag/${match[1]}`
          via = 'redirect'
        } else {
          failures.push('release tag was empty')
        }
      } else {
        failures.push(`github.com did not redirect to a tag (HTTP ${res.status})`)
      }
    } catch (err) {
      failures.push(
        err?.name === 'AbortError' ? 'github.com timed out' : `github.com: ${err?.message || 'request failed'}`
      )
    } finally {
      clearTimeout(timer)
    }
  }

  // Neither source produced a tag.
  if (!latest) {
    // A 404 corroborated by a fallback that also found no tag: the repository
    // really has published nothing. Reported as its own kind so the UI can say
    // so rather than blaming the network.
    if (apiSaidNoRelease) {
      return {
        hasUpdate: null,
        latest: null,
        releaseUrl: null,
        releaseNotes: null,
        publishedAt: null,
        sourceKind: 'no-release',
        error: 'No published release found'
      }
    }
    // Otherwise: say we could not tell, and say why for both sources.
    return {
      hasUpdate: null,
      latest: null,
      releaseUrl: null,
      releaseNotes: null,
      publishedAt: null,
      sourceKind: 'offline',
      error: failures.join('; ') || 'Update check failed'
    }
  }

  const cmp = currentVersion ? compareVersions(latest, currentVersion) : null

  if (cmp === null) {
    // A tag we cannot parse is not evidence of anything.
    return {
      hasUpdate: null,
      latest,
      releaseUrl,
      releaseNotes: null,
      publishedAt: null,
      sourceKind: 'unparsable',
      error: `Cannot compare version "${latest}"`
    }
  }

  return {
    hasUpdate: cmp > 0,
    latest,
    releaseUrl,
    releaseNotes,
    publishedAt,
    sourceKind: 'live',
    via,
    error: null
  }
}

let updateInFlight = null
let updateLastAt = 0

/** De-duplicating, rate-limited wrapper around fetchLatestRelease. */
function checkForUpdateShared(dataDir, { force = false, currentVersion = null } = {}) {
  if (updateInFlight) return updateInFlight
  const minInterval = force ? UPDATE_FORCE_MIN_INTERVAL_MS : UPDATE_MIN_INTERVAL_MS
  if (Date.now() - updateLastAt < minInterval) return Promise.resolve(null)

  updateInFlight = fetchLatestRelease(currentVersion)
    .then(result => {
      updateLastAt = Date.now()
      const stamped = { ...result, checkedAt: updateLastAt, currentVersion }
      saveUpdateCache(dataDir, stamped)
      return stamped
    })
    .finally(() => {
      updateInFlight = null
    })
  return updateInFlight
}

/**
 * Assemble the payload the UI renders.
 *
 * `hasUpdate` is a three-state field on purpose: true, false, or null when we
 * genuinely do not know. The client must not collapse null into false — an
 * unverified "you are up to date" is the same class of lie as a fabricated
 * benchmark number.
 */
function resolveUpdatePayload(dataDir) {
  const current = readOwnVersion()
  const cached = loadUpdateCache(dataDir)
  const isFresh = cached && Date.now() - (cached.checkedAt ?? 0) < UPDATE_MIN_INTERVAL_MS

  // Recompute against the version actually installed right now: the user may
  // have updated since this cache was written, which would otherwise keep
  // showing an update badge for a release they already run.
  let hasUpdate = null
  if (cached && typeof cached.latest === 'string' && current) {
    const cmp = compareVersions(cached.latest, current)
    hasUpdate = cmp === null ? null : cmp > 0
  }

  return {
    current,
    latest: cached?.latest ?? null,
    hasUpdate,
    releaseUrl: cached?.releaseUrl ?? null,
    releaseNotes: cached?.releaseNotes ?? null,
    publishedAt: cached?.publishedAt ?? null,
    // 'pending' means "never checked yet"; the UI shows a checking state rather
    // than claiming the install is current.
    sourceKind: cached?.sourceKind ?? 'pending',
    // Which source answered: 'api' or 'redirect'. Useful when a check fails on
    // one path but not the other.
    via: cached?.via ?? null,
    error: cached?.error ?? null,
    checkedAt: cached?.checkedAt ?? null,
    stale: !isFresh
  }
}

/** Read configured providers and models directly from DSH LLM service */
async function getCatalog(llmService, logger) {
  if (!llmService || typeof llmService.listProviders !== 'function') {
    return []
  }
  const providers = llmService.listProviders()
  const valid = (providers || []).filter(p => p && p.id)

  // Fetch every provider in parallel — one slow provider no longer blocks the rest
  const settled = await Promise.allSettled(
    valid.map(async provider => {
      const models = await llmService.listModels(provider.id)
      if (!Array.isArray(models) || models.length === 0) return null
      return {
        id: provider.id,
        name: provider.displayName || provider.name || provider.id,
        models: models.map(m => ({
          id: m.id,
          name: m.name || m.id,
          description: m.description,
          inputModalities: m.inputModalities,
          reasoning: m.reasoning
        }))
      }
    })
  )

  const groups = []
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      if (r.value) groups.push(r.value)
    } else {
      logger?.warn?.(`[model-master] Provider "${valid[i].id}" listing skipped:`, r.reason?.message)
    }
  })
  return groups
}

/**
 * Load saved benchmark results, dropping legacy client-fabricated entries.
 * Returns { results, purged } so the caller can persist the cleaned snapshot.
 */
function loadResults(dataDir) {
  const resPath = path.resolve(dataDir, 'benchmark-results.json')
  try {
    if (fs.existsSync(resPath)) {
      const raw = JSON.parse(fs.readFileSync(resPath, 'utf8'))
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const results = {}
        let purged = 0
        for (const [key, value] of Object.entries(raw)) {
          if (value && value.source === 'gateway-ping') {
            purged++
            continue
          }
          results[key] = value
        }
        return { results, purged }
      }
    }
  } catch {}
  return { results: {}, purged: 0 }
}

/** Save benchmark results (skips the write when nothing changed) */
let lastSavedResultsJson = null
function saveResults(dataDir, results) {
  const resPath = path.resolve(dataDir, 'benchmark-results.json')
  try {
    const json = JSON.stringify(results, null, 2)
    if (json === lastSavedResultsJson) return
    fs.writeFileSync(resPath, json, 'utf8')
    lastSavedResultsJson = json
  } catch (err) {
    console.error('[model-master] Failed to save benchmark results:', err.message)
  }
}

/**
 * Executes ONE live speed benchmark probe against a specific provider & model.
 * Measures Time To First Token (TTFT in ms) and Tokens Per Second (TPS).
 */
async function runProbeOnce(llmService, provider, model) {
  if (!llmService) {
    throw new Error('DSH LLM service is not ready')
  }

  const startTime = performance.now()
  let firstTokenTime = null
  let fullText = ''
  let tokenCount = 0

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s timeout

  try {
    // Prompt is deliberately strict: models like to prefix "We need answer..." filler,
    // which inflates token counts and pollutes TTFT. Ask for output only.
    const promptText =
      'Output exactly this sequence and nothing else, no explanation, no preamble: 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20'
    const messages = [
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: promptText }],
        source: { kind: 'model-master-probe' }
      }
    ]

    let stream = null
    // The effort actually dispatched, so the caller can prove the probe ran at
    // the lowest tier rather than at whatever the host last selected.
    let appliedEffort = null

    /**
     * Pick the lowest reasoning tier the model exposes.
     *
     * Why this matters: DSH's `prepareCall` materializes
     * `requested ?? reasoning.defaultEffort`, so a probe that omits the effort
     * silently inherits the session's current tier (often `high`). A reasoning
     * model would then burn tokens thinking before emitting anything, which
     * inflates TTFT and depresses TPS — the probe would measure the host's
     * selected tier instead of the model's raw streaming speed.
     *
     * `ConfigureCall` hands us the detached model metadata, so the tier is
     * chosen against the model's real table rather than guessed up front.
     */
    const pickProbeEffort = modelInfo => {
      const efforts = Array.isArray(modelInfo?.reasoning?.efforts) ? modelInfo.reasoning.efforts : []
      if (efforts.length === 0) return null
      return typeof efforts[0]?.id === 'string' && efforts[0].id.length > 0 ? efforts[0].id : null
    }

    // Strategy 1: Attempt prepareCall first (native DSH LLM pipeline)
    if (typeof llmService.prepareCall === 'function') {
      try {
        // `configure` receives the detached model metadata and returns the
        // controls to use, so the effort is chosen against the model's real
        // tier table instead of being guessed up front.
        const prepared = await llmService.prepareCall(
          { provider, model, maxTokens: 80 },
          controller.signal,
          (controls, modelInfo) => {
            const effort = pickProbeEffort(modelInfo)
            return effort === null ? controls : { ...controls, reasoningEffort: effort }
          }
        )

        if (prepared && typeof prepared.stream === 'function') {
          appliedEffort = prepared.config?.reasoningEffort ?? null
          stream = prepared.stream({
            ...prepared.config,
            messages,
            signal: controller.signal
          })
        }
      } catch (prepErr) {
        // Fall back to direct stream if prepareCall throws
      }
    }

    // Strategy 2: Direct stream invocation
    if (!stream && typeof llmService.stream === 'function') {
      stream = llmService.stream({
        provider,
        model,
        messages,
        maxTokens: 80,
        signal: controller.signal
      })
    }

    if (!stream) {
      throw new Error(`Cannot start stream for provider "${provider}" model "${model}"`)
    }

    let endTime = null
    let usageTokens = null

    // Extract only non-empty text fragments from a chunk
    const extractText = chunk => {
      if (typeof chunk === 'string') return chunk
      if (typeof chunk.text === 'string' && chunk.text.length > 0) return chunk.text
      if (typeof chunk.delta?.text === 'string' && chunk.delta.text.length > 0) return chunk.delta.text
      if (typeof chunk.delta?.reasoning === 'string' && chunk.delta.reasoning.length > 0) return chunk.delta.reasoning
      return ''
    }

    // Prefer the provider's own token accounting when it reports one
    const extractOutputTokens = chunk => {
      const candidates = [
        chunk.usage?.outputTokens,
        chunk.usage?.completionTokens,
        chunk.usage?.output_tokens,
        chunk.usage?.completion_tokens,
        chunk.delta?.usage?.outputTokens,
        chunk.delta?.usage?.completionTokens,
        chunk.usage?.totalTokens
      ]
      for (const c of candidates) {
        if (typeof c === 'number' && Number.isFinite(c) && c > 0) return c
      }
      return null
    }

    for await (const chunk of stream) {
      if (!chunk) continue

      if (chunk.type === 'finish') {
        if (chunk.reason?.kind === 'error') {
          const failMsg = chunk.reason.failure?.message || chunk.reason.failure?.code || 'Stream error'
          throw new Error(failMsg)
        }
        const reported = extractOutputTokens(chunk)
        if (reported !== null) usageTokens = reported
        // Generation finished — record end time now, not after connection teardown
        if (endTime === null) endTime = performance.now()
        continue
      }

      const reported = extractOutputTokens(chunk)
      if (reported !== null) usageTokens = reported

      const text = extractText(chunk)
      if (text.length > 0) {
        if (firstTokenTime === null) firstTokenTime = performance.now()
        fullText += text
      }
    }

    clearTimeout(timeoutId)
    if (endTime === null) endTime = performance.now()

    if (fullText.trim().length === 0) {
      throw new Error('Model returned an empty response')
    }

    const ttftMs =
      firstTokenTime !== null
        ? Math.max(Math.round(firstTokenTime - startTime), 10)
        : Math.max(Math.round(endTime - startTime), 20)

    const totalDurationMs = Math.round(endTime - startTime)

    // Prefer the provider's reported output tokens; fall back to an estimate.
    const words = fullText.trim().split(/\s+/).filter(Boolean).length
    const estimatedTokens = Math.max(words, Math.round(fullText.length / 3.5))
    tokenCount = usageTokens !== null ? usageTokens : estimatedTokens

    // Generation window = when text started arriving -> when the stream finished.
    // Some providers buffer the whole reply and flush it at once, which makes that
    // window nearly zero and inflates TPS several-fold. Never trust a window shorter
    // than ~1 token-time; fall back to the full round trip instead.
    const rawGenerationSec = (endTime - (firstTokenTime ?? startTime)) / 1000
    const tooBursty = rawGenerationSec < 0.12 && totalDurationMs > 0
    const generationDurationSec = tooBursty ? Math.max(totalDurationMs / 1000, 0.05) : Math.max(rawGenerationSec, 0.05)

    // Ceiling raised to 9999 so fast local models stay distinguishable
    const tps = Math.min(Math.max(Math.round(tokenCount / generationDurationSec), 1), 9999)
    // Dampened TTFT sensitivity: a 2x slower first token costs ~1.41x score, not 2x
    const ttftSec = Math.max(ttftMs / 1000, 0.08)
    const score = Math.round((tps / Math.sqrt(ttftSec / 0.5)) * 10)

    return {
      success: true,
      provider,
      model,
      ttft: ttftMs,
      tps,
      totalDuration: totalDurationMs,
      score,
      tokens: tokenCount,
      tokensFromUsage: usageTokens !== null,
      // Which reasoning tier the probe was dispatched at, so a surprising
      // TTFT can be traced to the tier rather than blamed on the model.
      reasoningEffort: appliedEffort,
      testedAt: Date.now(),
      // Auditable sample, trimmed — lets the UI/console prove what was scored
      sample: fullText.replace(/\s+/g, ' ').trim().slice(0, 120),
      sampleLength: fullText.length
    }
  } catch (err) {
    clearTimeout(timeoutId)
    const isTimeout = controller.signal.aborted
    return {
      success: false,
      provider,
      model,
      ttft: null,
      tps: null,
      score: 0,
      error: isTimeout ? 'Request timed out (20s)' : err.message || 'Probe failed',
      testedAt: Date.now()
    }
  }
}

/** Median of a numeric list (ignores non-finite entries). */
function median(values) {
  const nums = values.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b)
  if (nums.length === 0) return null
  const mid = Math.floor(nums.length / 2)
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid]
}

/**
 * Run one or more probes and report a noise-resistant result.
 *
 * A single probe carries ~17-22% run-to-run variance, which is enough to rank two
 * comparable models backwards. When `samples > 1` we take the median of successful
 * runs so the reported TTFT/TPS/score reflect typical behaviour rather than luck.
 */
async function runProbe(llmService, provider, model, samples = 1) {
  const requested = Math.min(Math.max(Math.trunc(Number(samples)) || 1, 1), 5)
  if (requested === 1) {
    const single = await runProbeOnce(llmService, provider, model)
    return { ...single, samples: 1, successfulSamples: single.success ? 1 : 0 }
  }

  const runs = []
  for (let i = 0; i < requested; i++) {
    // Stop early if the model/provider is clearly broken — no point burning quota
    const r = await runProbeOnce(llmService, provider, model)
    runs.push(r)
    if (!r.success && runs.filter(x => !x.success).length >= 2) break
  }

  const ok = runs.filter(r => r.success)
  if (ok.length === 0) {
    // Every attempt failed: surface the first error, but keep the attempt count visible
    return {
      ...runs[0],
      samples: requested,
      successfulSamples: 0,
      attempts: runs.length
    }
  }

  const ttft = Math.round(median(ok.map(r => r.ttft)))
  const tps = Math.round(median(ok.map(r => r.tps)))
  const score = Math.round(median(ok.map(r => r.score)))
  const tokens = Math.round(median(ok.map(r => r.tokens)))
  const totalDuration = Math.round(median(ok.map(r => r.totalDuration)))

  const representative = ok[Math.floor(ok.length / 2)]
  return {
    success: true,
    provider,
    model,
    ttft,
    tps,
    totalDuration,
    score,
    tokens,
    tokensFromUsage: ok.every(r => r.tokensFromUsage === true),
    samples: requested,
    successfulSamples: ok.length,
    attempts: runs.length,
    ttftSpread: Math.max(...ok.map(r => r.ttft)) - Math.min(...ok.map(r => r.ttft)),
    testedAt: Date.now(),
    sample: representative.sample,
    sampleLength: representative.sampleLength
  }
}

/**
 * Host entry point for Cordis.
 */
export function apply(ctx) {
  const logger = ctx.logger ?? console
  const dataDir = resolveDataDir()
  let leaderboardData = loadLeaderboard(dataDir)
  // An older cache may hold fewer rows than the current cap — top it up at
  // startup instead of waiting for the first GET or tomorrow's refresh.
  if (Array.isArray(leaderboardData.models) && leaderboardData.models.length < MAX_LEADERBOARD_ROWS) {
    surveyLeaderboardShared(dataDir, { force: true })
      .then(fresh => {
        if (fresh) leaderboardData = fresh
      })
      .catch(() => {})
  }
  const loaded = loadResults(dataDir)
  let benchmarkResults = loaded.results
  if (loaded.purged > 0) {
    // Drop client-fabricated "gateway-ping" estimates left behind by older versions
    saveResults(dataDir, benchmarkResults)
    logger.info?.(`[model-master] Purged ${loaded.purged} client-fabricated benchmark entries`)
  }

  function resolveLlm(fallbackCtx) {
    try {
      if (ctx.llm) return ctx.llm
    } catch {}
    try {
      if (fallbackCtx?.llm) return fallbackCtx.llm
    } catch {}
    try {
      const val = ctx.reflect?.get?.('llm', false)
      if (val) return val
    } catch {}
    try {
      const val = ctx.root?.reflect?.get?.('llm', false)
      if (val) return val
    } catch {}
    return null
  }

  /**
   * Read DSH's own persisted default model selection.
   * The Host keeps it in `agentDefaultModel` (backed by the profile config), so we
   * surface it instead of inventing a parallel store of our own.
   */
  function resolveDefaultSelection(searchCtx) {
    const candidates = [searchCtx, ctx, ctx?.root]
    for (const c of candidates) {
      if (!c) continue
      let svc = null
      try {
        svc = (typeof c.get === 'function' ? c.get('agentDefaultModel', false) : null) || c.agentDefaultModel || null
      } catch {}
      if (!svc) {
        try {
          svc = c.reflect?.get?.('agentDefaultModel', false) || null
        } catch {}
      }
      if (svc && typeof svc.currentSelection === 'function') {
        try {
          const sel = svc.currentSelection()
          if (sel && sel.provider && sel.model) {
            return {
              provider: String(sel.provider),
              model: String(sel.model),
              ...(sel.reasoningEffort === undefined ? {} : { reasoningEffort: String(sel.reasoningEffort) })
            }
          }
        } catch {}
      }
    }
    return null
  }

  ctx.inject(['webServer'], scope => {
    const server = scope.webServer
    if (!server) return

    const handler = async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const routePath = url.pathname.replace(/^\/api\/model-master/, '').replace(/\/+$/, '') || '/'
      const method = String(req.method ?? 'GET').toUpperCase()

      const send = (status, payload) => {
        const body = JSON.stringify(payload)
        res.writeHead(status, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*'
        })
        res.end(body)
      }

      if (method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type'
        })
        return res.end()
      }

      if (!isAuthorized(req)) {
        return send(403, { error: 'Forbidden: loopback access only' })
      }

      try {
        // ── Version update check ──
        //
        // Always answers immediately from cache and refreshes in the background,
        // so opening the panel never waits on GitHub. `sourceKind: 'pending'`
        // with `hasUpdate: null` is the honest answer on a cold start.
        if (method === 'GET' && routePath === '/update') {
          const payload = resolveUpdatePayload(dataDir)
          if (payload.stale) {
            // Fire-and-forget: the response is already on its way. The next
            // panel open picks up the refreshed cache.
            checkForUpdateShared(dataDir, { currentVersion: payload.current }).catch(() => {})
          }
          return send(200, payload)
        }

        // Explicit user-triggered check. Awaits the result (unlike GET) so the
        // button can report a real outcome, but keeps a cooldown so repeated
        // clicks cannot exhaust GitHub's hourly quota.
        if (method === 'POST' && routePath === '/update/check') {
          const current = readOwnVersion()
          await checkForUpdateShared(dataDir, { force: true, currentVersion: current })
          return send(200, resolveUpdatePayload(dataDir))
        }

        // ── Native Provider & Model Catalog API ──
        if (method === 'GET' && routePath === '/catalog') {
          const llm = resolveLlm(scope)
          const groups = await getCatalog(llm, logger)
          // Hand back DSH's own persisted default so the UI never falls back to an arbitrary model
          const defaultSelection = resolveDefaultSelection(scope)
          return send(200, { groups, default: defaultSelection })
        }

        // ── Leaderboard API ──
        if (method === 'GET' && routePath === '/leaderboard') {
          // Refresh in the background only when the cached snapshot is stale.
          // The date is LOCAL on both sides, and the shared wrapper de-dupes and
          // rate-limits the outbound request so repeated GETs never re-fetch.
          // A cache shorter than the row cap counts as stale too, so raising
          // MAX_LEADERBOARD_ROWS upgrades an old cache without waiting a day.
          const today = localDateStamp(new Date())
          const shortCache =
            Array.isArray(leaderboardData.models) && leaderboardData.models.length < MAX_LEADERBOARD_ROWS
          const stale =
            !leaderboardData ||
            leaderboardData.surveyDate !== today ||
            leaderboardData.isOnline !== true ||
            (shortCache && Date.now() - surveyShortMarkedAt > 3600 * 1000)
          if (stale) {
            surveyLeaderboardShared(dataDir)
              .then(fresh => {
                if (fresh) {
                  leaderboardData = fresh
                  if (Array.isArray(fresh.models) && fresh.models.length < MAX_LEADERBOARD_ROWS) {
                    surveyShortMarkedAt = Date.now()
                  }
                }
              })
              .catch(() => {})
          }
          return send(200, leaderboardData)
        }

        if (method === 'POST' && routePath === '/leaderboard/refresh') {
          const fresh = await surveyLeaderboardShared(dataDir, { force: true })
          if (fresh) leaderboardData = fresh
          return send(200, leaderboardData)
        }

        // ── Benchmark Results API ──
        if (method === 'GET' && routePath === '/results') {
          return send(200, { results: benchmarkResults })
        }

        // ── Benchmark Results Clear API (one entry, or everything) ──
        // Results are server-measured only; the old client-write endpoint was
        // removed together with the fabricated-estimate fallback.
        if (method === 'POST' && routePath === '/results/clear') {
          const body = await readJson(req).catch(() => ({}))
          if (body && typeof body.key === 'string' && body.key.length > 0 && body.key.length <= 400) {
            const existed = Object.prototype.hasOwnProperty.call(benchmarkResults, body.key)
            if (existed) {
              delete benchmarkResults[body.key]
              saveResults(dataDir, benchmarkResults)
            }
            return send(200, { ok: true, removed: existed ? 1 : 0 })
          }
          const removed = Object.keys(benchmarkResults).length
          benchmarkResults = {}
          saveResults(dataDir, benchmarkResults)
          return send(200, { ok: true, removed })
        }

        // ── Real-Time Benchmark Probe API ──
        if (method === 'POST' && routePath === '/probe') {
          const body = await readJson(req)
          const { provider, model } = body
          if (!provider || !model) {
            return send(400, { error: 'Missing provider or model in request body' })
          }

          const llmService = resolveLlm(scope)
          if (!llmService) {
            return send(200, {
              success: false,
              provider,
              model,
              score: 0,
              error: 'DSH LLM runtime service is not currently available',
              testedAt: Date.now()
            })
          }

          // Optional: how many probes to average (1 = quick, 3 = stable median)
          const samples = Math.min(Math.max(Number(body.samples) || 1, 1), 5)
          const probeResult = await runProbe(llmService, String(provider), String(model), samples)

          // Cache probe result — server-measured results are protected from client overwrite
          const modelKey = `${String(provider).slice(0, 200)}:${String(model).slice(0, 200)}`
          benchmarkResults[modelKey] = { ...probeResult, _measured: true }
          saveResults(dataDir, benchmarkResults)

          return send(200, probeResult)
        }

        return send(404, { error: `Not found: ${routePath}` })
      } catch (err) {
        logger.error?.('[model-master] API handler error:', err)
        return send(500, { error: err.message || 'Internal error' })
      }
    }

    // `webServer.register()` returns the disposer that removes the route. The
    // effect callback must RETURN it: dropping it leaked the route on every
    // plugin reload, and the next registration then threw
    // `webserver: duplicate prefix route "/api/model-master"` (taking the
    // whole host down with it).
    scope.effect(
      () => server.register({ kind: 'prefix', path: '/api/model-master', handler }),
      'model-master: http routes'
    )

    logger.info?.('[model-master] API routes mounted at /api/model-master')
  })
}

// Pure helpers exposed for unit tests (node --test tests/)
export const __internals = {
  buildLeaderboardFromOpenRouter,
  localDateStamp,
  parseVersion,
  compareVersions,
  resolveUpdatePayload,
  fetchLatestRelease,
  UPDATE_MIN_INTERVAL_MS
}

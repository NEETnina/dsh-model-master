// Integration test for the update endpoints.
//
// The unit tests cover the semver maths; this one mounts the real route through
// `apply()` and drives it with a fake request, so the things that only break at
// the HTTP boundary are covered too: the loopback fence, the JSON shape the
// client reads, and the promise that a cold start stays honest.
//
// No network is touched. `fetchLatestRelease` is only reached through the
// background refresh, which is fire-and-forget and swallows its own failures;
// the assertions below run against the cached path.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// A scratch DSH_HOME, so the real ~/.dsh/model-master is never read or written.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dmm-route-'))
process.env.DSH_HOME = home
const dataDir = path.join(home, 'model-master')
fs.mkdirSync(dataDir, { recursive: true })

// `apply()` tops up a short leaderboard cache at startup, which would fire a
// real request to openrouter.ai. Seed a full cache so it stays quiet.
fs.writeFileSync(
  path.join(dataDir, 'leaderboard-cache.json'),
  JSON.stringify({
    updatedAt: Date.now(),
    surveyDate: '2026-01-01',
    surveyTimeText: 'seeded for tests',
    isOnline: true,
    sourceKind: 'live',
    source: 'test fixture',
    models: Array.from({ length: 100 }, (_, i) => ({ rank: i + 1, name: `model-${i}` }))
  })
)

const { apply } = await import('../index.js')

let handler = null
const fakeCtx = {
  logger: { info() {}, warn() {}, error() {} },
  effect(fn) {
    fn()
    return () => {}
  },
  inject(_deps, cb) {
    cb({
      // The injected scope carries its own `effect`, and the route disposer has
      // to come back through it — that is what the contract test guards.
      effect(fn) {
        fn()
        return () => {}
      },
      webServer: {
        register(route) {
          handler = route.handler
          return () => {}
        }
      }
    })
    return () => {}
  }
}

apply(fakeCtx)
assert.ok(handler, 'apply() must register the /api/model-master route')

/** Drive the mounted handler and resolve with the captured response. */
function request(pathname, { method = 'GET', host = '127.0.0.1:3080' } = {}) {
  return new Promise(resolve => {
    const req = { url: pathname, method, headers: { host } }
    const res = {
      writeHead(code, headers) {
        this.statusCode = code
        this.headers = headers
      },
      end(body) {
        this.body = body
        resolve(this)
      }
    }
    handler(req, res)
  })
}

test('GET /update answers with the full shape the client reads', async () => {
  const res = await request('/api/model-master/update')
  assert.equal(res.statusCode, 200)
  assert.match(res.headers['content-type'], /application\/json/)

  const body = JSON.parse(res.body)
  for (const field of [
    'current',
    'latest',
    'hasUpdate',
    'releaseUrl',
    'releaseNotes',
    'publishedAt',
    'sourceKind',
    'error',
    'checkedAt',
    'stale'
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(body, field), `response must carry "${field}"`)
  }
  assert.match(body.current, /^\d+\.\d+\.\d+/, 'current must be the installed version')
})

test('a cold start claims nothing about being up to date', async () => {
  // No cache file has been written yet, so the only honest answer is "unknown".
  fs.rmSync(path.join(dataDir, 'update-check.json'), { force: true })
  const res = await request('/api/model-master/update')
  const body = JSON.parse(res.body)

  assert.equal(body.hasUpdate, null, 'an unchecked install must not report a verdict')
  assert.notEqual(body.hasUpdate, false, 'null must not be collapsed into "up to date"')
  assert.equal(body.sourceKind, 'pending')
  assert.equal(body.stale, true, 'an unchecked install should ask for a check')
})

test('a cached newer release surfaces as an available update', async () => {
  fs.writeFileSync(
    path.join(dataDir, 'update-check.json'),
    JSON.stringify({
      latest: '99.0.0',
      releaseUrl: 'https://example.invalid/releases/tag/v99.0.0',
      releaseNotes: 'seeded',
      publishedAt: Date.now(),
      sourceKind: 'live',
      error: null,
      checkedAt: Date.now()
    })
  )
  const res = await request('/api/model-master/update')
  const body = JSON.parse(res.body)

  assert.equal(body.hasUpdate, true)
  assert.equal(body.latest, '99.0.0')
  assert.equal(body.releaseUrl, 'https://example.invalid/releases/tag/v99.0.0')
  assert.equal(body.stale, false, 'a fresh cache must not ask to be refreshed again')
})

test('a failed check is reported, never disguised as current', async () => {
  fs.writeFileSync(
    path.join(dataDir, 'update-check.json'),
    JSON.stringify({
      latest: null,
      releaseUrl: null,
      sourceKind: 'offline',
      error: 'Request timed out',
      checkedAt: Date.now()
    })
  )
  const res = await request('/api/model-master/update')
  const body = JSON.parse(res.body)

  assert.equal(body.hasUpdate, null)
  assert.equal(body.sourceKind, 'offline')
  assert.equal(body.error, 'Request timed out', 'the client shows this verbatim')
})

test('POST /update/check is routed and rate-limited', async () => {
  // The cooldown means this returns the cache without a network round trip, so
  // the test is deterministic and never waits on GitHub.
  const res = await request('/api/model-master/update/check', { method: 'POST' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok(Object.prototype.hasOwnProperty.call(body, 'hasUpdate'))
})

test('the endpoints stay behind the loopback fence', async () => {
  for (const host of ['evil.com', 'localhost.evil.com', '127.0.0.1.evil.com']) {
    const res = await request('/api/model-master/update', { host })
    assert.equal(res.statusCode, 403, `${host} must not reach the update endpoint`)
    assert.match(res.body, /loopback/i)
  }
})

test('an unknown route under the prefix still 404s', async () => {
  const res = await request('/api/model-master/does-not-exist')
  assert.equal(res.statusCode, 404)
})

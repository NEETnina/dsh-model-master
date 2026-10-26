/**
 * Backend/frontend contract test.
 *
 * The Host (`index.js`) and the client bundle (`client.js`) talk over
 * `/api/model-master`. Neither half would notice if the other drifted — a
 * renamed field simply renders `undefined`. These assertions pin the wire
 * contract from both sides at once.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const HOST = fs.readFileSync(path.join(here, '..', 'index.js'), 'utf8')
const CLIENT = fs.readFileSync(path.join(here, '..', 'client.js'), 'utf8')

/** Every `fetch('/api/model-master/...')` path the client calls. */
function clientRoutes() {
  const routes = new Set()
  for (const m of CLIENT.matchAll(/['"`]\/api\/model-master(\/[a-z/]*)['"`]/g)) routes.add(m[1])
  return routes
}

/** Every `routePath === '...'` the host answers. */
function hostRoutes() {
  const routes = new Set()
  for (const m of HOST.matchAll(/routePath === '([^']*)'/g)) routes.add(m[1])
  return routes
}

test('every client route has a host handler', () => {
  // '/' is the prefix itself and 404s; compare the real endpoints.
  const client = [...clientRoutes()].filter(r => r !== '/')
  const host = hostRoutes()
  assert.ok(client.length > 0, 'client must call at least one route')
  for (const route of client) {
    assert.ok(
      host.has(route),
      `client calls ${route} but the host never answers it (host routes: ${[...host].join(', ')})`
    )
  }
})

test('the probe contract carries the fields the client renders', () => {
  // runProbeOnce / runProbe build these; the client reads them out of
  // benchmarkResults. A rename on either side silently blanks the UI.
  for (const field of ['ttft', 'tps', 'score', 'tokens', 'testedAt', 'success', 'provider', 'model']) {
    assert.ok(HOST.includes(`${field}:`), `probe result must report "${field}"`)
  }
  // Added in 1.6.2 so a surprising TTFT can be traced to the reasoning tier.
  assert.ok(HOST.includes('reasoningEffort: appliedEffort'), 'probe result must report the dispatched effort')
})

test('the leaderboard contract carries the fields the client renders', () => {
  for (const field of ['updatedAt', 'surveyDate', 'surveyTimeText', 'isOnline', 'models']) {
    assert.ok(HOST.includes(field), `leaderboard payload must carry "${field}"`)
  }
  // The translatable provenance kind added in 1.6.2.
  assert.ok(HOST.includes("sourceKind = 'live'"), 'host must classify an online survey as live')
  assert.ok(HOST.includes("sourceKind = 'offline'"), 'host must classify a failed survey as offline')
  assert.ok(HOST.includes("sourceKind: 'pending'"), 'host must classify an empty cache as pending')

  // The client must handle exactly those three kinds.
  for (const kind of ['live', 'offline', 'pending']) {
    assert.ok(CLIENT.includes(`'${kind}'`), `client must branch on sourceKind "${kind}"`)
  }
})

test('the catalog contract matches what the client reads', () => {
  // Host GET /catalog -> { groups, default }; client reads both.
  assert.ok(
    /return send\(200, \{ groups, default: defaultSelection \}\)/.test(HOST),
    'catalog must return { groups, default }'
  )
  assert.ok(CLIENT.includes('Array.isArray(data.groups)'), 'client must read data.groups')
  assert.ok(CLIENT.includes('data.default'), 'client must read data.default')
})

test('the results clear contract agrees on the key field', () => {
  // Client posts { key } to clear one entry; host reads body.key.
  assert.ok(CLIENT.includes('JSON.stringify({ key })'), 'client must post { key }')
  assert.ok(/typeof body\.key === 'string'/.test(HOST), 'host must accept body.key')
})

test('the loopback fence rejects non-loopback hosts', () => {
  // isAuthorized is not exported; re-derive it and exercise the security rule.
  const match = HOST.match(/function isAuthorized\(req\) \{[\s\S]*?\n\}/)
  assert.ok(match, 'isAuthorized must be present')
  // eslint-disable-next-line no-new-func
  const isAuthorized = new Function(`${match[0]}; return isAuthorized;`)()

  const req = (host, origin) => ({ headers: { host, origin } })

  // Loopback spellings that must pass.
  for (const host of ['localhost', 'localhost:3080', '127.0.0.1', '127.0.0.1:3080', '::1', '[::1]:3080']) {
    assert.equal(isAuthorized(req(host, undefined)), true, `${host} should be treated as loopback`)
  }
  // Loopback with a loopback origin.
  assert.equal(isAuthorized(req('127.0.0.1:3080', 'http://127.0.0.1:3080')), true)

  // Look-alike hosts that must be rejected.
  for (const host of ['localhost.evil.com', '127.0.0.1.evil.com', 'evil.com', '', 'example.com:3080']) {
    assert.equal(isAuthorized(req(host, undefined)), false, `${host} must be rejected`)
  }
  // A non-loopback Origin behind a loopback Host must be rejected.
  assert.equal(isAuthorized(req('127.0.0.1:3080', 'http://evil.com')), false)
  // A malformed Origin must be rejected rather than crash.
  assert.equal(isAuthorized(req('127.0.0.1:3080', 'not-a-url')), false)
})

test('the route registration hands its disposer to the effect scope', () => {
  // A dropped disposer leaks the route across HMR reloads and the next
  // registration throws "duplicate prefix route".
  assert.ok(
    /scope\.effect\([\s\S]{0,200}?=> server\.register\(/.test(HOST),
    'scope.effect must return the register() disposer'
  )
})

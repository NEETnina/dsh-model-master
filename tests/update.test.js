// Version update-check behaviour: semver comparison and the honesty rule.
//
// Two things are being pinned here.
//
//   1. Version comparison has to be right in the boring cases, because a wrong
//      verdict is shown to the user as a confident statement about their
//      install. `v1.0.10` vs `v1.0.9` is the classic string-compare trap.
//   2. An unparseable or unreachable answer must stay "unknown". The whole
//      plugin refuses to fabricate benchmark numbers; an update check that
//      reports a made-up "you are up to date" would be the same lie in a
//      different place.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __internals } from '../index.js'

const { parseVersion, compareVersions, resolveUpdatePayload, UPDATE_MIN_INTERVAL_MS } = __internals

const here = path.dirname(fileURLToPath(import.meta.url))
const HOST = fs.readFileSync(path.join(here, '..', 'index.js'), 'utf8')
const CLIENT = fs.readFileSync(path.join(here, '..', 'client.js'), 'utf8')

/** Scratch cache directory, so the real ~/.dsh state is never touched. */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmm-update-'))

test('parses plain, v-prefixed and prerelease versions', () => {
  assert.deepEqual(parseVersion('1.2.3'), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: null
  })
  assert.deepEqual(parseVersion('v1.2.3'), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: null
  })
  assert.deepEqual(parseVersion('1.2.3-rc.1'), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: 'rc.1'
  })
  // Build metadata is ignored, per semver.
  assert.equal(parseVersion('1.2.3+build.9').prerelease, null)
})

test('rejects anything that is not a version', () => {
  for (const bad of ['', 'latest', 'v', '1.2', '1.2.3.4', 'x.y.z', null, undefined, 42, {}]) {
    assert.equal(parseVersion(bad), null, `${JSON.stringify(bad)} must not parse`)
  }
})

test('compares each numeric field, not the whole string', () => {
  // The string-compare trap: "1.0.10" < "1.0.9" lexicographically.
  assert.equal(compareVersions('1.0.10', '1.0.9'), 1)
  assert.equal(compareVersions('1.0.9', '1.0.10'), -1)
  // Same, two fields up.
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1)

  assert.equal(compareVersions('1.0.0', '1.0.1'), -1)
  assert.equal(compareVersions('1.0.1', '1.0.0'), 1)
  assert.equal(compareVersions('1.1.0', '1.0.9'), 1)
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1)
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0)
})

test('a leading v never changes the verdict', () => {
  assert.equal(compareVersions('v1.0.1', '1.0.0'), 1)
  assert.equal(compareVersions('1.0.1', 'v1.0.0'), 1)
  assert.equal(compareVersions('v1.0.0', 'v1.0.0'), 0)
})

test('a release outranks its own prereleases', () => {
  // Per semver: 1.0.0-rc.1 < 1.0.0. Getting this backwards would tell a user
  // on a prerelease that the final release is "older" and hide the update.
  assert.equal(compareVersions('1.0.0-rc.1', '1.0.0'), -1)
  assert.equal(compareVersions('1.0.0', '1.0.0-rc.1'), 1)
  assert.equal(compareVersions('1.0.1-rc.1', '1.0.0'), 1)
  // Two prereleases of the same release compare by suffix.
  assert.equal(compareVersions('1.0.0-rc.1', '1.0.0-rc.2'), -1)
  assert.equal(compareVersions('1.0.0-rc.2', '1.0.0-rc.2'), 0)
})

test('an unparseable side yields no verdict at all', () => {
  // null is the point: the caller must render "unknown", never "up to date".
  assert.equal(compareVersions('1.0.0', 'not-a-version'), null)
  assert.equal(compareVersions('not-a-version', '1.0.0'), null)
  assert.equal(compareVersions('1.0.0', null), null)
  assert.equal(compareVersions(undefined, undefined), null)
})

test('the host never turns a failed check into a confident answer', () => {
  // Every failure path in fetchLatestRelease must report hasUpdate: null.
  const fn = HOST.match(/async function fetchLatestRelease\(currentVersion\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'fetchLatestRelease must be present in index.js')
  const body = fn[0]

  // Count the failure returns: each one must be hasUpdate: null.
  const failureReturns = [...body.matchAll(/hasUpdate:\s*([^,\n]+)/g)].map(m => m[1].trim())
  assert.ok(failureReturns.length >= 4, 'expected several distinct outcomes')
  const nonNull = failureReturns.filter(v => v !== 'null' && v !== 'cmp > 0')
  assert.deepEqual(nonNull, [], `only the success path may compute hasUpdate, found: ${nonNull.join(', ')}`)

  // And the offline/error sourceKinds must be distinct from the live one.
  for (const kind of ['offline', 'no-release', 'unparsable']) {
    assert.ok(body.includes(`sourceKind: '${kind}'`), `fetchLatestRelease must mark "${kind}"`)
  }
})

test('a blocked API falls back to a source that carries no quota', () => {
  // This exists because the API alone proved unreliable in practice: on a
  // filtered network api.github.com answers 404/403 or resets the connection,
  // and the user is told "cannot confirm" for a question that a plain web
  // request answers fine.
  const fn = HOST.match(/async function fetchLatestRelease\(currentVersion\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'fetchLatestRelease must be present')
  const body = fn[0]

  // The fallback hits the human-facing release URL, not the API.
  assert.ok(
    /https:\/\/github\.com\/\$\{UPDATE_REPO_SLUG\}\/releases\/latest/.test(body),
    'the fallback must use the plain github.com release URL'
  )
  // It must not follow the redirect: the Location header is the whole answer,
  // and following it downloads an HTML page for one string.
  assert.ok(/redirect: 'manual'/.test(body), 'the fallback must read the redirect, not follow it')
  // It must parse the tag out of the Location header.
  assert.ok(body.includes('releases\\/tag\\/'), 'the fallback must extract the tag from the redirect target')
  // The fallback runs only when the API produced nothing.
  assert.ok(/if \(!latest\) \{/.test(body), 'the fallback must be gated on the API having failed')
  // It must record which source answered.
  assert.ok(body.includes("via = 'redirect'") && body.includes("via = 'api'"), 'the answering source must be recorded')
})

test('the fallback reports missing fields as missing, not as guesses', () => {
  const fn = HOST.match(/async function fetchLatestRelease\(currentVersion\) \{[\s\S]*?\n\}/)[0]
  // Notes and publishedAt only exist on the API path. When the redirect
  // answered there is nothing truthful to put there, so they stay null.
  assert.ok(
    /releaseNotes = notes\.length > 0 \? notes\.slice\(0, 400\) : null/.test(fn),
    'notes must come only from the API payload'
  )
  const redirectBlock = fn.match(/Source 2[\s\S]*?via = 'redirect'/)
  assert.ok(redirectBlock, 'the redirect block must be identifiable')
  assert.ok(!/releaseNotes\s*=/.test(redirectBlock[0]), 'the redirect path must not invent release notes')
  assert.ok(!/publishedAt\s*=/.test(redirectBlock[0]), 'the redirect path must not invent a publish date')
})

test('the update payload exposes the fields the client renders', () => {
  // Exercise the real assembly rather than matching source text: a renamed
  // field has to fail here, and shorthand properties must not fool the check.
  const payload = resolveUpdatePayload(tmpDir)
  for (const field of [
    'current',
    'latest',
    'hasUpdate',
    'releaseUrl',
    'releaseNotes',
    'publishedAt',
    'sourceKind',
    'via',
    'error',
    'checkedAt',
    'stale'
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(payload, field), `update payload must carry "${field}"`)
  }
  // A cold start has never spoken to GitHub, so it must claim nothing.
  assert.equal(payload.hasUpdate, null, 'a cold start must not claim an update verdict')
  assert.equal(payload.sourceKind, 'pending')
  assert.equal(payload.stale, true, 'a cold start needs a refresh')
})

test('a cached check is recomputed against the installed version', () => {
  // The bug this guards: the user updates, but the cached "newer release
  // exists" keeps showing a badge for a release they already run.
  const current = resolveUpdatePayload(tmpDir).current
  assert.ok(current, 'the package version must be readable')

  const write = (latest, extra = {}) =>
    fs.writeFileSync(
      path.join(tmpDir, 'update-check.json'),
      JSON.stringify({
        latest,
        hasUpdate: true,
        releaseUrl: 'https://example.invalid/release',
        sourceKind: 'live',
        checkedAt: Date.now(),
        ...extra
      })
    )

  // Cache claims an update, and it really is newer -> still an update.
  write('99.0.0')
  assert.equal(resolveUpdatePayload(tmpDir).hasUpdate, true)

  // Cache claims an update, but the installed version caught up -> no update,
  // even though the stored `hasUpdate: true` says otherwise.
  write(current)
  assert.equal(resolveUpdatePayload(tmpDir).hasUpdate, false, 'a caught-up install must clear the badge')

  // Negative case: an older tag in the cache is not an update either.
  write('0.0.1')
  assert.equal(resolveUpdatePayload(tmpDir).hasUpdate, false)

  // An unparseable tag must stay unknown rather than defaulting to false.
  write('not-a-version')
  assert.equal(resolveUpdatePayload(tmpDir).hasUpdate, null, 'an unparsable tag is unknown, not "current"')

  // A stale cache asks for a refresh; a fresh one does not.
  write('99.0.0', { checkedAt: Date.now() - UPDATE_MIN_INTERVAL_MS - 1000 })
  assert.equal(resolveUpdatePayload(tmpDir).stale, true, 'an expired cache must be refreshed')
  write('99.0.0')
  assert.equal(resolveUpdatePayload(tmpDir).stale, false, 'a fresh cache must not re-request')
})

test('a fallback-sourced answer expires sooner than an API one', () => {
  // GitHub's web cache lags the API: measured right after a release, the API
  // already reported v1.1.2 while github.com still redirected to v1.1.1. A
  // lagging answer can only under-report, so it is re-asked an hour in rather
  // than being trusted for six.
  const current = resolveUpdatePayload(tmpDir).current
  const writeWith = (via, ageMs) =>
    fs.writeFileSync(
      path.join(tmpDir, 'update-check.json'),
      JSON.stringify({
        latest: current,
        hasUpdate: false,
        sourceKind: 'live',
        via,
        checkedAt: Date.now() - ageMs
      })
    )

  const twoHours = 2 * 60 * 60 * 1000

  // Two hours old: fine for an API answer, already stale for a redirect one.
  writeWith('api', twoHours)
  assert.equal(resolveUpdatePayload(tmpDir).stale, false, 'an API answer is good for six hours')

  writeWith('redirect', twoHours)
  assert.equal(resolveUpdatePayload(tmpDir).stale, true, 'a fallback answer must expire after an hour')

  // And the payload reports which source it came from.
  writeWith('redirect', 0)
  const payload = resolveUpdatePayload(tmpDir)
  assert.equal(payload.via, 'redirect')
  assert.equal(payload.stale, false, 'a brand-new fallback answer is still current')
})

test('the client treats null hasUpdate as unknown, not as up to date', () => {
  // The render must branch on `=== true` / `=== false` rather than truthiness,
  // otherwise null (unknown) renders as "up to date".
  assert.ok(CLIENT.includes('info?.hasUpdate === true'), 'client must test hasUpdate === true for the update badge')
  assert.ok(
    CLIENT.includes('info?.hasUpdate === false'),
    'client must test hasUpdate === false before claiming the install is current'
  )
  // The unknown copy must exist in every language, and must not read as "current".
  const unknownKeys = (CLIENT.match(/updateUnknownTip:/g) || []).length
  assert.equal(unknownKeys, 15, 'every language needs an explicit unknown string')
})

test('all seven update strings exist in all fifteen languages', () => {
  for (const key of [
    'updateBadge',
    'updateAvailableTip',
    'updateChecking',
    'updateUpToDate',
    'updateUnknownTip',
    'updateBtnTitle',
    'updateReleaseNotes'
  ]) {
    const n = (CLIENT.match(new RegExp(`${key}:`, 'g')) || []).length
    assert.equal(n, 15, `${key} must be present in all 15 dictionaries, found ${n}`)
  }
})

test('the outbound GitHub request is de-duplicated and rate-limited', () => {
  // 60 unauthenticated requests per hour per IP: an unguarded check on every
  // panel open would burn that in minutes.
  assert.ok(HOST.includes('UPDATE_MIN_INTERVAL_MS'), 'a minimum interval must exist')
  assert.ok(HOST.includes('if (updateInFlight) return updateInFlight'), 'concurrent callers must share one request')
  assert.ok(
    /Date\.now\(\) - updateLastAt < minInterval/.test(HOST),
    'the interval must actually gate the outbound request'
  )
  // A user-triggered check gets its own, shorter cooldown rather than none.
  assert.ok(HOST.includes('UPDATE_FORCE_MIN_INTERVAL_MS'), 'force must keep its own cooldown')
})

test('the check does not block opening the panel', () => {
  // GET /update must answer from cache and refresh in the background; only the
  // explicit POST /update/check is allowed to await the network.
  const getBlock = HOST.match(/routePath === '\/update'\)[\s\S]*?return send\(200, payload\)/)
  assert.ok(getBlock, 'GET /update handler must be present')
  assert.ok(!/await/.test(getBlock[0]), 'GET /update must not await the outbound request')

  const postBlock = HOST.match(/routePath === '\/update\/check'\)[\s\S]*?return send\(200, resolveUpdatePayload/)
  assert.ok(postBlock, 'POST /update/check handler must be present')
  assert.ok(/await/.test(postBlock[0]), 'POST /update/check is expected to await a real answer')
})

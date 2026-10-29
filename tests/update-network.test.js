// Network behaviour of the release lookup, with the network stubbed.
//
// The unit tests above cover version maths; this file covers what actually
// happened in the field: `api.github.com` answered 404 for this machine while
// the release was perfectly reachable over plain HTTPS. The lookup therefore
// has two sources, and these tests pin that the second one is really consulted
// and that it never invents the fields only the first one can supply.
//
// `fetch` is replaced for the duration of each test, so nothing here touches
// the network and the assertions are deterministic.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __internals } from '../index.js'

const { fetchLatestRelease } = __internals

const realFetch = globalThis.fetch

/** Install a fetch stub for one test; returns the recorded request URLs. */
function withFetch(handler) {
  const seen = []
  globalThis.fetch = async (url, options = {}) => {
    seen.push(String(url))
    return handler(String(url), options)
  }
  return seen
}

const jsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => payload
})

/** A 302 with a Location header, as github.com answers for /releases/latest. */
const redirectResponse = location => ({
  ok: false,
  status: 302,
  headers: { get: name => (String(name).toLowerCase() === 'location' ? location : null) },
  json: async () => {
    throw new Error('a redirect has no JSON body')
  }
})

test('the API is the preferred source and supplies notes and a date', async () => {
  const seen = withFetch(() =>
    jsonResponse(200, {
      tag_name: 'v9.9.9',
      html_url: 'https://github.com/x/y/releases/tag/v9.9.9',
      body: 'notes here',
      published_at: '2026-10-30T00:00:00Z'
    })
  )
  try {
    const r = await fetchLatestRelease('1.0.0')
    assert.equal(r.hasUpdate, true)
    assert.equal(r.latest, '9.9.9', 'the leading v must be stripped for comparison')
    assert.equal(r.via, 'api')
    assert.equal(r.releaseNotes, 'notes here')
    assert.equal(typeof r.publishedAt, 'number')
    assert.equal(r.sourceKind, 'live')
    assert.equal(seen.length, 1, 'the fallback must not run when the API answered')
    assert.ok(seen[0].includes('api.github.com'))
  } finally {
    globalThis.fetch = realFetch
  }
})

test('a failing API falls through to the plain redirect', async () => {
  // The exact field failure: the API answers a stray status, github.com does not.
  const seen = withFetch(url =>
    url.includes('api.github.com')
      ? jsonResponse(404, { message: 'Not Found' })
      : redirectResponse('https://github.com/x/y/releases/tag/v1.1.1')
  )
  try {
    const r = await fetchLatestRelease('1.0.0')
    assert.equal(r.hasUpdate, true, 'the fallback must still produce a verdict')
    assert.equal(r.latest, '1.1.1')
    assert.equal(r.via, 'redirect')
    assert.equal(r.sourceKind, 'live')
    // The link points at this project's release, built from the real slug and
    // the tag read out of the redirect.
    assert.ok(r.releaseUrl.endsWith('/releases/tag/v1.1.1'), `unexpected url: ${r.releaseUrl}`)
    assert.ok(r.releaseUrl.includes('github.com/NEETnina/dsh-model-master'))
    // Fields the redirect cannot know must stay null rather than be guessed.
    assert.equal(r.releaseNotes, null)
    assert.equal(r.publishedAt, null)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('a non-404 API error also falls through', async () => {
  const seen = withFetch(url =>
    url.includes('api.github.com')
      ? jsonResponse(403, { message: 'rate limited' })
      : redirectResponse('https://github.com/x/y/releases/tag/v2.0.0')
  )
  try {
    const r = await fetchLatestRelease('1.1.1')
    assert.equal(r.latest, '2.0.0')
    assert.equal(r.via, 'redirect')
    assert.equal(r.hasUpdate, true)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('a network throw on the API still falls through', async () => {
  withFetch(url => {
    if (url.includes('api.github.com')) throw new Error('ECONNRESET')
    return redirectResponse('https://github.com/x/y/releases/tag/v3.0.0')
  })
  try {
    const r = await fetchLatestRelease('1.0.0')
    assert.equal(r.latest, '3.0.0')
    assert.equal(r.via, 'redirect')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('both sources failing reports offline with both reasons', async () => {
  withFetch(url => {
    if (url.includes('api.github.com')) return jsonResponse(500, {})
    throw new Error('also down')
  })
  try {
    const r = await fetchLatestRelease('1.0.0')
    assert.equal(r.hasUpdate, null, 'two failures are still not a verdict')
    assert.equal(r.sourceKind, 'offline')
    assert.ok(r.error.includes('api.github.com'), 'the API reason must be reported')
    assert.ok(r.error.includes('github.com'), 'the fallback reason must be reported')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('a spurious 404 is overruled by the fallback', async () => {
  // This is the field failure that motivated the fallback: api.github.com
  // answered 404 while the release was reachable over plain HTTPS. A 404 must
  // therefore not be taken as final.
  const seen = withFetch(url =>
    url.includes('api.github.com')
      ? jsonResponse(404, { message: 'Not Found' })
      : redirectResponse('https://github.com/x/y/releases/tag/v1.1.1')
  )
  try {
    const r = await fetchLatestRelease('1.0.0')
    assert.equal(seen.length, 2, 'a 404 must still be corroborated, not trusted')
    assert.equal(r.hasUpdate, true, 'the release exists and the verdict must say so')
    assert.equal(r.latest, '1.1.1')
    assert.equal(r.via, 'redirect')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('a 404 corroborated by the fallback means nothing was published', async () => {
  // Both sources agree there is no tag, so "no release" is the honest answer.
  const seen = withFetch(url =>
    url.includes('api.github.com') ? jsonResponse(404, { message: 'Not Found' }) : jsonResponse(404, {})
  )
  try {
    const r = await fetchLatestRelease('1.0.0')
    assert.equal(seen.length, 2)
    assert.equal(r.hasUpdate, null)
    assert.equal(r.sourceKind, 'no-release')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('a redirect that does not point at a tag is a failure, not a guess', async () => {
  withFetch(url =>
    url.includes('api.github.com') ? jsonResponse(500, {}) : redirectResponse('https://github.com/x/y/releases')
  )
  try {
    const r = await fetchLatestRelease('1.0.0')
    assert.equal(r.hasUpdate, null)
    assert.equal(r.sourceKind, 'offline')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('an unparsable tag from either source stays unknown', async () => {
  withFetch(() => jsonResponse(200, { tag_name: 'nightly', html_url: null, body: '', published_at: null }))
  try {
    const r = await fetchLatestRelease('1.0.0')
    assert.equal(r.hasUpdate, null, '"nightly" is not a version and cannot be compared')
    assert.equal(r.sourceKind, 'unparsable')
    assert.equal(r.latest, 'nightly')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('the installed version decides the verdict, including no update', async () => {
  withFetch(() => jsonResponse(200, { tag_name: 'v1.1.1', html_url: 'u', body: '', published_at: null }))
  try {
    const same = await fetchLatestRelease('1.1.1')
    assert.equal(same.hasUpdate, false, 'running the latest release is not an update')
    const older = await fetchLatestRelease('1.1.0')
    assert.equal(older.hasUpdate, true)
    const newer = await fetchLatestRelease('2.0.0')
    assert.equal(newer.hasUpdate, false, 'a local build ahead of the release is not an update')
  } finally {
    globalThis.fetch = realFetch
  }
})

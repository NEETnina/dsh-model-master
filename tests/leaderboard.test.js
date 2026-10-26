import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __internals } from '../index.js'

const { buildLeaderboardFromOpenRouter } = __internals

const model = (id, overrides = {}) => ({
  id,
  name: id,
  context_length: 131072,
  ...overrides
})

test('drops models without any real benchmark score', () => {
  const rows = buildLeaderboardFromOpenRouter([
    model('a/unscored'),
    model('b/scored', { benchmarks: { artificial_analysis: { intelligence_index: 50 } } })
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 'b/scored')
})

test('drops cheap variant suffixes like :free / :batch', () => {
  const rows = buildLeaderboardFromOpenRouter([
    model('a/thing:free', { benchmarks: { artificial_analysis: { intelligence_index: 99 } } }),
    model('a/thing', { benchmarks: { artificial_analysis: { intelligence_index: 42 } } })
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 'a/thing')
})

test('keeps models whose only score is a Design Arena Elo', () => {
  const rows = buildLeaderboardFromOpenRouter([
    model('a/arena-only', {
      benchmarks: {
        design_arena: [
          { elo: 1300, category: '3d' },
          { elo: 1400, category: 'web' }
        ]
      }
    })
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].arenaElo, 1400)
  assert.equal(rows[0].arenaCategory, 'web')
})

test('sorts by intelligence index descending and assigns sequential ranks', () => {
  const rows = buildLeaderboardFromOpenRouter([
    model('a/low', { benchmarks: { artificial_analysis: { intelligence_index: 10 } } }),
    model('a/high', { benchmarks: { artificial_analysis: { intelligence_index: 90 } } }),
    model('a/mid', { benchmarks: { artificial_analysis: { intelligence_index: 50 } } })
  ])
  assert.deepEqual(
    rows.map(r => r.id),
    ['a/high', 'a/mid', 'a/low']
  )
  assert.deepEqual(
    rows.map(r => r.rank),
    [1, 2, 3]
  )
})

test('caps the leaderboard at 100 rows', () => {
  const data = Array.from({ length: 120 }, (_, i) =>
    model(`a/m${i}`, { benchmarks: { artificial_analysis: { intelligence_index: i } } })
  )
  const rows = buildLeaderboardFromOpenRouter(data)
  assert.equal(rows.length, 100)
  // The strongest 100 survive
  assert.equal(rows[0].id, 'a/m119')
  assert.equal(rows[99].id, 'a/m20')
})

test('formats context length to K and pricing per million tokens', () => {
  const rows = buildLeaderboardFromOpenRouter([
    model('a/priced', {
      context_length: 998400,
      pricing: { prompt: '0.000004', completion: '0.00002' },
      benchmarks: { artificial_analysis: { intelligence_index: 55 } }
    })
  ])
  assert.equal(rows[0].context, '975K')
  assert.equal(rows[0].pricing.prompt, '4.00')
  assert.equal(rows[0].pricing.completion, '20.00')
})

test('splits "Vendor: Title" display names', () => {
  const rows = buildLeaderboardFromOpenRouter([
    model('v/scored', {
      name: 'Anthropic: Claude Opus 5.5',
      benchmarks: { artificial_analysis: { intelligence_index: 57 } }
    })
  ])
  assert.equal(rows[0].org, 'Anthropic')
  assert.equal(rows[0].name, 'Claude Opus 5.5')
})

test('tolerates null and non-array inputs', () => {
  assert.deepEqual(buildLeaderboardFromOpenRouter(null), [])
  assert.deepEqual(buildLeaderboardFromOpenRouter(undefined), [])
  assert.deepEqual(buildLeaderboardFromOpenRouter([null, 42, 'x']), [])
})

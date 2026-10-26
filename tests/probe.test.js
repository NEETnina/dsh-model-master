// Probe behaviour tests: effort selection, TTFT/TPS accounting, failure honesty.
import { test } from 'node:test'
import assert from 'node:assert/strict'

// The probe path is not exported, so re-derive the pure tier picker from index.js
// source and exercise it directly. This keeps the contract testable without a
// live LLM service.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, '..', 'index.js'), 'utf8')

const pickSource = source.match(/const pickProbeEffort = [\s\S]*?\n    \}/)
assert.ok(pickSource, 'pickProbeEffort must be present in index.js')
// eslint-disable-next-line no-new-func
const pickProbeEffort = new Function(`${pickSource[0]}; return pickProbeEffort;`)()

test('picks the lowest reasoning tier when the model exposes tiers', () => {
  const modelInfo = { reasoning: { efforts: [{ id: 'off' }, { id: 'low' }, { id: 'high' }] } }
  assert.equal(pickProbeEffort(modelInfo), 'off')
})

test('returns null when the model has no reasoning support', () => {
  assert.equal(pickProbeEffort({}), null)
  assert.equal(pickProbeEffort({ reasoning: {} }), null)
  assert.equal(pickProbeEffort(null), null)
  assert.equal(pickProbeEffort(undefined), null)
})

test('returns null for an empty or malformed tier table', () => {
  assert.equal(pickProbeEffort({ reasoning: { efforts: [] } }), null)
  assert.equal(pickProbeEffort({ reasoning: { efforts: [{ id: '' }] } }), null)
  assert.equal(pickProbeEffort({ reasoning: { efforts: [{ name: 'High' }] } }), null)
})

test('probe never silently inherits the hosted default tier', () => {
  // The bug this guards: omitting the effort lets DSH materialize
  // `requested ?? reasoning.defaultEffort`, so a probe ran at the session's
  // current tier. The configure callback must always override it.
  const modelInfo = { reasoning: { efforts: [{ id: 'low' }, { id: 'max' }], defaultEffort: 'max' } }
  const chosen = pickProbeEffort(modelInfo)
  assert.equal(chosen, 'low')
  assert.notEqual(chosen, modelInfo.reasoning.defaultEffort)
})

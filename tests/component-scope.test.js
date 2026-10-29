// Component wiring test.
//
// Why this exists: `client.js` holds two very large components —
// `ModelMasterComposerSeatInner` (state owner) and `ModelMasterSpotlightModal`
// (presentation, receives props). A name that lives in the parent's scope and is
// used inside the modal compiles fine, passes `node --check`, and passes the
// import-time smoke test — because nothing renders the component. It only fails
// in the browser, on open, as a ReferenceError.
//
// That is not hypothetical: the header's update badge was first written that
// way, referencing `updateInfo` from the parent's scope. Every existing test was
// green. This file is the guard that was missing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const CLIENT = fs.readFileSync(path.join(here, '..', 'client.js'), 'utf8')

/**
 * Extract a function's source by name, matching braces while skipping strings,
 * template literals, regex-ish slashes and comments. Naive brace counting is not
 * enough here: the file is full of template literals containing `${...}`.
 */
function extractFunction(src, name) {
  const start = src.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`function ${name} not found`)

  // Walk past the parameter list first. The signature destructures an object,
  // so the first `{` belongs to the parameters, not the body — matching from
  // there would close on `})` and return only the signature.
  const parenOpen = src.indexOf('(', start)
  let depth = 0
  let i = parenOpen
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') {
      depth--
      if (depth === 0) break
    }
  }
  const braceOpen = src.indexOf('{', i)
  if (braceOpen < 0) throw new Error(`no body for ${name}`)

  depth = 0
  i = braceOpen
  let mode = 'code'
  while (i < src.length) {
    const c = src[i]
    const next = src[i + 1]

    if (mode === 'code') {
      if (c === '/' && next === '/') {
        mode = 'line-comment'
        i += 2
        continue
      }
      if (c === '/' && next === '*') {
        mode = 'block-comment'
        i += 2
        continue
      }
      if (c === "'") {
        mode = 'single'
        i++
        continue
      }
      if (c === '"') {
        mode = 'double'
        i++
        continue
      }
      if (c === '`') {
        mode = 'template'
        i++
        continue
      }
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) return src.slice(start, i + 1)
      }
      i++
      continue
    }

    // Inside a string / template / comment: only look for the terminator.
    if (mode === 'line-comment') {
      if (c === '\n') mode = 'code'
      i++
      continue
    }
    if (mode === 'block-comment') {
      if (c === '*' && next === '/') {
        mode = 'code'
        i += 2
        continue
      }
      i++
      continue
    }
    if (mode === 'single' || mode === 'double') {
      if (c === '\\') {
        i += 2
        continue
      }
      if ((mode === 'single' && c === "'") || (mode === 'double' && c === '"')) mode = 'code'
      i++
      continue
    }
    if (mode === 'template') {
      if (c === '\\') {
        i += 2
        continue
      }
      // Nested `${ ... }` blocks may contain their own braces and strings; the
      // simple terminator scan below is enough because none of the plugin's
      // templates nest another template inside an interpolation.
      if (c === '`') mode = 'code'
      i++
      continue
    }
    i++
  }
  throw new Error(`unbalanced braces in ${name}`)
}

/** Destructured parameter names of a component function. */
function destructuredProps(fnSource) {
  const m = fnSource.match(/^function\s+\w+\s*\(\s*\{([\s\S]*?)\}\s*\)\s*\{/)
  if (!m) return new Set()
  return new Set(
    m[1]
      .split(',')
      .map(s => s.split('=')[0].split(':')[0].trim())
      .filter(Boolean)
  )
}

/** Names bound by a hook call inside a component body, e.g. `const [a, setA] = useState(`. */
function hookBoundNames(fnSource, hooks = ['useState', 'useCallback', 'useMemo', 'useRef']) {
  const names = new Set()
  const re =
    /const\s*(\[[^\]]*\]|\w+)\s*=\s*(?:React\.)?(useState|useCallback|useMemo|useRef|useSyncExternalStore)\s*\(/g
  let m
  while ((m = re.exec(fnSource))) {
    if (!hooks.includes(m[2])) continue
    for (const part of m[1].replace(/[[\]]/g, '').split(',')) {
      const n = part.trim()
      if (n) names.add(n)
    }
  }
  return names
}

/**
 * Reduce a function body to its executable code: comments and the literal parts
 * of strings and template literals are blanked, while `${...}` interpolations
 * are kept — the update badge names its state inside one, so discarding template
 * literals wholesale would hide exactly what this test looks for.
 */
function codeView(body) {
  let out = ''
  let i = 0
  const N = body.length
  const blank = c => (c === '\n' ? '\n' : ' ')

  while (i < N) {
    const c = body[i]
    const next = body[i + 1]

    if (c === '/' && next === '/') {
      while (i < N && body[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < N && !(body[i] === '*' && body[i + 1] === '/')) {
        out += blank(body[i])
        i++
      }
      i += 2
      continue
    }
    if (c === "'" || c === '"') {
      const quote = c
      out += ' '
      i++
      while (i < N) {
        if (body[i] === '\\') {
          out += '  '
          i += 2
          continue
        }
        if (body[i] === quote) {
          out += ' '
          i++
          break
        }
        out += blank(body[i])
        i++
      }
      continue
    }
    if (c === '`') {
      out += ' '
      i++
      while (i < N) {
        if (body[i] === '\\') {
          out += '  '
          i += 2
          continue
        }
        if (body[i] === '`') {
          out += ' '
          i++
          break
        }
        if (body[i] === '$' && body[i + 1] === '{') {
          // Keep the interpolation: it is real code.
          out += '${'
          i += 2
          let depth = 1
          while (i < N && depth > 0) {
            if (body[i] === '{') depth++
            else if (body[i] === '}') {
              depth--
              if (depth === 0) break
            }
            out += body[i]
            i++
          }
          out += '}'
          i++
          continue
        }
        out += blank(body[i])
        i++
      }
      continue
    }

    out += c
    i++
  }
  return out
}

/** Names the function binds itself: params, `const`/`let`/`var`, `function`. */
function locallyBoundNames(fnSource) {
  const code = codeView(fnSource)
  const names = new Set()

  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  // `const [a, setA] = ...` and `const { x, y } = ...`
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\[([^\]]*)\]/g)) {
    for (const part of m[1].split(',')) {
      const n = part.split('=')[0].trim()
      if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n)
    }
  }
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.split(':').pop().split('=')[0].trim()
      if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n)
    }
  }
  for (const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  // Parameters of the function itself and of nested arrows.
  for (const m of code.matchAll(/\(([^()]*)\)\s*=>/g)) {
    for (const part of m[1].split(',')) {
      const n = part.split('=')[0].trim()
      if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n)
    }
  }
  for (const m of code.matchAll(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) names.add(m[1])
  return names
}

/** Every identifier-looking token in a body, minus property accesses. */
function identifiers(body) {
  const found = new Set()
  for (const m of codeView(body).matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)/g)) found.add(m[1])
  return found
}

const PARENT = 'ModelMasterComposerSeatInner'
const MODAL = 'ModelMasterSpotlightModal'

const parentSrc = extractFunction(CLIENT, PARENT)
const modalSrc = extractFunction(CLIENT, MODAL)
const modalProps = destructuredProps(modalSrc)
const parentHooks = hookBoundNames(parentSrc)

test('the modal reads parent state through props, never through scope', () => {
  assert.ok(modalProps.size > 0, 'the modal must destructure props')
  const used = identifiers(modalSrc)
  const local = locallyBoundNames(modalSrc)

  // Any name that is hook state in the parent and also appears in the modal must
  // have arrived as a prop — unless the modal binds a name of its own, which
  // shadows nothing and is legitimate.
  const leaked = [...parentHooks].filter(n => used.has(n) && !modalProps.has(n) && !local.has(n))
  assert.deepEqual(
    leaked,
    [],
    `the modal uses parent-scope state without a prop: ${leaked.join(', ')} — ` +
      'add them to the destructured props and pass them at the render site'
  )
})

test('the update badge takes its state from props', () => {
  // Pin the specific wiring that broke, so a future edit cannot quietly
  // reintroduce a bare reference.
  for (const prop of ['updateInfo', 'updateChecking', 'onCheckUpdate']) {
    assert.ok(modalProps.has(prop), `the modal must declare the "${prop}" prop`)
    assert.ok(modalSrc.includes(prop), `the modal must use "${prop}"`)
  }
  // The handler is owned by the parent; the modal only calls it — it must never
  // reference the parent's own function name.
  assert.ok(modalSrc.includes('await onCheckUpdate()'), 'the modal must invoke the injected handler')
  assert.ok(!/\bhandleCheckUpdate\b/.test(modalSrc), 'the modal must not reference the parent handler by name')
})

test('a manual check always reports its outcome to the user', () => {
  // The first version of this button was a no-op from the user's side: pressing
  // it changed nothing on screen unless a newer release existed, so it read as
  // broken. Every branch of the handler must surface something.
  const handler = modalSrc.match(/onClick:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\n\s{22}\}/)
  assert.ok(handler, 'the check button must own an async click handler')
  const body = handler[0]

  const toasts = (body.match(/showToast\(/g) || []).length
  assert.ok(toasts >= 3, `every outcome needs a toast, found ${toasts}`)
  // The three-state verdict must be branched on explicitly, not by truthiness.
  assert.ok(/hasUpdate === true/.test(body), 'the handler must branch on hasUpdate === true')
  assert.ok(/hasUpdate === false/.test(body), 'the handler must branch on hasUpdate === false')
  // A null verdict must still say something.
  assert.ok(/updateUnknownTip/.test(body), 'the unknown verdict must be reported')
})

test('the button shows progress while a check is in flight', () => {
  // Immediate feedback: the label switches while awaiting the host.
  assert.ok(
    /updateChecking \? t\('updateChecking'\) : t\('updateBtnTitle'\)/.test(modalSrc),
    'the label must change while checking'
  )
})

test('every update string with a placeholder is called with its argument', () => {
  // A missing param does not throw: `t()` leaves `{0}` in place and the user sees
  // the literal placeholder. That happened to the "up to date" tooltip once the
  // string gained a version slot, and nothing failed — it was only visible in a
  // browser. Each of these strings must always be called with params.
  const withPlaceholder = [
    'updateBadge', // 有新版本 {0}
    'updateAvailableTip', // 发现新版本 {0}，点击查看
    'updateUpToDate' // 已是最新版本 {0}
  ]

  for (const key of withPlaceholder) {
    // the dictionary entry really does contain a placeholder
    const dictEntry = new RegExp(`${key}: '[^']*\\{0\\}`)
    assert.ok(dictEntry.test(CLIENT), `${key} is expected to contain {0}`)

    // and every call site passes one
    const calls = [...modalSrc.matchAll(new RegExp(`t\\('${key}'(\\s*,\\s*\\[[^\\]]*\\])?`, 'g'))]
    assert.ok(calls.length > 0, `${key} must be used in the modal`)
    const missing = calls.filter(c => !c[1])
    assert.equal(
      missing.length,
      0,
      `${key} is called without params at ${missing.length} site(s); {0} would render literally`
    )
  }
})

test('every prop the modal declares is actually passed at the render site', () => {
  const callMatch = CLIENT.match(/h\(ModelMasterSpotlightModal,\s*\{([\s\S]*?)\}\s*\)/)
  assert.ok(callMatch, 'the modal render site must be present')
  const passed = new Set(
    callMatch[1]
      .split('\n')
      // Shorthand props carry no colon and a trailing comma: `benchmarkResults,`
      .map(l => l.trim().replace(/,$/, '').split(':')[0].trim())
      .filter(l => /^[A-Za-z_$][\w$]*$/.test(l))
  )

  const missing = [...modalProps].filter(p => !passed.has(p))
  assert.deepEqual(missing, [], `declared but never passed: ${missing.join(', ')}`)

  const extra = [...passed].filter(p => !modalProps.has(p))
  assert.deepEqual(extra, [], `passed but never declared: ${extra.join(', ')}`)
})

test('the parent owns the update state and the fetch', () => {
  // The state, the cache read and the manual check all belong to the state
  // owner; the modal stays presentational.
  assert.ok(/const \[updateInfo/.test(parentSrc), 'the parent must own updateInfo')
  assert.ok(/const \[updateChecking/.test(parentSrc), 'the parent must own updateChecking')
  assert.ok(/handleCheckUpdate = useCallback/.test(parentSrc), 'the parent must own the check handler')
  assert.ok(parentSrc.includes("'/api/model-master/update'"), 'the parent must read the cached snapshot')
  assert.ok(parentSrc.includes("'/api/model-master/update/check'"), 'the parent must be able to force a check')
})

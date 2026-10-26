/**
 * Import-time smoke test for client.js.
 *
 * The plugin is a `window.__ModuleLoader__.load({id, factory})` bundle, so a
 * throw anywhere inside the factory happens during *materialization* — before
 * any React component renders — and takes the whole Web bundle down with it
 * ("HARNESS Failed to load plugins", black screen). That is exactly what
 * shipped in v1.6.0/v1.6.1.
 *
 * This test executes the real factory against a minimal DOM + React stub and
 * asserts the observable contract a broken build would violate:
 *   - the factory materializes without throwing,
 *   - it exports apply / inject / name,
 *   - it injects its <style> tag during materialization,
 *   - every i18n dictionary has the same key set (no missing translation),
 *   - the persisted language is actually honoured (the v1.6.1 regression).
 *
 * The stub is deliberately small: it is just enough surface for this plugin's
 * module-level code, not a DOM implementation.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_PATH = path.join(here, '..', 'client.js')
const source = fs.readFileSync(CLIENT_PATH, 'utf8')

// ── minimal DOM / browser stub ───────────────────────────────────────────────

function makeDom() {
  const registry = new Map()
  const makeEl = tag => {
    const el = {
      tagName: String(tag).toUpperCase(),
      nodeType: 1,
      id: '',
      className: '',
      textContent: '',
      innerHTML: '',
      style: { setProperty() {}, removeProperty() {} },
      dataset: {},
      children: [],
      childNodes: [],
      parentNode: null,
      _attrs: {},
      setAttribute(k, v) {
        this._attrs[k] = String(v)
        if (k === 'id') this.id = String(v)
      },
      getAttribute(k) {
        return this._attrs[k] ?? null
      },
      removeAttribute(k) {
        delete this._attrs[k]
      },
      hasAttribute(k) {
        return k in this._attrs
      },
      appendChild(c) {
        c.parentNode = this
        this.children.push(c)
        this.childNodes.push(c)
        if (c.id) registry.set(c.id, c)
        return c
      },
      insertBefore(c) {
        return this.appendChild(c)
      },
      removeChild(c) {
        for (const list of [this.children, this.childNodes]) {
          const i = list.indexOf(c)
          if (i >= 0) list.splice(i, 1)
        }
        return c
      },
      remove() {
        this.parentNode?.removeChild(this)
      },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      closest: () => null,
      contains: () => false,
      focus() {},
      blur() {},
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 120, height: 28, right: 120, bottom: 28, x: 0, y: 0 }
      },
      getClientRects: () => [],
      cloneNode() {
        return makeEl(tag)
      }
    }
    return el
  }

  const head = makeEl('head')
  const body = makeEl('body')
  const documentElement = makeEl('html')
  documentElement.appendChild(head)
  documentElement.appendChild(body)

  const document = {
    nodeType: 9,
    head,
    body,
    documentElement,
    readyState: 'complete',
    activeElement: body,
    createElement: t => makeEl(t),
    createElementNS: (_ns, t) => makeEl(t),
    createTextNode: t => ({ nodeType: 3, textContent: t }),
    createDocumentFragment: () => makeEl('fragment'),
    getElementById: id => registry.get(id) ?? null,
    querySelector: sel => {
      // Honour the exact selectors this plugin uses for style de-duplication.
      const pluginCss = /^style\[data-plugin-css="(.+)"\]$/.exec(sel)
      if (pluginCss) {
        return head.children.find(c => c.tagName === 'STYLE' && c._attrs['data-plugin-css'] === pluginCss[1]) ?? null
      }
      const plugin = /^style\[data-plugin="(.+)"\]$/.exec(sel)
      if (plugin) {
        return head.children.find(c => c.tagName === 'STYLE' && c._attrs['data-plugin'] === plugin[1]) ?? null
      }
      if (sel === 'style:not([data-plugin])') {
        return head.children.filter(c => c.tagName === 'STYLE' && !('data-plugin' in c._attrs))
      }
      return null
    },
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true
    }
  }

  return { document, head, body, registry, makeEl }
}

function makeReact() {
  const createElement = (type, props, ...children) => ({
    $$typeof: 'element',
    type,
    props: { ...(props || {}), children },
    key: props?.key ?? null
  })
  const React = {
    createElement,
    Fragment: Symbol('Fragment'),
    StrictMode: Symbol('StrictMode'),
    version: '18.2.0',
    useState: init => [typeof init === 'function' ? init() : init, () => {}],
    useEffect() {},
    useLayoutEffect() {},
    useMemo: fn => fn(),
    useRef: value => ({ current: value }),
    useCallback: fn => fn,
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    useReducer: (_reducer, initial) => [initial, () => {}],
    useId: () => 'id',
    useTransition: () => [false, fn => fn()],
    useDeferredValue: v => v,
    useImperativeHandle() {},
    memo: c => c,
    forwardRef: c => c,
    createContext: value => ({ Provider: 'Provider', Consumer: 'Consumer', _currentValue: value }),
    createRef: () => ({ current: null }),
    Children: { map: () => [], toArray: () => [], only: c => c, count: () => 0 },
    isValidElement: e => Boolean(e) && e.$$typeof === 'element',
    cloneElement: e => e,
    Component: class Component {
      constructor(props) {
        this.props = props
      }
      setState() {}
      render() {
        return null
      }
    },
    PureComponent: class PureComponent {
      constructor(props) {
        this.props = props
      }
    }
  }
  const ReactDOM = {
    version: '18.2.0',
    createRoot: () => ({ render() {}, unmount() {} }),
    createPortal: node => node,
    flushSync: fn => fn()
  }
  return { React, ReactDOM }
}

/** Materialize client.js exactly as the DSH client module loader would. */
function materialize({ savedLanguage = null } = {}) {
  const dom = makeDom()
  const { React, ReactDOM } = makeReact()

  const store = savedLanguage ? { dsh_model_master_lang: savedLanguage } : {}
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v)
    },
    removeItem: k => {
      delete store[k]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    }
  }

  const sandboxWindow = {
    document: dom.document,
    localStorage,
    location: { href: 'http://127.0.0.1:3080/', origin: 'http://127.0.0.1:3080', hostname: '127.0.0.1', pathname: '/' },
    navigator: { userAgent: 'node', language: 'zh-CN', languages: ['zh-CN'] },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: fn => setTimeout(fn, 0),
    cancelAnimationFrame: id => clearTimeout(id)
  }

  let registered = null
  sandboxWindow.__ModuleLoader__ = {
    load(registration) {
      registered = registration
    }
  }

  class MutationObserver {
    observe() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }

  const sandbox = vm.createContext({
    window: sandboxWindow,
    document: dom.document,
    localStorage,
    MutationObserver,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    console,
    fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type
        this.detail = init?.detail
      }
    },
    KeyboardEvent: class KeyboardEvent {
      constructor(type, init) {
        this.type = type
        Object.assign(this, init)
      }
    },
    MouseEvent: class MouseEvent {
      constructor(type, init) {
        this.type = type
        Object.assign(this, init)
      }
    },
    queueMicrotask
  })
  // The factory also reaches for these as bare globals.
  sandbox.globalThis = sandbox

  vm.runInContext(source, sandbox, { filename: CLIENT_PATH })

  assert.ok(registered, 'client.js must register itself via window.__ModuleLoader__.load()')
  assert.equal(typeof registered.factory, 'function', 'the registration must carry a factory function')

  const stubRequire = spec => {
    if (spec === 'react') return React
    if (spec === 'react-dom') return ReactDOM
    if (spec === 'react-dom/client') return ReactDOM
    if (spec === 'react/jsx-runtime') {
      return { jsx: createElement, jsxs: createElement, Fragment: React.Fragment }
    }
    throw new Error(`client.js required an unstubbed module: ${spec}`)
  }

  const exports = registered.factory(stubRequire)
  return { registered, exports, head: dom.head }
}

// ── tests ───────────────────────────────────────────────────────────────────

test('client.js materializes without throwing', () => {
  const { registered, exports } = materialize()
  assert.equal(registered.id, 'dsh-model-master')
  assert.equal(typeof exports, 'object')
})

test('exports the plugin contract DSH needs', () => {
  const { exports } = materialize()
  assert.equal(typeof exports.apply, 'function', 'exports.apply must be a function')
  assert.equal(exports.name, 'dsh-model-master', 'exports.name must match the plugin id')
  assert.ok(Array.isArray(exports.inject), 'exports.inject must be an array')
  for (const service of ['slots', 'sessions', 'remote', 'remote.session', 'modelDirectories']) {
    assert.ok(exports.inject.includes(service), `inject must declare ${service}`)
    // Cordis treats an undeclared service access as a hard error, so these must
    // stay in sync with what the EffortFX directory access actually reads.
  }
})

test('injects its stylesheet during materialization', () => {
  const { head } = materialize()
  const styles = head.children.filter(c => c.tagName === 'STYLE')
  assert.ok(styles.length > 0, 'at least one <style> tag must be injected at import time')
})

test('apply() survives a host without a webServer slot', () => {
  // The host mounts the launcher before any slot registration; a throw here
  // would surface as a broken composer rather than a missing panel.
  const { exports } = materialize()
  assert.doesNotThrow(() => {
    exports.apply({
      get: () => null,
      inject: (_deps, fn) => fn({ webServer: null }),
      slots: undefined,
      effect: () => {},
      logger: { info() {}, warn() {}, error() {} }
    })
  })
})

test('the persisted language is honoured on boot', () => {
  // Regression: the restore used to run while I18N was still undefined, so
  // I18N_HAS always answered false and every saved language reverted to zh.
  // Evaluate the i18n region in isolation to read the language it resolves to.
  const src = fs.readFileSync(CLIENT_PATH, 'utf8')
  const start = src.indexOf('var UI_LANG_KEY')
  const end = src.indexOf('// ── Styles (Scoped CSS')
  assert.ok(start > 0 && end > start, 'the i18n region must be locatable')
  const region = src.slice(start, end)

  const resolve = saved => {
    const store = saved ? { dsh_model_master_lang: saved } : {}
    const sandbox = {
      localStorage: {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => {
          store[k] = String(v)
        }
      }
    }
    return vm.runInNewContext(`${region}\n;({ uiLang, title: t('title') })`, sandbox)
  }

  // Default and unsupported codes fall back to zh.
  assert.equal(resolve(null).uiLang, 'zh')
  assert.equal(resolve('xx').uiLang, 'zh')

  // Every real saved code is restored, and t() follows it.
  const expected = { en: 'Select Model', zh: '模型选择', ja: 'モデル選択', ko: '모델 선택', tr: 'Model Seç' }
  for (const [code, title] of Object.entries(expected)) {
    const resolved = resolve(code)
    assert.equal(resolved.uiLang, code, `saved language "${code}" must be restored`)
    assert.equal(resolved.title, title, `t('title') must follow "${code}"`)
  }
})

test('every i18n dictionary carries the same key set as zh', () => {
  const src = fs.readFileSync(CLIENT_PATH, 'utf8')
  const start = src.indexOf('var I18N_ZH = {')
  const end = src.indexOf('// ── Styles (Scoped CSS')
  assert.ok(start > 0 && end > start, 'the i18n block must be locatable')

  const block = src.slice(start, end)
  const I18N = vm.runInNewContext(`${block}\n;I18N`, {})
  const languages = Object.keys(I18N)
  assert.equal(languages.length, 15, '15 UI languages are expected')
  assert.ok(languages.includes('zh'))

  const baseKeys = Object.keys(I18N.zh)
  assert.ok(baseKeys.length > 100, 'the zh base dictionary must be substantial')

  for (const lang of languages) {
    const keys = Object.keys(I18N[lang])
    const missing = baseKeys.filter(k => !(k in I18N[lang]))
    assert.deepEqual(missing, [], `[${lang}] is missing keys: ${missing.join(', ')}`)
    // A value that embeds a `, key: '` fragment means two entries were merged
    // into one string by a botched edit, silently dropping a key.
    for (const [key, value] of Object.entries(I18N[lang])) {
      assert.equal(typeof value, 'string', `[${lang}] ${key} must be a string`)
      assert.doesNotMatch(value, /['"]\s*,\s*[A-Za-z_$][\w$]*\s*:\s*['"]/, `[${lang}] ${key} swallowed a sibling key`)
    }
  }
})

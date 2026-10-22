/**
 * Unit tests for the routing core — no network, no DSH.
 *
 * Run with the runtime the Desktop app uses:
 *   node --test test/
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'

import {
  DIRECT,
  INHERIT,
  describeRoutes,
  isLoopback,
  normalizeConfig,
  normalizeHostname,
  resolveDecision,
  resolveHost,
  resolveModel,
  wrapWithStore,
} from '../core.js'

/** Collect diagnostics instead of printing them. */
function collector() {
  const messages = []
  return { messages, report: (message) => messages.push(message) }
}

test('an empty configuration is valid and inherits the process policy', () => {
  const routes = normalizeConfig({})
  assert.deepEqual(routes, { fallback: INHERIT, hosts: [], models: [] })
  assert.equal(normalizeConfig(undefined).fallback, INHERIT)
})

test('providers become host rules, with optional ports', () => {
  const routes = normalizeConfig({
    providers: {
      corp: { hosts: ['corp.example'], proxy: 'direct' },
      gateway: { hosts: ['Gateway.Example', '[::1]:8443'], proxy: 'http://127.0.0.1:1301' },
    },
  })
  assert.equal(routes.hosts.length, 3)
  assert.equal(resolveHost(routes, 'gateway.example', '443').kind, 'proxy')
  assert.equal(resolveHost(routes, 'api.gateway.example', '443').uri, 'http://127.0.0.1:1301')
  assert.equal(resolveHost(routes, 'notgateway.example', '443'), undefined)
  assert.equal(resolveHost(routes, '::1', '8443').kind, 'proxy')
  assert.equal(resolveHost(routes, '::1', '443'), undefined)
})

test('models are keyed by id or trailing-* prefix, and may pin a provider', () => {
  const routes = normalizeConfig({
    models: {
      'deepseek-v4.1-flash': 'http://127.0.0.1:1291',
      'muse-spark-1.3-contributor': 'direct',
      'longcat-*': 'inherit',
      'alpha': { proxy: 'http://127.0.0.1:1281', provider: 'opencode-go' },
    },
  })
  assert.equal(resolveModel(routes, 'opencode-go', 'deepseek-v4.1-flash').uri, 'http://127.0.0.1:1291')
  assert.equal(resolveModel(routes, undefined, 'muse-spark-1.3-contributor'), DIRECT)
  assert.equal(resolveModel(routes, 'opencode-go', 'longcat-2.5-preview-free'), INHERIT)
  assert.equal(resolveModel(routes, 'opencode-go', 'alpha').uri, 'http://127.0.0.1:1281')
  assert.equal(resolveModel(routes, 'corp', 'alpha'), undefined, 'a pinned provider must not leak')
  assert.equal(resolveModel(routes, undefined, 'qwen'), undefined)
})

test('exact model rules outrank wildcards, and provider-pinned exact rules outrank bare ones', () => {
  const routes = normalizeConfig({
    models: {
      'gamma': 'http://bare-exact',
      'gam*': { proxy: 'http://wildcard', provider: 'p' },
      'p/delta': 'http://ignored-key',
      'delta': { proxy: 'http://pinned-exact', provider: 'p' },
      'delta*': { proxy: 'http://pinned-wildcard', provider: 'p' },
    },
  })
  assert.equal(resolveModel(routes, 'p', 'gamma').uri, 'http://bare-exact')
  assert.equal(resolveModel(routes, 'p', 'delta').uri, 'http://pinned-exact')
  assert.equal(resolveModel(routes, 'p', 'delta-2').uri, 'http://pinned-wildcard')
  assert.equal(resolveModel(routes, 'other', 'delta'), undefined, 'a pinned rule must not apply to another provider')
})

test('the model axis outranks the host axis, and the fallback comes last', () => {
  const routes = normalizeConfig({
    default: 'direct',
    providers: { api: { hosts: ['api.example'], proxy: 'http://host-proxy' } },
    models: { 'm': 'http://model-proxy' },
  })
  const url = new URL('https://api.example/v1')
  assert.equal(resolveDecision(routes, { provider: 'p', model: 'm' }, url).uri, 'http://model-proxy')
  assert.equal(resolveDecision(routes, { provider: 'p', model: 'other' }, url).uri, 'http://host-proxy')
  assert.equal(resolveDecision(routes, undefined, new URL('https://elsewhere.example/')).kind, 'direct')
})

test('loopback and local names are recognised', () => {
  for (const host of ['localhost', '127.0.0.1', '127.10.0.9', '::1', '[::1]', '0.0.0.0', '::ffff:127.0.0.1']) {
    assert.equal(isLoopback(host), true, host)
  }
  for (const host of ['example.com', '128.0.0.1', 'local']) {
    assert.equal(isLoopback(host), false, host)
  }
})

test('hostnames are normalized for matching', () => {
  assert.equal(normalizeHostname('API.Example.COM.'), 'api.example.com')
  assert.equal(normalizeHostname('[::1]'), '::1')
})

test('invalid entries refuse the whole configuration and report every problem', () => {
  const { messages, report } = collector()
  const routes = normalizeConfig(
    {
      default: 'socks5://127.0.0.1:1080',
      providers: {
        broken: { hosts: [], proxy: 'direct' },
        badhost: { hosts: ['https://evil.example'], proxy: 'direct' },
      },
      models: {
        'x': 42,
        '': 'direct',
        'y': 'http://:bad',
      },
    },
    report,
  )
  assert.equal(routes, undefined)
  assert.ok(messages.some((message) => message.includes('not supported')), messages.join('\n'))
  assert.ok(messages.some((message) => message.includes('hosts')))
  assert.ok(messages.some((message) => message.includes('URL')))
})

test('describeRoutes renders a readable one-liner', () => {
  const routes = normalizeConfig({
    providers: { corp: { hosts: ['corp.example'], proxy: 'direct' } },
    models: { 'm': 'http://127.0.0.1:1291' },
  })
  assert.equal(describeRoutes(routes), 'm→http://127.0.0.1:1291, corp.example→direct, default→inherit')
})

test('wrapWithStore makes the provider/model pair visible during every pull', async () => {
  const als = new AsyncLocalStorage()
  const seen = []

  async function* stream() {
    await Promise.resolve()
    seen.push(als.getStore())
    yield 1
    seen.push(als.getStore())
    yield 2
  }

  const store = { provider: 'opencode-go', model: 'alpha' }
  for await (const value of wrapWithStore(stream(), als, store)) {
    assert.ok(value === 1 || value === 2)
    assert.equal(als.getStore(), undefined, 'the store must not leak into the consumer')
  }
  assert.deepEqual(seen, [store, store])
  assert.equal(als.getStore(), undefined, 'the store does not leak afterwards')
})

test('concurrent streams keep their own store', async () => {
  const als = new AsyncLocalStorage()
  const observed = []

  async function* stream(model) {
    await new Promise((resolve) => setTimeout(resolve, model === 'a' ? 5 : 1))
    observed.push(als.getStore().model)
    yield model
  }

  await Promise.all([
    (async () => {
      for await (const value of wrapWithStore(stream('a'), als, { provider: 'p', model: 'a' })) assert.equal(value, 'a')
    })(),
    (async () => {
      for await (const value of wrapWithStore(stream('b'), als, { provider: 'p', model: 'b' })) assert.equal(value, 'b')
    })(),
  ])
  assert.deepEqual(observed.sort(), ['a', 'b'])
})

test('wrapWithStore propagates early return to the underlying stream', async () => {
  const als = new AsyncLocalStorage()
  let finalized = false

  async function* stream() {
    try {
      yield 1
      yield 2
    } finally {
      finalized = true
    }
  }

  const iterator = wrapWithStore(stream(), als, { provider: 'p', model: 'm' })[Symbol.asyncIterator]()
  await iterator.next()
  await iterator.return()
  assert.equal(finalized, true)
})

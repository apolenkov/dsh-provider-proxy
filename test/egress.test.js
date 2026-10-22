/**
 * Egress tests: the dispatcher is installed as the process global dispatcher and
 * Node's built-in `fetch` must reach the configured proxy. The proxy is a local
 * HTTP proxy that records CONNECT targets and refuses the tunnel, so no DNS or TLS
 * leaves the machine.
 *
 * Run with the runtime the Desktop app uses:
 *   node --test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { AsyncLocalStorage } from 'node:async_hooks'

import * as undici from 'undici'

import { collectProxyUris, createRoutingDispatcher, installRoutes, normalizeConfig } from '../core.js'

/** Start a recording HTTP proxy that refuses every CONNECT. */
async function startProxy() {
  const seen = []
  const server = http.createServer((request, response) => {
    response.statusCode = 502
    response.end()
  })
  server.on('connect', (request, socket) => {
    seen.push(request.url)
    socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    socket.destroy()
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return {
    seen,
    uri: `http://127.0.0.1:${port}`,
    async close() {
      server.closeAllConnections?.()
      await new Promise((resolve) => server.close(resolve))
    },
  }
}

/**
 * Install a routing dispatcher for one test and restore the global one afterwards.
 * @param {object} config - plugin config.
 * @param {(context: {als: AsyncLocalStorage<object>}) => Promise<void>} run - test body.
 * @param {object} [options] - `previous` stands in for the dispatcher the launcher installed.
 */
async function withDispatcher(config, run, options = {}) {
  const routes = normalizeConfig(config)
  assert.notEqual(routes, undefined, 'configuration must be valid')
  const als = new AsyncLocalStorage()
  const previous = options.previous ?? new undici.Agent()
  const ownsPrevious = options.previous === undefined
  const dispatcher = createRoutingDispatcher({ undici, previous, routes, als })
  const global = undici.getGlobalDispatcher()
  undici.setGlobalDispatcher(dispatcher)
  try {
    await run({ als })
  } finally {
    undici.setGlobalDispatcher(global)
    await dispatcher.close()
    if (ownsPrevious) await previous.close().catch(() => {})
  }
}

test('a model rule sends the fetch through its proxy even without a host rule', async () => {
  const proxy = await startProxy()
  try {
    await withDispatcher({ models: { alpha: proxy.uri } }, async ({ als }) => {
      await assert.rejects(als.run({ provider: 'opencode-go', model: 'alpha' }, () => fetch('https://alpha.test/')))
      assert.deepEqual(proxy.seen, ['alpha.test:443'])
    })
  } finally {
    await proxy.close()
  }
})

test('a model rule wins over the host rule for the same request', async () => {
  const proxy = await startProxy()
  try {
    const config = {
      providers: { api: { hosts: ['alpha.test'], proxy: 'http://127.0.0.1:9' } },
      models: { alpha: proxy.uri },
    }
    await withDispatcher(config, async ({ als }) => {
      await assert.rejects(als.run({ provider: 'p', model: 'alpha' }, () => fetch('https://alpha.test/')))
      assert.deepEqual(proxy.seen, ['alpha.test:443'], 'the model rule, not the dead host rule, must route it')
    })
  } finally {
    await proxy.close()
  }
})

test('a host rule routes traffic that has no model context', async () => {
  const proxy = await startProxy()
  try {
    const config = { providers: { api: { hosts: ['host-rule.test'], proxy: proxy.uri } } }
    await withDispatcher(config, async () => {
      await assert.rejects(fetch('https://host-rule.test/'))
      assert.deepEqual(proxy.seen, ['host-rule.test:443'])
    })
  } finally {
    await proxy.close()
  }
})

test('direct and unmatched traffic never reaches the proxy', async () => {
  const proxy = await startProxy()
  try {
    const config = { default: 'inherit', models: { beta: 'direct' } }
    await withDispatcher(config, async ({ als }) => {
      await assert.rejects(als.run({ provider: 'p', model: 'beta' }, () => fetch('http://beta.test/')))
      await assert.rejects(fetch('https://unmatched.test/'))
      assert.equal(proxy.seen.length, 0)
    })
  } finally {
    await proxy.close()
  }
})

test('concurrent model streams keep their own route', async () => {
  const proxy = await startProxy()
  try {
    const config = { models: { alpha: proxy.uri, beta: 'direct' } }
    await withDispatcher(config, async ({ als }) => {
      const results = await Promise.allSettled([
        als.run({ provider: 'p', model: 'alpha' }, () => fetch('https://alpha.test/')),
        als.run({ provider: 'p', model: 'beta' }, () => fetch('http://beta.test/')),
        als.run({ provider: 'p', model: 'alpha' }, () => fetch('https://alpha-2.test/')),
      ])
      assert.equal(results.every((result) => result.status === 'rejected'), true)
      assert.deepEqual(proxy.seen.sort(), ['alpha-2.test:443', 'alpha.test:443'])
    })
  } finally {
    await proxy.close()
  }
})

test('the harness policy keeps deciding inherited traffic', async () => {
  const proxy = await startProxy()
  try {
    const previous = new undici.ProxyAgent({ uri: proxy.uri })
    await withDispatcher({ default: 'inherit' }, async () => {
      await assert.rejects(fetch('https://inherit.test/'))
      assert.deepEqual(proxy.seen, ['inherit.test:443'])
    }, { previous })
  } finally {
    await proxy.close()
  }
})

test('loopback stays direct even when a rule names it', async () => {
  const proxy = await startProxy()
  try {
    const config = { providers: { api: { hosts: ['127.0.0.1'], proxy: proxy.uri } } }
    const server = http.createServer((request, response) => response.end('ok'))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address()
    try {
      await withDispatcher(config, async () => {
        const response = await fetch(`http://127.0.0.1:${port}/`)
        assert.equal(await response.text(), 'ok')
        assert.equal(proxy.seen.length, 0)
      })
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  } finally {
    await proxy.close()
  }
})

test('a removed proxy rule stops receiving traffic and its agent is closed', async () => {
  const proxyA = await startProxy()
  const proxyB = await startProxy()
  // Wrap, do not subclass: undici's DispatcherBase.close(cb) calls this.close(cb),
  // so overriding `close` on a subclass recurses forever.
  const closed = []
  class SpyProxyAgent {
    constructor(options) {
      this.inner = new undici.ProxyAgent(options)
      this.proxyUri = options.uri
    }

    dispatch(options, handler) {
      return this.inner.dispatch(options, handler)
    }

    async close() {
      closed.push(this.proxyUri)
      return this.inner.close()
    }

    destroy() {
      return this.inner.destroy()
    }
  }
  const als = new AsyncLocalStorage()
  const routes = normalizeConfig({ models: { alpha: proxyA.uri } })
  assert.notEqual(routes, undefined)
  const previous = new undici.Agent()
  const dispatcher = createRoutingDispatcher({
    undici: { ...undici, ProxyAgent: SpyProxyAgent },
    previous,
    routes,
    als,
  })
  const global = undici.getGlobalDispatcher()
  undici.setGlobalDispatcher(dispatcher)
  try {
    await assert.rejects(als.run({ provider: 'p', model: 'alpha' }, () => fetch('https://alpha.test/')))
    assert.deepEqual(proxyA.seen, ['alpha.test:443'])
    const next = normalizeConfig({ models: { alpha: proxyB.uri } })
    assert.notEqual(next, undefined)
    installRoutes(routes, next)
    await dispatcher.prune(collectProxyUris(routes))
    assert.deepEqual(closed, [proxyA.uri])
    await assert.rejects(als.run({ provider: 'p', model: 'alpha' }, () => fetch('https://alpha.test/')))
    assert.deepEqual(proxyB.seen, ['alpha.test:443'])
    assert.equal(proxyA.seen.length, 1)
  } finally {
    undici.setGlobalDispatcher(global)
    await dispatcher.close()
    await previous.close()
    await proxyA.close()
    await proxyB.close()
  }
})

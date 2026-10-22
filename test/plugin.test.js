/**
 * Wiring test for the plugin entry: `apply` installs a dispatcher, the `llm/stream`
 * listener opens the model store for the adapter's pulls, and the disposer restores
 * the previous global dispatcher.
 *
 * A fake Cordis context stands in for the harness; the real `undici` module is
 * used.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as undici from 'undici'

import { Config, apply } from '../index.js'

/** Keep the plugin's diagnostics out of the real `$DSH_HOME`. */
const stateDirectory = mkdtempSync(join(tmpdir(), 'dsh-provider-proxy-test-'))
process.env.DSH_PROVIDER_PROXY_STATE = stateDirectory
test.after(() => rmSync(stateDirectory, { recursive: true, force: true }))

/** A Cordis context with only what the plugin touches. */
function fakeContext() {
  const lines = []
  const listeners = new Map()
  let disposer
  return {
    lines,
    get listener() {
      return listeners.get('llm/stream')
    },
    get updateListener() {
      return listeners.get('loader/volatile-update')
    },
    ctx: {
      logger: () => ({
        info: (message, ...args) => lines.push(['info', message, ...args]),
        warn: (message, ...args) => lines.push(['warn', message, ...args]),
        error: (message, ...args) => lines.push(['error', message, ...args]),
      }),
      on: (event, callback) => {
        assert.ok(event === 'llm/stream' || event === 'loader/volatile-update')
        listeners.set(event, callback)
      },
      effect: (register) => {
        disposer = register()
      },
    },
    dispose() {
      disposer?.()
    },
  }
}

/** Recording proxy that refuses tunnels. */
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
  return {
    seen,
    uri: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => {
      server.closeAllConnections?.()
      server.close(resolve)
    }),
  }
}

test('apply installs the dispatcher, routes a model stream, and restores on dispose', async () => {
  const proxy = await startProxy()
  const previous = undici.getGlobalDispatcher()
  const fake = fakeContext()
  try {
    await apply(fake.ctx, { models: { alpha: proxy.uri } })
    assert.notEqual(undici.getGlobalDispatcher(), previous, 'the dispatcher must be installed')
    assert.equal(typeof fake.listener, 'function', 'the llm/stream listener must be registered')
    assert.ok(fake.lines.some(([level]) => level === 'info'), 'the active routes must be logged')

    const state = JSON.parse(readFileSync(join(stateDirectory, 'state.json'), 'utf8'))
    assert.equal(state.status, 'active')
    assert.match(state.routes, /alpha→http:\/\/127\.0\.0\.1/)

    async function* downstream() {
      yield 'chunk'
    }
    const stream = fake.listener({ provider: 'p', model: 'alpha' }, () => downstream())
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    assert.deepEqual(chunks, ['chunk'])

    // The store is live only while the stream is pulled, so model-rule verification
    // rides inside a pull: start the fetch from inside the adapter's generator.
    async function* fetching() {
      await assert.rejects(fetch('https://plugin.test/'))
      yield 'done'
    }
    for await (const chunk of fake.listener({ provider: 'p', model: 'alpha' }, () => fetching())) {
      assert.equal(chunk, 'done')
    }
    assert.deepEqual(proxy.seen, ['plugin.test:443'])
  } finally {
    fake.dispose()
    assert.equal(undici.getGlobalDispatcher(), previous, 'dispose must restore the previous dispatcher')
    await proxy.close()
  }
})

test('an invalid configuration keeps the process policy untouched', async () => {
  const previous = undici.getGlobalDispatcher()
  const fake = fakeContext()
  await apply(fake.ctx, { default: 'socks5://127.0.0.1:1080' })
  assert.equal(undici.getGlobalDispatcher(), previous)
  assert.equal(typeof fake.listener, 'function')
  assert.ok(fake.lines.some(([level]) => level === 'error'))
})

test('an empty configuration keeps the process policy untouched', async () => {
  const previous = undici.getGlobalDispatcher()
  const fake = fakeContext()
  await apply(fake.ctx, {})
  assert.equal(undici.getGlobalDispatcher(), previous)
  assert.equal(typeof fake.listener, 'function')
  assert.ok(fake.lines.some(([level, message]) => level === 'info' && String(message).includes('no routes')))
})

test('the exported Config schema parses volatile references the plugin can use', () => {
  const parsed = Config({ models: { alpha: 'http://127.0.0.1:1/' } })
  assert.equal(parsed.default.get(), 'inherit')
  assert.deepEqual(parsed.models.get(), { alpha: 'http://127.0.0.1:1/' })
})

test('a volatile configuration update installs and replaces routes without remounting', async () => {
  const proxy = await startProxy()
  const previous = undici.getGlobalDispatcher()
  const fake = fakeContext()
  const config = Config({})
  try {
    await apply(fake.ctx, config)
    assert.equal(undici.getGlobalDispatcher(), previous)
    assert.equal(typeof fake.updateListener, 'function')

    async function* pullFetch() {
      await assert.rejects(fetch('https://alpha.test/'))
      yield 'done'
    }

    config.models = Config({ default: 'inherit', models: { alpha: proxy.uri } }).models
    await fake.updateListener()
    assert.notEqual(undici.getGlobalDispatcher(), previous)
    for await (const chunk of fake.listener({ provider: 'p', model: 'alpha' }, pullFetch)) assert.equal(chunk, 'done')
    assert.deepEqual(proxy.seen, ['alpha.test:443'])

    config.models = Config({ default: 'inherit', models: { alpha: 'direct' } }).models
    await fake.updateListener()
    const state = JSON.parse(readFileSync(join(stateDirectory, 'state.json'), 'utf8'))
    assert.equal(state.status, 'active')
    for await (const chunk of fake.listener({ provider: 'p', model: 'alpha' }, pullFetch)) assert.equal(chunk, 'done')
    assert.equal(proxy.seen.length, 1)
  } finally {
    fake.dispose()
    assert.equal(undici.getGlobalDispatcher(), previous)
    await proxy.close()
  }
})

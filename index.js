/**
 * `dsh-provider-proxy` — outbound proxy routing per provider host and per model id.
 *
 * The harness installs one undici global dispatcher from the launch environment before
 * any plugin loads (`@deepseek-ai/dsh-http-proxy`). This plugin wraps that dispatcher:
 *
 *  - host rules from `providers`, available to every `fetch()` the harness makes;
 *  - model rules from `models`, available only for traffic issued by a model call,
 *    which the `llm/stream` waterfall announces with its `provider`/`model` pair.
 *
 * Traffic with no rule goes to the dispatcher captured at apply time, so the launcher's
 * policy — environment proxy, `NO_PROXY`, loopback bypass — keeps deciding it. Delegating
 * the captured dispatcher (instead of re-deriving the policy) keeps the plugin independent
 * of which copy of `dsh-http-proxy` the runtime would resolve.
 *
 * The model axis cannot ride in `GenerateOptions` (loop requests are deep-frozen) and
 * must not ride in `globalThis.fetch` (SDK clients capture fetch at construction), so it
 * travels in an `AsyncLocalStorage` store around each stream pull and is read by the
 * dispatcher at dispatch time. Concurrency is therefore isolated per model call.
 *
 * A broken configuration never blocks startup: the plugin logs and leaves the process
 * proxy policy exactly as the launcher installed it.
 *
 * @module dsh-provider-proxy
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import z from '@deepseek-ai/schemastery'

import { collectProxyUris, createRoutingDispatcher, describeRoutes, installRoutes, normalizeConfig, wrapWithStore } from './core.js'

/**
 * Accept the three proxy decisions used across routes.
 *
 * The schema is intentionally permissive about strings: {@link normalizeConfig}
 * performs the exact URL diagnostics and refuses invalid routes as a unit.
 */
function proxyValueSchema() {
  return z.union([
    z.const('inherit'),
    z.const('direct'),
    z.string().pattern(/^https?:\/\/[^/\s]+(\/\S*)?$/i),
  ])
}

const ProviderSchema = z.object({
  hosts: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  proxy: proxyValueSchema().default('inherit'),
})

const ModelRuleSchema = z.union([
  proxyValueSchema(),
  z.object({
    proxy: proxyValueSchema().default('inherit'),
    provider: z.string().min(1),
  }),
])

/**
 * Cordis configuration schema.
 *
 * All three top-level fields are volatile so settings edits commit into the
 * running references without remounting the plugin. Nested rule contents are
 * intentionally non-volatile value snapshots.
 */
export const Config = z.object({
  default: proxyValueSchema().default('inherit').volatile(),
  providers: z.dict(ProviderSchema).default({}).volatile(),
  models: z.dict(ModelRuleSchema).default({}).volatile(),
})

export const name = 'provider-proxy'
/** The listener needs the LLM service that owns the `llm/stream` waterfall. */
export const inject = ['llm']

/** Read a Cordis volatile reference when one is present. */
function resolveVolatile(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
}

/** Convert the runtime config—volatile references included—into plain matcher input. */
function snapshotConfig(config) {
  const source = config ?? {}
  return {
    default: resolveVolatile(source.default),
    providers: resolveVolatile(source.providers),
    models: resolveVolatile(source.models),
  }
}

/**
 * Mount the plugin.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - the profile host context.
 * @param {unknown} config - the entry config from `cordis.patch.yml`.
 */
export async function apply(ctx, config) {
  const log = ctx.logger('provider-proxy')
  const als = new AsyncLocalStorage()
  const current = { fallback: null, hosts: [], models: [] }
  let undici
  let previous
  let dispatcher

  async function installDispatcher() {
    if (!undici) undici = await import('undici')
    if (!dispatcher) {
      previous = undici.getGlobalDispatcher()
      dispatcher = createRoutingDispatcher({ undici, previous, routes: current, als })
      undici.setGlobalDispatcher(dispatcher)
    }
  }

  function uninstallDispatcher() {
    if (undici && dispatcher) {
      undici.setGlobalDispatcher(previous)
      const closing = dispatcher
      dispatcher = undefined
      void closing.close().catch(() => {})
    }
  }

  async function refreshRoutes(reason) {
    const next = normalizeConfig(snapshotConfig(config), (message) => log.warn('%s', message))
    if (next === undefined) {
      log.error(`${reason}: invalid configuration; the process proxy policy is left unchanged`)
      writeState({ status: 'rejected' })
      return false
    }
    if (next.hosts.length === 0 && next.models.length === 0) {
      uninstallDispatcher()
      installRoutes(current, next)
      log.info('no routes configured; the process proxy policy is left unchanged')
      writeState({ status: 'idle', routes: describeRoutes(current) })
      return true
    }
    try {
      await installDispatcher()
    } catch (error) {
      log.error(`${reason}: cannot install the routing dispatcher; the process proxy policy is left unchanged: %s`, messageOf(error))
      writeState({ status: 'failed', error: messageOf(error) })
      return false
    }
    installRoutes(current, next)
    if (dispatcher && typeof dispatcher.prune === 'function') await dispatcher.prune(collectProxyUris(current)).catch(() => {})
    log.info(`${reason}: active — %s`, describeRoutes(current))
    writeState({ status: 'active', routes: describeRoutes(current), inherited: previous?.constructor?.name ?? null })
    return true
  }

  ctx.on('llm/stream', (options, next) => {
    const store = { provider: options?.provider, model: options?.model }
    const stream = next()
    if (stream === undefined || stream === null || typeof stream[Symbol.asyncIterator] !== 'function') return stream
    return wrapWithStore(stream, als, store)
  })

  ctx.on('loader/volatile-update', () => refreshRoutes('updated configuration'))

  await refreshRoutes('initial configuration')

  ctx.effect(() => () => {
    if (undici && dispatcher) {
      undici.setGlobalDispatcher(previous)
      const closing = dispatcher
      dispatcher = undefined
      void closing.close().catch(() => {})
    }
  })
}

/** Readable message from an unknown thrown value. */
function messageOf(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Record the last apply outcome in `$DSH_HOME/provider-proxy/state.json`.
 *
 * The Desktop host captures no stdout, so this file is the only way to confirm from
 * outside that the plugin applied, which routes it took, and whether it was rejected.
 * A write failure must never affect the harness, hence the silent catch.
 *
 * @param {object} entry - status, routes summary, and anything else worth diagnosing.
 */
function writeState(entry) {
  try {
    const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh')
    const override = process.env.DSH_PROVIDER_PROXY_STATE
    const directory = typeof override === 'string' && override !== '' ? override : join(home, 'provider-proxy')
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const state = {
      appliedAt: new Date().toISOString(),
      pid: process.pid,
      ...entry,
    }
    writeFileSync(join(directory, 'state.json'), `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  } catch {
    /* diagnostics are best effort */
  }
}

export default { name, inject, Config, apply }

/**
 * Routing core for `dsh-provider-proxy`.
 *
 * Two rule axes decide where one outbound request goes:
 *
 *  - a *model* rule, matched against the `provider`/`model` pair the `llm/stream`
 *    waterfall saw for the model call that issued the request;
 *  - a *host* rule, matched against the request URL's host.
 *
 * The model axis needs per-request state, so it travels in an `AsyncLocalStorage`
 * store that the plugin fills around each LLM stream pull, and the dispatcher reads
 * it at dispatch time. Nothing here imports `undici` or `@deepseek-ai/dsh-http-proxy`
 * at module load: the plugin injects both, and the tests inject fakes.
 *
 * @module dsh-provider-proxy/core
 */

/** Send the request straight to the origin, ignoring the process proxy policy. */
export const DIRECT = Object.freeze({ kind: 'direct' })
/** Defer to the process proxy policy resolved from the environment. */
export const INHERIT = Object.freeze({ kind: 'inherit' })

const PORT_PATTERN = /^\d{1,5}$/

/**
 * Report one configuration problem.
 * @callback Report
 * @param {string} message - human-readable diagnostic, never containing a secret.
 */

/**
 * Parse one `proxy` value.
 * @param {unknown} value - `undefined`/`inherit`, `direct`, or an `http(s)://` URL.
 * @param {string} where - configuration path used in the diagnostic.
 * @param {Report} report - diagnostic sink.
 * @returns {typeof DIRECT | typeof INHERIT | {kind: 'proxy', uri: string} | undefined}
 */
function parseDecision(value, where, report) {
  if (value === undefined || value === 'inherit') return INHERIT
  if (value === 'direct') return DIRECT
  if (typeof value !== 'string') {
    report(`${where}: expected 'inherit', 'direct', or an http(s) proxy URL`)
    return undefined
  }
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    report(`${where}: ${JSON.stringify(value)} is not a URL`)
    return undefined
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    report(`${where}: ${parsed.protocol}// proxies are not supported; use an http:// or https:// proxy URL`)
    return undefined
  }
  return { kind: 'proxy', uri: value }
}

/**
 * Parse one host pattern: `host`, `host:port`, `[v6]`, or `[v6]:port`.
 * @param {unknown} value - the configured entry.
 * @returns {{suffix: string, port?: string} | undefined}
 */
function parseHostPattern(value) {
  if (typeof value !== 'string') return undefined
  let text = value.trim().toLowerCase()
  if (text === '' || text.includes('/') || text.includes('://') || /\s/.test(text)) return undefined
  if (text.endsWith('.')) text = text.slice(0, -1)

  let host = text
  let port
  if (text.startsWith('[')) {
    const close = text.indexOf(']')
    if (close < 0) return undefined
    host = text.slice(1, close)
    const rest = text.slice(close + 1)
    if (rest !== '') {
      if (!rest.startsWith(':')) return undefined
      port = rest.slice(1)
    }
  } else {
    const colon = text.indexOf(':')
    if (colon !== -1) {
      if (text.indexOf(':', colon + 1) !== -1) return undefined
      host = text.slice(0, colon)
      port = text.slice(colon + 1)
    }
  }
  if (host === '') return undefined
  if (port !== undefined && (!PORT_PATTERN.test(port) || Number(port) < 1 || Number(port) > 65535)) return undefined
  return port === undefined ? { suffix: host } : { suffix: host, port }
}

/** Whether a value is a plain mapping. */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validate and normalize the plugin configuration.
 *
 * Invalid entries are collected and reported; any invalid entry refuses the whole
 * configuration so a half-applied rule set can never route traffic surprisingly.
 *
 * @param {unknown} raw - the Cordis entry config.
 * @param {Report} [report] - diagnostic sink.
 * @returns {{fallback: object, hosts: object[], models: object[]} | undefined}
 */
export function normalizeConfig(raw, report = () => {}) {
  const errors = []
  const fail = (message) => errors.push(message)
  const source = raw === undefined || raw === null ? {} : raw
  if (!isRecord(source)) {
    report('config must be a mapping')
    return undefined
  }
  const fallback = parseDecision(source.default, 'default', fail)

  const hosts = []
  const providers = source.providers === undefined ? {} : source.providers
  if (!isRecord(providers)) {
    fail('providers must be a mapping of provider label to {hosts, proxy}')
  } else {
    for (const [label, spec] of Object.entries(providers)) {
      if (!isRecord(spec)) {
        fail(`providers.${label}: expected a mapping with hosts and proxy`)
        continue
      }
      const decision = parseDecision(spec.proxy, `providers.${label}.proxy`, fail)
      const configured = spec.hosts === undefined ? [] : Array.isArray(spec.hosts) ? spec.hosts : [spec.hosts]
      if (configured.length === 0) {
        fail(`providers.${label}.hosts: expected at least one host`)
        continue
      }
      for (const entry of configured) {
        const pattern = parseHostPattern(entry)
        if (pattern === undefined) {
          fail(`providers.${label}.hosts: ${JSON.stringify(entry)} is not a host or host:port`)
          continue
        }
        if (decision !== undefined) hosts.push({ ...pattern, decision, label })
      }
    }
  }

  const models = []
  const configuredModels = source.models === undefined ? {} : source.models
  if (!isRecord(configuredModels)) {
    fail('models must be a mapping of model id (or trailing-* prefix) to a proxy')
  } else {
    for (const [key, value] of Object.entries(configuredModels)) {
      const spec = typeof value === 'string' ? { proxy: value } : value
      if (!isRecord(spec)) {
        fail(`models[${JSON.stringify(key)}]: expected a proxy string or a mapping with proxy`)
        continue
      }
      const decision = parseDecision(spec.proxy, `models[${JSON.stringify(key)}].proxy`, fail)
      if (spec.provider !== undefined && (typeof spec.provider !== 'string' || spec.provider === '')) {
        fail(`models[${JSON.stringify(key)}].provider: expected a provider route name`)
        continue
      }
      const wildcard = key.endsWith('*')
      const pattern = wildcard ? key.slice(0, -1) : key
      if (pattern === '') {
        fail(`models[${JSON.stringify(key)}]: a wildcard needs a prefix`)
        continue
      }
      if (decision !== undefined) {
        models.push({ pattern, wildcard, provider: spec.provider, decision, label: key })
      }
    }
    models.sort((left, right) => rank(left) - rank(right))
  }

  if (errors.length > 0) {
    for (const message of errors) report(message)
    return undefined
  }
  return { fallback: fallback ?? INHERIT, hosts, models }
}

/** Priority tier of a model rule: exact before wildcard, provider-qualified before bare. */
function rank(rule) {
  return (rule.wildcard ? 2 : 0) + (rule.provider === undefined ? 1 : 0)
}

/** Normalize a URL hostname for comparison: lowercase, no brackets, no trailing dot. */
export function normalizeHostname(hostname) {
  let host = String(hostname).toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)
  if (host.endsWith('.')) host = host.slice(0, -1)
  return host
}

/** Whether a hostname names this machine's loopback; such traffic never goes through a proxy. */
export function isLoopback(hostname) {
  const host = normalizeHostname(hostname)
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return host.startsWith('::ffff:127.')
}

/** Effective port of a URL, defaulted by scheme. */
function effectivePort(url) {
  return url.port === '' ? (url.protocol === 'https:' ? '443' : '80') : url.port
}

/**
 * Match the model axis.
 * @param {{models: object[]}} routes - normalized routes.
 * @param {string | undefined} provider - harness provider route name.
 * @param {string | undefined} model - model id.
 * @returns {object | undefined} the winning decision.
 */
export function resolveModel(routes, provider, model) {
  if (typeof model !== 'string' || model === '') return undefined
  for (const rule of routes.models) {
    if (rule.provider !== undefined && rule.provider !== provider) continue
    const hit = rule.wildcard ? model.startsWith(rule.pattern) : model === rule.pattern
    if (hit) return rule.decision
  }
  return undefined
}

/**
 * Match the host axis.
 * @param {{hosts: object[]}} routes - normalized routes.
 * @param {string} hostname - request hostname.
 * @param {string} port - effective request port.
 * @returns {object | undefined} the winning decision.
 */
export function resolveHost(routes, hostname, port) {
  const host = normalizeHostname(hostname)
  for (const rule of routes.hosts) {
    if (rule.port !== undefined && rule.port !== port) continue
    if (host === rule.suffix || host.endsWith(`.${rule.suffix}`)) return rule.decision
  }
  return undefined
}

/** Resolve one request: model rule, then host rule, then the configured fallback. */
export function resolveDecision(routes, store, url) {
  const decided = resolveModel(routes, store?.provider, store?.model) ?? resolveHost(routes, url.hostname, effectivePort(url))
  return decided ?? routes.fallback
}

/**
 * Collect every proxy URI a normalized route table references.
 * Used to retire cached agents whose rule was removed.
 */
export function collectProxyUris(routes) {
  const uris = new Set();
  for (const rule of routes.models) {
    if (rule.decision.kind === 'proxy') uris.add(rule.decision.uri);
  }
  for (const rule of routes.hosts) {
    if (rule.decision.kind === 'proxy') uris.add(rule.decision.uri);
  }
  return uris;
}

/**
 * Replace a normalized route table in place so a live dispatcher installed
 * against it sees the new rules without a remount.
 */
export function installRoutes(target, next) {
  for (const key of Object.keys(target)) Reflect.deleteProperty(target, key)
  Object.assign(target, next)
}

/** One-line summary for the startup log; never includes proxy credentials unless the URL carries them. */
export function describeRoutes(routes) {
  const parts = routes.models.map((rule) => {
    const prefix = rule.provider === undefined ? '' : `${rule.provider}/`
    return `${prefix}${rule.label}→${describeDecision(rule.decision)}`
  })
  for (const rule of routes.hosts) {
    const port = rule.port === undefined ? '' : `:${rule.port}`
    parts.push(`${rule.suffix}${port}→${describeDecision(rule.decision)}`)
  }
  parts.push(`default→${describeDecision(routes.fallback)}`)
  return parts.join(', ')
}

/** Human-readable decision. */
function describeDecision(decision) {
  if (decision.kind === 'direct') return 'direct'
  if (decision.kind === 'inherit') return 'inherit'
  return decision.uri
}

/** Convert a dispatch origin to a URL. */
function originUrl(origin) {
  try {
    return typeof origin === 'string' ? new URL(origin) : new URL(origin.href)
  } catch {
    return undefined
  }
}

/**
 * Wrap an async iterable so every pull runs inside an `AsyncLocalStorage` store.
 *
 * The adapter starts its HTTP request while the stream is being pulled, so the
 * store must be active exactly for `next()`/`return()`/`throw()`. Wrapping the
 * construction call alone would miss an adapter that defers the request to the
 * first pull, and wrapping the consumer would miss concurrency isolation.
 *
 * @param {AsyncIterable<unknown>} iterable - the downstream stream from `next()`.
 * @param {import('node:async_hooks').AsyncLocalStorage<object>} als - the store.
 * @param {object} store - the provider/model pair for this stream.
 * @returns {AsyncIterable<unknown>}
 */
export function wrapWithStore(iterable, als, store) {
  return {
    [Symbol.asyncIterator]() {
      const inner = iterable[Symbol.asyncIterator]()
      return {
        next(value) {
          return als.run(store, () => inner.next(value))
        },
        return(value) {
          return als.run(store, () => (inner.return === undefined ? Promise.resolve({ done: true, value }) : inner.return(value)))
        },
        throw(error) {
          return als.run(store, () => (inner.throw === undefined ? Promise.reject(error) : inner.throw(error)))
        },
        [Symbol.asyncIterator]() {
          return this
        },
      }
    },
  }
}

/**
 * Build the process-wide dispatcher.
 *
 * Requests are routed per dispatch call: the model store chosen by `wrapWithStore`
 * wins, then the host rules, then the dispatcher captured at apply time. A pool per
 * origin and one proxy agent per proxy URL are cached for the dispatcher's lifetime.
 *
 * @param {object} options - inputs.
 * @param {object} options.undici - the `undici` module (injected).
 * @param {object} options.previous - the dispatcher installed before this plugin; inherited traffic is delegated to it, so the harness policy (environment proxy, loopback bypass) stays in charge.
 * @param {object} options.routes - normalized routes.
 * @param {import('node:async_hooks').AsyncLocalStorage<object>} options.als - model store.
 * @returns {object} a `Dispatcher` that owns its pools and proxy agents.
 */
export function createRoutingDispatcher({ undici, previous, routes, als }) {
  const { Dispatcher, Pool, ProxyAgent } = undici
  const pools = new Map()
  const proxies = new Map()

  const poolFor = (origin) => {
    let pool = pools.get(origin)
    if (pool === undefined) {
      pool = new Pool(origin)
      pools.set(origin, pool)
    }
    return pool
  }
  const proxyFor = (uri) => {
    let agent = proxies.get(uri)
    if (agent === undefined) {
      agent = new ProxyAgent({ uri })
      proxies.set(uri, agent)
    }
    return agent
  }
  const inheritedFor = (url) => previous ?? poolFor(url.origin)

  return new (class RoutingDispatcher extends Dispatcher {
    dispatch(options, handler) {
      const url = originUrl(options.origin)
      if (url === undefined) return poolFor(String(options.origin)).dispatch(options, handler)
      const store = als.getStore()
      if (isLoopback(url.hostname)) return poolFor(url.origin).dispatch(options, handler)
      const decision = resolveDecision(routes, store, url)
      if (decision.kind === 'direct') return poolFor(url.origin).dispatch(options, handler)
      if (decision.kind === 'proxy') return proxyFor(decision.uri).dispatch(options, handler)
      return inheritedFor(url).dispatch(options, handler)
    }

    /** Close cached proxy agents whose rule was removed; pools stay cached like a stock Agent. */
    async prune(validUris) {
      const closing = []
      for (const [uri, agent] of proxies) {
        if (validUris.has(uri)) continue
        proxies.delete(uri)
        closing.push(agent.close().catch(() => {}))
      }
      await Promise.allSettled(closing)
    }

    async close() {
      await Promise.allSettled([...pools.values(), ...proxies.values()].map((dispatcher) => dispatcher.close()))
      pools.clear()
      proxies.clear()
    }

    async destroy(error) {
      await Promise.allSettled([...pools.values(), ...proxies.values()].map((dispatcher) => dispatcher.destroy(error)))
      pools.clear()
      proxies.clear()
    }
  })()
}

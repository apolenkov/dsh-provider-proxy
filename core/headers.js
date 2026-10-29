/**
 * Header injection for routing rules.
 *
 * Kept beside the routing core so `core.js` stays under the repository file
 * budget: parsing, the OpenCode session-id synthesis, and the dispatch-time
 * merge all live here and are re-exported from `core.js`.
 *
 * @module dsh-provider-proxy/core/headers
 */

/**
 * Header value token replaced, at dispatch time, with a fresh OpenCode session id.
 *
 * Some gateways identify anonymous clients by a per-conversation header the
 * harness adapter does not send for hand-declared models. A rule may therefore
 * declare `headers: { 'x-opencode-session': '{{opencodeSession}}' }` and get a
 * canonical `ses_`-shaped id synthesized for every request.
 */
export const SESSION_HEADER_TOKEN = '{{opencodeSession}}'

const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const SESSION_COUNTER_MODULO = 16
let sessionCounter = 0

/** Whether a value is a plain mapping. */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Encode a byte buffer as a fixed-length base62 string (zero-padded). */
function toBase62(bytes, length) {
  let value = BigInt(`0x${Buffer.from(bytes).toString('hex')}`)
  const digits = []
  const base = 62n
  while (value > 0n) {
    digits.push(BASE62[Number(value % base)])
    value /= base
  }
  while (digits.length < length) digits.push('0')
  return digits.slice(0, length).join('')
}

/**
 * Synthesize one OpenCode-shaped session id: `ses_` + 12 hex of an inverted
 * millisecond timestamp + 14 base62 characters.
 *
 * The gateway only requires the header to be present and stable per conversation;
 * a fresh id per request is the adapter's choice, because the dispatcher sees the
 * request but not the harness session that issued it.
 *
 * @returns {string} canonical-looking session id.
 */
export function opencodeSessionId() {
  sessionCounter = (sessionCounter % SESSION_COUNTER_MODULO) + 1
  const stamp = (Date.now() * 0x1000 + sessionCounter) % 2 ** 48
  const inverted = 2 ** 48 - 1 - stamp
  return `ses_${inverted.toString(16).padStart(12, '0')}${toBase62(globalThis.crypto.getRandomValues(new Uint8Array(9)), 14)}`
}

/**
 * Parse one rule's `headers` mapping.
 *
 * Names must look like HTTP header names, values must be single-line strings.
 * Values are kept as written; {@link SESSION_HEADER_TOKEN} stays for dispatch time.
 *
 * @param {unknown} value - configured headers, or `undefined`.
 * @param {string} where - configuration path used in the diagnostic.
 * @param {(message: string) => void} report - diagnostic sink.
 * @returns {{name: string, value: string}[] | undefined} parsed headers.
 */
export function parseHeaders(value, where, report) {
  if (value === undefined) return []
  if (!isRecord(value)) {
    report(`${where}: expected a mapping of header name to value`)
    return undefined
  }
  const headers = []
  for (const [name, raw] of Object.entries(value)) {
    if (!HEADER_NAME_PATTERN.test(name)) {
      report(`${where}: ${JSON.stringify(name)} is not an HTTP header name`)
      return undefined
    }
    if (typeof raw !== 'string' || raw === '' || /[\r\n]/.test(raw)) {
      report(`${where}.${name}: expected a non-empty single-line string value`)
      return undefined
    }
    headers.push({ name, value: raw })
  }
  return headers
}

/**
 * Add a rule's headers to one dispatch call, expanding `{{opencodeSession}}`.
 *
 * Undici passes headers either as a flat `[name, value, …]` array or as a record;
 * both forms are accepted and the flat array is what the pool receives back.
 *
 * @param {object} options - undici dispatch options.
 * @param {{name: string, value: string}[]} headers - configured headers.
 * @returns {object} options with the headers appended (the input is not mutated).
 */
export function injectHeaders(options, headers) {
  if (headers.length === 0) return options
  const existing = options.headers
  const list = Array.isArray(existing)
    ? existing.slice()
    : isRecord(existing)
      ? Object.entries(existing).flat()
      : []
  for (const header of headers) {
    list.push(header.name, header.value.split(SESSION_HEADER_TOKEN).join(opencodeSessionId()))
  }
  return { ...options, headers: list }
}

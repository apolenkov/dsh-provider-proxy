/**
 * Pure form helpers for the provider-proxy Plugins page: parsing, validation,
 * draft conversion, and serialization. No DOM, no React, no network — this
 * chunk is unit-testable from Node by importing the same functions.
 */
window.__ModuleLoader__.load({
  id: '@apolenkov/dsh-provider-proxy/client.validate.js',
  factory() {
    function parseHostsText(value) {
      return String(value || '')
        .split(/[\n,]+/)
        .map((part) => part.trim())
        .filter(Boolean);
    }

    function splitHostPort(raw) {
      const text = String(raw || '').trim().toLowerCase();
      if (!text || text.includes('/') || text.includes('://') || /\s/.test(text)) return null;
      const stripped = text.endsWith('.') ? text.slice(0, -1) : text;
      let host = stripped;
      let port;
      if (stripped.startsWith('[')) {
        const close = stripped.indexOf(']');
        if (close < 0) return null;
        host = stripped.slice(1, close);
        const rest = stripped.slice(close + 1);
        if (rest !== '') {
          if (!rest.startsWith(':')) return null;
          port = rest.slice(1);
        }
      } else {
        const colon = stripped.indexOf(':');
        if (colon !== -1) {
          if (stripped.indexOf(':', colon + 1) !== -1) return null;
          host = stripped.slice(0, colon);
          port = stripped.slice(colon + 1);
        }
      }
      if (!host) return null;
      if (port !== undefined) {
        if (!/^\d{1,5}$/.test(port)) return { host, port, badPort: true };
        const n = Number(port);
        if (!Number.isInteger(n) || n < 1 || n > 65535) return { host, port, badPort: true };
      }
      return { host, port };
    }

    function proxyOf(kind, url) {
      if (kind === 'inherit' || kind === 'direct') return kind;
      return String(url || '').trim();
    }

    function validateProxyValue(value, t) {
      const text = String(value || '').trim();
      if (text === 'inherit' || text === 'direct') return null;
      if (text === '') return t('errRequired');
      if (/\s/.test(text)) return t('errBadProxy');
      let parsed;
      try {
        parsed = new URL(text);
      } catch {
        return t('errBadProxy');
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return t('errBadProxy');
      if (parsed.username || parsed.password) return t('errNoCreds');
      return null;
    }

    /** Keep a rule's injected headers through a UI edit; the page has no editor for them yet. */
    function headersOf(spec) {
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return undefined;
      const headers = spec.headers;
      if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return undefined;
      return Object.keys(headers).length === 0 ? undefined : { ...headers };
    }

    /** Render headers as the editable `Name: value` lines. */
    function formatHeadersText(headers) {
      if (!headers || typeof headers !== 'object') return '';
      return Object.entries(headers).map(([name, value]) => `${name}: ${value}`).join('\n');
    }

    /** Parse `Name: value` lines; the first colon separates, values keep the rest. */
    function parseHeadersText(text) {
      const headers = [];
      for (const raw of String(text || '').split('\n')) {
        const line = raw.trim();
        if (line === '') continue;
        const colon = line.indexOf(':');
        if (colon <= 0) {
          headers.push({ name: line, value: '', bad: true });
          continue;
        }
        const name = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim();
        headers.push({ name, value, bad: name === '' || value === '' });
      }
      return headers;
    }

    const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

    /** One diagnostic for the header lines, or null when they are valid. */
    function validateHeadersText(text, t) {
      const seen = new Set();
      for (const header of parseHeadersText(text)) {
        if (header.bad || !HEADER_NAME.test(header.name)) return t('errBadHeader');
        if (seen.has(header.name.toLowerCase())) return t('errDuplicateHeader');
        seen.add(header.name.toLowerCase());
      }
      return null;
    }

    function snapshotToDraft(value) {
      const src = value || {};
      const providers = Object.entries(src.providers || {}).map(([label, spec], index) => {
        const hosts = Array.isArray(spec && spec.hosts) ? spec.hosts.join(', ') : String((spec && spec.hosts) || '');
        const proxy = spec && typeof spec.proxy === 'string' ? spec.proxy : 'inherit';
        const kind = proxy === 'inherit' || proxy === 'direct' ? proxy : 'custom';
        return {
          key: `provider-${index}-${label}`,
          label: String(label),
          hosts,
          proxyKind: kind,
          proxyUrl: kind === 'custom' ? proxy : '',
          headersText: formatHeadersText(headersOf(spec)),
          errors: {},
        };
      });
      const models = Object.entries(src.models || {}).map(([id, spec], index) => {
        if (typeof spec === 'string') {
          const kind = spec === 'inherit' || spec === 'direct' ? spec : 'custom';
          return { key: `model-${index}-${id}`, id: String(id), provider: '', proxyKind: kind, proxyUrl: kind === 'custom' ? spec : '', headers: undefined, errors: {} };
        }
        const proxy = spec && typeof spec.proxy === 'string' ? spec.proxy : '';
        const kind = proxy === 'inherit' || proxy === 'direct' ? proxy : 'custom';
        return {
          key: `model-${index}-${id}`,
          id: String(id),
          provider: spec && typeof spec.provider === 'string' ? spec.provider : '',
          proxyKind: kind,
          proxyUrl: kind === 'custom' ? proxy : '',
          headersText: formatHeadersText(headersOf(spec)),
          errors: {},
        };
      });
      return {
        default: typeof src.default === 'string' ? src.default : 'inherit',
        providers,
        models,
      };
    }

    function validateDraft(draft, t) {
      const errors = { providers: {}, models: {}, form: [] };
      let ok = true;
      const fail = (list, message) => {
        ok = false;
        list.push(message);
      };
      if (draft.default !== 'inherit' && draft.default !== 'direct') {
        fail(errors.form, t('errBadDefault'));
      }
      const labels = new Set();
      draft.providers.forEach((row, index) => {
        const rowErrors = {};
        const label = String(row.label || '').trim();
        if (!label) {
          rowErrors.label = t('errRequired');
          ok = false;
        } else if (labels.has(label)) {
          rowErrors.label = t('errDuplicateLabel');
          ok = false;
        } else {
          labels.add(label);
        }
        const entries = parseHostsText(row.hosts);
        if (entries.length === 0) {
          rowErrors.hosts = t('errRequired');
          ok = false;
        } else {
          for (const entry of entries) {
            const parsed = splitHostPort(entry);
            if (!parsed) {
              rowErrors.hosts = t('errBadPattern');
              ok = false;
              break;
            }
            if (parsed.badPort) {
              rowErrors.hosts = t('errBadPort');
              ok = false;
              break;
            }
          }
        }
        const proxy = proxyOf(row.proxyKind, row.proxyUrl);
        const proxyError = validateProxyValue(proxy, t);
        if (proxyError) {
          rowErrors.proxy = proxyError;
          ok = false;
        }
        const headersError = validateHeadersText(row.headersText, t);
        if (headersError) {
          rowErrors.headers = headersError;
          ok = false;
        }
        errors.providers[index] = rowErrors;
      });
      const ids = new Set();
      draft.models.forEach((row, index) => {
        const rowErrors = {};
        const id = String(row.id || '').trim();
        if (!id) {
          rowErrors.id = t('errRequired');
          ok = false;
        } else if (/\s/.test(id)) {
          rowErrors.id = t('errBadModelId');
          ok = false;
        } else if (ids.has(id)) {
          rowErrors.id = t('errDuplicateModel');
          ok = false;
        } else {
          ids.add(id);
        }
        const pinned = String(row.provider || '').trim();
        if (pinned !== '' && /\s/.test(pinned)) {
          rowErrors.provider = t('errBadProvider');
          ok = false;
        }
        const proxy = proxyOf(row.proxyKind, row.proxyUrl);
        const proxyError = validateProxyValue(proxy, t);
        if (proxyError) {
          rowErrors.proxy = proxyError;
          ok = false;
        }
        const headersError = validateHeadersText(row.headersText, t);
        if (headersError) {
          rowErrors.headers = headersError;
          ok = false;
        }
        errors.models[index] = rowErrors;
      });
      return { ok, errors };
    }

    /** Draft row headers as a plain object, or undefined when empty. */
    function headersObjectOf(row) {
      const entries = parseHeadersText(row && row.headersText).filter((header) => !header.bad);
      if (entries.length === 0) return undefined;
      const headers = {};
      for (const header of entries) headers[header.name] = header.value;
      return headers;
    }

    function serializeDraft(draft) {
      const providers = {};
      for (const row of draft.providers) {
        const label = String(row.label || '').trim();
        if (!label) continue;
        const headers = headersObjectOf(row);
        providers[label] = { hosts: parseHostsText(row.hosts), proxy: proxyOf(row.proxyKind, row.proxyUrl), ...(headers ? { headers } : {}) };
      }
      const models = {};
      for (const row of draft.models) {
        const id = String(row.id || '').trim();
        if (!id) continue;
        const provider = String(row.provider || '').trim();
        const proxy = proxyOf(row.proxyKind, row.proxyUrl);
        const headers = headersObjectOf(row);
        models[id] = provider ? { proxy, provider, ...(headers ? { headers } : {}) } : proxy;
      }
      return { default: draft.default, providers, models };
    }

    return { parseHostsText, splitHostPort, proxyOf, validateProxyValue, formatHeadersText, parseHeadersText, validateHeadersText, snapshotToDraft, validateDraft, serializeDraft };
  },
});

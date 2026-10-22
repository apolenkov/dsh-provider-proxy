/**
 * Pure UI logic: host parsing, proxy validation, draft conversion, and
 * serialization round-trips. These functions run in the browser chunk but have
 * no DOM dependency, so they load here through the same `__ModuleLoader__` shim
 * the entry uses.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

let V;

async function loadValidate() {
  if (V) return V;
  const modules = [];
  globalThis.window = { __ModuleLoader__: { load: (entry) => modules.push(entry) } };
  try {
    await import('../client/client.validate.js');
  } finally {
    delete globalThis.window;
  }
  assert.equal(modules.length, 1, 'validate chunk must self-register once');
  assert.equal(modules[0].id, 'dsh-provider-proxy/client.validate.js');
  V = modules[0].factory().valueOf();
  return V;
}

/** Translator stub: returns the key so assertions read as the failing rule. */
const t = (key) => key;

test('parseHostsText splits on commas and newlines and drops blanks', async () => {
  const v = await loadValidate();
  assert.deepEqual(v.parseHostsText('a.test, b.test\nc.test\n\n  ,  '), ['a.test', 'b.test', 'c.test']);
  assert.deepEqual(v.parseHostsText(''), []);
  assert.deepEqual(v.parseHostsText(undefined), []);
});

test('splitHostPort accepts hosts, ports, and bracketed IPv6', async () => {
  const v = await loadValidate();
  assert.deepEqual(v.splitHostPort('Example.COM.'), { host: 'example.com', port: undefined });
  assert.deepEqual(v.splitHostPort('example.com:8443'), { host: 'example.com', port: '8443' });
  assert.deepEqual(v.splitHostPort('[::1]'), { host: '::1', port: undefined });
  assert.deepEqual(v.splitHostPort('[::1]:8443'), { host: '::1', port: '8443' });
  assert.equal(v.splitHostPort('https://example.com'), null);
  assert.equal(v.splitHostPort('example.com/v1'), null);
  assert.equal(v.splitHostPort('exa mple.com'), null);
  assert.equal(v.splitHostPort(''), null);
});

test('splitHostPort flags unusable ports', async () => {
  const v = await loadValidate();
  for (const entry of ['example.com:0', 'example.com:99999', 'example.com:abc']) {
    const parsed = v.splitHostPort(entry);
    assert.ok(parsed && parsed.badPort === true, `${entry} must report badPort`);
  }
});

test('validateProxyValue accepts inherit, direct, and credential-free http(s) URLs', async () => {
  const v = await loadValidate();
  assert.equal(v.validateProxyValue('inherit', t), null);
  assert.equal(v.validateProxyValue('direct', t), null);
  assert.equal(v.validateProxyValue('http://127.0.0.1:1301', t), null);
  assert.equal(v.validateProxyValue('https://proxy.example:8443', t), null);
  assert.equal(v.validateProxyValue('', t), 'errRequired');
  assert.equal(v.validateProxyValue('socks5://127.0.0.1:1080', t), 'errBadProxy');
  assert.equal(v.validateProxyValue('ftp://proxy.example', t), 'errBadProxy');
  assert.equal(v.validateProxyValue('has space', t), 'errBadProxy');
  assert.equal(v.validateProxyValue('http://user:pass@127.0.0.1:8080', t), 'errNoCreds');
});

test('snapshotToDraft and serializeDraft round-trip a configuration', async () => {
  const v = await loadValidate();
  const config = {
    default: 'direct',
    providers: {
      corp: { hosts: ['llm.internal.example', 'llm.internal.example:8443'], proxy: 'direct' },
      opencode: { hosts: 'opencode.ai', proxy: 'http://127.0.0.1:1301' },
    },
    models: {
      'muse-spark-1.3-contributor': { provider: 'opencode-go', proxy: 'http://127.0.0.1:1291' },
      'longcat-*': 'inherit',
      'alpha': 'direct',
    },
  };
  const draft = v.snapshotToDraft(config);
  assert.equal(draft.default, 'direct');
  assert.equal(draft.providers.length, 2);
  assert.equal(draft.models.length, 3);
  assert.deepEqual(v.validateDraft(draft, t).ok, true, JSON.stringify(v.validateDraft(draft, t).errors));

  const serialized = v.serializeDraft(draft);
  // A string `hosts` value is normalised to the array form on save; everything
  // else round-trips unchanged.
  assert.deepEqual(serialized, {
    ...config,
    providers: {
      corp: config.providers.corp,
      opencode: { hosts: ['opencode.ai'], proxy: 'http://127.0.0.1:1301' },
    },
  });
});

test('validateDraft reports duplicates, bad hosts, and missing ids', async () => {
  const v = await loadValidate();
  const draft = v.snapshotToDraft({
    default: 'inherit',
    providers: {
      corp: { hosts: ['ok.example'], proxy: 'direct' },
    },
    models: {},
  });
  draft.providers.push({ key: 'p2', label: 'corp', hosts: 'bad host', proxyKind: 'custom', proxyUrl: '' });
  draft.models.push({ key: 'm1', id: '', provider: '', proxyKind: 'inherit', proxyUrl: '' });
  const result = v.validateDraft(draft, t);
  assert.equal(result.ok, false);
  assert.equal(result.errors.providers[1].label, 'errDuplicateLabel');
  assert.equal(result.errors.providers[1].hosts, 'errBadPattern');
  assert.equal(result.errors.providers[1].proxy, 'errRequired');
  assert.equal(result.errors.models[0].id, 'errRequired');
});

test('serializeDraft never writes blank rows', async () => {
  const v = await loadValidate();
  const serialized = v.serializeDraft({
    default: 'inherit',
    providers: [{ key: 'p', label: '  ', hosts: '', proxyKind: 'inherit', proxyUrl: '' }],
    models: [{ key: 'm', id: '  ', provider: '  ', proxyKind: 'inherit', proxyUrl: '' }],
  });
  assert.deepEqual(serialized, { default: 'inherit', providers: {}, models: {} });
});

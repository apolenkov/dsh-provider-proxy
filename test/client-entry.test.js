/**
 * Client entry wiring: the browser half self-registers under the package name
 * and mounts the same route editor in the two seats the harness offers — the
 * bundle's page on the Plugins screen and its own page in Settings. No DOM, no
 * network, no DSH runtime.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function installWindowShim(captured) {
  globalThis.window = {
    __ModuleLoader__: {
      load(entry) {
        captured.push(entry);
      },
    },
  };
}

/** Minimal Cordis browser context recording every slot registration. */
function makeContext() {
  const registrations = [];
  return {
    registrations,
    ctx: {
      slots: {
        inject: (name, register) => {
          registrations.push({ name, register });
          return () => {};
        },
        register: (descriptor, component) => ({ descriptor, component }),
      },
      locale: {
        bind: () => (key) => key,
        register: () => () => {},
        getLocale: () => ({ id: 'en', active: 'en', fallback: 'en', revision: 1 }),
        subscribe: () => () => {},
      },
      configForms: {
        get: (entryId) => {
          assert.equal(entryId, 'provider-proxy');
          return {
            getSnapshot: () => ({ status: 'ready', value: {}, revision: 1, writable: true }),
            subscribe: () => () => {},
          };
        },
        whileServed: (_namespaces, register) => register(['provider-proxy']),
      },
      effect: (register) => register(),
    },
  };
}

let cachedEntry;
async function loadEntry() {
  if (cachedEntry) return cachedEntry;
  const modules = [];
  installWindowShim(modules);
  try {
    await import('../client/client.js');
  } finally {
    delete globalThis.window;
  }
  assert.equal(modules.length, 1, 'exactly one client module must register');
  assert.equal(modules[0].id, manifest.name, 'module id must match the package name');
  const exported = modules[0].factory(() => ({}));
  assert.deepEqual(exported.inject, ['slots', 'locale', 'configForms']);
  cachedEntry = exported;
  return exported;
}

test('client entry mounts the editor on the bundle page', async () => {
  const exported = await loadEntry();
  const { ctx, registrations } = makeContext();
  await exported.apply(ctx);
  const slot = registrations.find((entry) => entry.name === 'plugins.bundle.config');
  assert.ok(slot, 'must register into plugins.bundle.config');
  const rendered = slot.register();
  assert.equal(rendered.descriptor.key, manifest.name, 'row key must be the package name');
  assert.equal(rendered.descriptor.name, 'plugins.bundle.config');
  assert.equal(typeof rendered.component, 'function');
});

test('client entry adds a Settings page beside Models', async () => {
  const exported = await loadEntry();
  const { ctx, registrations } = makeContext();
  await exported.apply(ctx);
  const slot = registrations.find((entry) => entry.name === 'settings.section');
  assert.ok(slot, 'must register into settings.section');
  const rendered = slot.register();
  assert.equal(rendered.descriptor.id, 'proxy-routes', 'section id must stay stable');
  assert.equal(rendered.descriptor.order, 20, 'section sits after the shipped pages');
  assert.equal(typeof rendered.descriptor.label, 'function', 'label is projected as a thunk');
  assert.ok(rendered.descriptor.label().length > 0, 'label must not be empty');
  assert.equal(typeof rendered.component, 'function');
});

test('every locale dictionary exposes identical keys', async () => {
  const modules = [];
  installWindowShim(modules);
  try {
    await import('../client/client.strings.js?dictionaries');
  } finally {
    delete globalThis.window;
  }
  assert.equal(modules.length, 1);
  const { STRINGS } = modules[0].factory();
  assert.ok(STRINGS && STRINGS.en, 'en is the reference dictionary');
  const reference = Object.keys(STRINGS.en).sort();
  for (const locale of Object.keys(STRINGS)) {
    assert.deepEqual(Object.keys(STRINGS[locale]).sort(), reference, `${locale} must match en`);
  }
  assert.ok(STRINGS.zh, 'zh ships with the plugin');
});

test('row key in the entry always matches the published package name', () => {
  const entry = readFileSync(join(root, 'client', 'client.js'), 'utf8');
  assert.ok(
    entry.includes(`const BUNDLE_ID = '${manifest.name}'`),
    'row key must equal the published package name',
  );
  assert.ok(!entry.includes('@local/'), 'no local package names may leak into the browser bundle');
});

test('the settings section label follows the harness locale', async () => {
  const exported = await loadEntry();
  const { ctx, registrations } = makeContext();
  ctx.locale.getLocale = () => ({ id: 'zh', active: 'zh', fallback: 'en', revision: 2 });
  await exported.apply(ctx);
  const slot = registrations.find((entry) => entry.name === 'settings.section');
  const rendered = slot.register();
  assert.equal(rendered.descriptor.label(), '代理路由', 'zh from the locale face wins over the browser');
});

test('the settings section label is localised without loading a chunk', () => {
  const entry = readFileSync(join(root, 'client', 'client.js'), 'utf8');
  assert.ok(entry.includes("en: 'Proxy routes'"), 'en nav label');
  assert.ok(entry.includes("ru: 'Прокси'"), 'ru nav label stays short enough for the Settings nav');
  assert.ok(entry.includes("zh: '代理路由'"), 'zh nav label');
});

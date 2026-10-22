/**
 * Client entry wiring: the browser half self-registers under the package name,
 * mounts the Proxy routes page on the row's `plugins.bundle.config` slot, and
 * keeps both locales in sync. No DOM, no network, no DSH runtime.
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

test('client entry self-registers and mounts the row configuration page', async () => {
  const modules = [];
  installWindowShim(modules);
  const registrations = [];
  const ctx = {
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
  };
  try {
    await import('../client/client.js');
  } finally {
    delete globalThis.window;
  }
  assert.equal(modules.length, 1, 'exactly one client module must register');
  assert.equal(modules[0].id, manifest.name, 'module id must match the package name');
  const exported = modules[0].factory(() => ({}));
  assert.deepEqual(exported.inject, ['slots', 'configForms']);
  await exported.apply(ctx);
  const slot = registrations.find((entry) => entry.name === 'plugins.bundle.config');
  assert.ok(slot, 'must register into plugins.bundle.config');
  const rendered = slot.register();
  assert.equal(rendered.descriptor.key, manifest.name, 'row key must be the package name');
  assert.equal(rendered.descriptor.name, 'plugins.bundle.config');
  assert.equal(typeof rendered.component, 'function');
});

test('en and ru dictionaries expose identical keys', async () => {
  const modules = [];
  installWindowShim(modules);
  try {
    await import('../client/client.strings.js?dictionaries');
  } finally {
    delete globalThis.window;
  }
  assert.equal(modules.length, 1);
  const { STRINGS } = modules[0].factory();
  assert.ok(STRINGS && STRINGS.en && STRINGS.ru);
  assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.ru).sort());
});

test('row key in the entry always matches the published package name', () => {
  const entry = readFileSync(join(root, 'client', 'client.js'), 'utf8');
  assert.ok(
    entry.includes(`const BUNDLE_ID = '${manifest.name}'`),
    'row key must equal the published package name',
  );
  assert.ok(!entry.includes('@local/'), 'no local package names may leak into the browser bundle');
});

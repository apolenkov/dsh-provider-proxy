/**
 * Client contract tests: chunk ids, registration keys, locale parity, and
 * public-repo constraints. No DOM, no network, no DSH runtime.
 *
 * The size guard rejects new files over 20 KiB; every client chunk must stay
 * under it because the DSH module system loads package-local chunks one file
 * at a time and forbids synchronous cross-file requires.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const clientDir = join(root, 'client');
const PACKAGE_NAME = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name;
const ROW_ID = 'provider-proxy';
const LIMIT_BYTES = 20 * 1024;

function read(name) {
  return readFileSync(join(clientDir, name), 'utf8');
}

function chunkId(source) {
  const match = source.match(/id:\s*'([^']+)'/);
  assert.ok(match, 'chunk must declare a module id');
  return match[1];
}

test('client chunks register the ids the loader resolves', () => {
  const byFile = {
    'client.js': PACKAGE_NAME,
    'client.strings.js': `${PACKAGE_NAME}/client.strings.js`,
    'client.validate.js': `${PACKAGE_NAME}/client.validate.js`,
    'client.ui.js': `${PACKAGE_NAME}/client.ui.js`,
    'client.fields.js': `${PACKAGE_NAME}/client.fields.js`,
    'client.theme.js': `${PACKAGE_NAME}/client.theme.js`,
  };
  for (const [file, id] of Object.entries(byFile)) {
    assert.equal(chunkId(read(file)), id, `${file} must self-register as ${id}`);
  }
});

test('the row configuration key matches the published package and row id', () => {
  assert.ok(PACKAGE_NAME.includes('/') || PACKAGE_NAME.length > 0);
  const entry = read('client.js');
  assert.ok(entry.includes(`const BUNDLE_ID = '${PACKAGE_NAME}'`), 'entry must derive the row key from the package name');
  assert.ok(entry.includes(`key: BUNDLE_ID`), 'row registration must be keyed by the bundle id');
  assert.ok(entry.includes(ROW_ID), 'entry must reference the provider-proxy row');
});

test('en and ru dictionaries expose identical keys', () => {
  const strings = read('client.strings.js');
  const start = strings.indexOf('const STRINGS = {');
  assert.notEqual(start, -1);
  const block = strings.slice(start);
  const keys = {};
  for (const lang of ['en', 'ru']) {
    const at = block.indexOf(`${lang}: {`);
    assert.notEqual(at, -1, `missing ${lang} dictionary`);
    let depth = 0;
    let begin = -1;
    let end = -1;
    for (let i = at; i < block.length; i += 1) {
      if (block[i] === '{') {
        if (depth === 0) begin = i;
        depth += 1;
      } else if (block[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    assert.ok(begin !== -1 && end !== -1, `unbalanced ${lang} dictionary`);
    const names = new Set();
    const inner = block.slice(begin + 1, end);
    // Top-level `key:` / `key(` pairs; function values stay on one logical entry per key.
    const cleaned = inner.replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, "''");
    let d = 0;
    let token = '';
    const push = () => {
      const m = token.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (m) names.add(m[1]);
      token = '';
    };
    for (const ch of cleaned) {
      if (ch === '{' || ch === '[' || ch === '(') d += 1;
      if (ch === '}' || ch === ']' || ch === ')') d -= 1;
      if (ch === ',' && d === 0) {
        push();
        continue;
      }
      token += ch;
    }
    push();
    keys[lang] = names;
  }
  assert.deepEqual([...keys.en].sort(), [...keys.ru].sort());
});

test('every client chunk fits the repository size budget', () => {
  for (const name of readdirSync(clientDir)) {
    if (!name.endsWith('.js')) continue;
    const size = statSync(join(clientDir, name)).size;
    assert.ok(size < LIMIT_BYTES, `${name} is ${size} bytes, over the ${LIMIT_BYTES} byte budget`);
  }
});

test('client code never embeds secrets or private hosts', () => {
  const forbidden = [/digtp/i, /eurochem/i, /user:\s*[^,}\s][^,}]*pass/i, /BEGIN [A-Z0-9 ]*PRIVATE KEY/];
  for (const name of readdirSync(clientDir)) {
    if (!name.endsWith('.js')) continue;
    const text = read(name);
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(text), `${name} matches forbidden pattern ${pattern}`);
    }
  }
});

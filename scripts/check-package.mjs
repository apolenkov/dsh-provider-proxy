#!/usr/bin/env node
/**
 * Repository hygiene for the public `dsh-provider-proxy` package.
 *
 * Fails on missing manifest fields, missing published files, a client bundle id
 * that drifts from the package name, unresolved placeholders in shipped metadata,
 * or an incompatible DSH engine range. Run with `pnpm check:package`; pass
 * `--strict` to also refuse metadata placeholders before a release.
 *
 * Usage: node scripts/check-package.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const strict = process.argv.includes('--strict');
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJson(relative) {
  const path = join(root, relative);
  if (!existsSync(path)) {
    fail(`missing file: ${relative}`);
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`invalid JSON in ${relative}: ${String(error && error.message ? error.message : error)}`);
    return undefined;
  }
}

const manifest = readJson('package.json');
if (manifest) {
  for (const field of ['name', 'version', 'description', 'main', 'license']) {
    if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') fail(`package.json: "${field}" must be a non-empty string`);
  }
  if (typeof manifest.name === 'string' && (manifest.name.includes('<') || manifest.name.includes('>'))) {
    fail('package.json: name still contains an owner placeholder');
  }
  if (manifest.license !== 'MIT') fail('package.json: license must stay MIT');
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(manifest.version ?? '')) fail('package.json: version must be exact SemVer');
  if (manifest.publishConfig?.access !== 'public') fail('package.json: publishConfig.access must be "public"');
  const nodeRange = manifest.engines?.node;
  if (typeof nodeRange !== 'string' || nodeRange.trim() === '') fail('package.json: engines.node is required');
  const dshRange = manifest.engines?.dsh;
  if (typeof dshRange !== 'string' || dshRange.trim() === '') fail('package.json: engines.dsh is required');
  for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
    if (typeof range !== 'string' || range.trim() === '') fail(`package.json: peerDependencies["${name}"] must be a range`);
  }
  const bundlePatch = manifest.dsh?.bundle?.patch;
  if (typeof bundlePatch !== 'string' || !existsSync(join(root, bundlePatch))) {
    fail('package.json: dsh.bundle.patch must point at an existing patch file');
  }
  const client = manifest.dsh?.client;
  if (typeof client !== 'object' || client === null) {
    fail('package.json: dsh.client is required');
  } else {
    if (client.platform !== 'web') fail('package.json: dsh.client.platform must be "web"');
    if (!Array.isArray(client.inject) || client.inject.length === 0 || client.inject.some((entry) => typeof entry !== 'string')) {
      fail('package.json: dsh.client.inject must be a non-empty string array');
    }
  }
  if (typeof manifest.icon !== 'string' || !existsSync(join(root, manifest.icon))) fail('package.json: icon must point at an existing file');
  for (const [point, target] of Object.entries(manifest.exports ?? {})) {
    if (point === './package.json') continue;
    const cleaned = String(target).replace(/^\.\//, '');
    if (cleaned.includes('*')) {
      const directory = join(root, cleaned.slice(0, cleaned.indexOf('*')).replace(/\/$/, ''));
      const extension = cleaned.endsWith('.json') ? '.json' : '';
      let entries = [];
      try {
        entries = readdirSync(directory).filter((name) => !extension || name.endsWith(extension));
      } catch {
        entries = [];
      }
      if (entries.length === 0) fail(`package.json: exports["${point}"] matches no files: ${target}`);
      continue;
    }
    if (!existsSync(join(root, cleaned))) fail(`package.json: exports["${point}"] target is missing: ${target}`);
  }
  for (const file of manifest.files ?? []) {
    const cleaned = String(file).replace(/^\.\//, '');
    if (cleaned.includes('*')) {
      const directory = join(root, cleaned.slice(0, cleaned.indexOf('*')).replace(/\/$/, ''));
      const extension = cleaned.endsWith('.json') ? '.json' : '';
      let entries = [];
      try {
        entries = readdirSync(directory).filter((name) => !extension || name.endsWith(extension));
      } catch {
        entries = [];
      }
      if (entries.length === 0) fail(`package.json: files entry matches nothing: ${file}`);
      continue;
    }
    if (!existsSync(join(root, cleaned))) fail(`package.json: files entry is missing: ${file}`);
  }
  for (const locale of ['locale/en.json', 'locale/ru.json']) {
    const data = readJson(locale);
    if (data && (typeof data?.meta?.title !== 'string' || typeof data?.meta?.description !== 'string')) {
      fail(`${locale}: meta.title and meta.description are required`);
    }
  }
  const repositoryUrl = manifest.repository?.url ?? '';
  if (repositoryUrl.includes('<') || repositoryUrl.includes('>')) {
    const message = 'package.json: repository.url still has an owner placeholder; replace it before publishing';
    if (strict) fail(message);
    else warn(message);
  }
}

const clientPath = join(root, 'client', 'client.js');
if (existsSync(clientPath)) {
  const client = readFileSync(clientPath, 'utf8');
  const packageName = manifest?.name ?? '';
  if (packageName && !client.includes(`id: '${packageName}'`) && !client.includes(`id: "${packageName}"`)) {
    fail('client/client.js: bundle id does not match package.json name');
  }
} else {
  fail('client/client.js is missing');
}

for (const line of warnings) console.warn(`warning: ${line}`);
if (failures.length > 0) {
  for (const line of failures) console.error(`error: ${line}`);
  process.exit(1);
}
console.log('check:package ok');

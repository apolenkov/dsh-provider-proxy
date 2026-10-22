#!/usr/bin/env node
/**
 * Validate a DeepSeek Harness plugin-market index with the published validator.
 *
 * Validates `market/dsh-market.example.json` (the committed example). A release
 * index is validated the same way: pass its path as the first argument.
 *
 * Usage:
 *   node scripts/verify-market.mjs [index.json]
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marketInstallTarget, parseMarketIndex } from '@deepseek-ai/dsh-plugin-market-index';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const target = process.argv[2] ?? join('market', 'dsh-market.example.json');
const path = isAbsolute(target) ? target : join(root, target);

let document;
try {
  document = JSON.parse(readFileSync(path, 'utf8'));
} catch (error) {
  console.error(`error: cannot read ${target}: ${String(error && error.message ? error.message : error)}`);
  process.exit(1);
}

let index;
try {
  index = parseMarketIndex(document, 'https://example.invalid/market/dsh-market.example.json');
} catch (error) {
  console.error(`error: invalid market index ${target}: ${String(error && error.message ? error.message : error)}`);
  process.exit(1);
}

for (const plugin of index.plugins) {
  for (const version of plugin.versions) {
    try {
      const install = marketInstallTarget(plugin.name, version);
      if (typeof install.spec !== 'string' || install.spec === '') throw new Error('empty install spec');
    } catch (error) {
      console.error(`error: cannot build install target for ${plugin.name}@${version.version}: ${String(error && error.message ? error.message : error)}`);
      process.exit(1);
    }
  }
}

console.log(`check:market ok (${index.plugins.length} plugin${index.plugins.length === 1 ? '' : 's'} in ${target})`);

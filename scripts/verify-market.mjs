#!/usr/bin/env node
/**
 * Validate a DeepSeek Harness plugin-market index with the published validator.
 *
 * With no argument it validates the committed example and, when present, the
 * generated production index. Pass a path to validate one specific file.
 *
 * Usage:
 *   node scripts/verify-market.mjs [index.json]
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marketInstallTarget, parseMarketIndex } from '@deepseek-ai/dsh-plugin-market-index';

const root = join(fileURLToPath(import.meta.url), '..', '..');

/** Validate one index file; returns a short summary or exits on failure. */
function validate(target) {
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
    index = parseMarketIndex(document, `https://example.invalid/${target}`);
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
  return `${index.plugins.length} plugin${index.plugins.length === 1 ? '' : 's'} in ${target}`;
}

const explicit = process.argv[2];
if (explicit) {
  console.log(`check:market ok (${validate(explicit)})`);
} else {
  const targets = ['market/dsh-market.example.json'];
  if (existsSync(join(root, 'market', 'dsh-market.json'))) targets.push('market/dsh-market.json');
  for (const target of targets) console.log(`check:market ok (${validate(target)})`);
}

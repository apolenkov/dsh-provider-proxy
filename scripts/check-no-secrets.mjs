#!/usr/bin/env node
/**
 * Secret and private-data sweep for the public repository.
 *
 * Scans tracked text files (never `node_modules/`, `.git/`, or lockfiles) for
 * patterns that must not ship: internal hostnames, absolute user paths, private
 * keys, cloud/API credential prefixes, and proxy URLs carrying credentials.
 *
 * Usage: node scripts/check-no-secrets.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const skipDirs = new Set(['.git', 'node_modules', '.pnpm-store']);
const skipFiles = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']);

const patterns = [
  { name: 'internal hostname', source: /(digtp|eurochem|aimdt|suek)(\.[a-z0-9-]+)+/i },
  { name: 'absolute user path', source: /\/Users\/[a-zA-Z0-9_.-]+/ },
  { name: 'home directory leak', source: /\/home\/[a-zA-Z0-9_.-]+\// },
  { name: 'windows user path', source: /[A-Za-z]:\\Users\\/ },
  { name: 'private key block', source: /BEGIN [A-Z0-9 ]*PRIVATE KEY/ },
  { name: 'aws access key', source: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'github token', source: /\bghp_[A-Za-z0-9]{20,}\b/ },
  { name: 'deepseek key assignment', source: /DEEPSEEK_API_KEY\s*=\s*\S+/ },
  { name: 'openai key literal', source: /\bsk-(live|test|proj)-[A-Za-z0-9]{16,}\b/ },
  // Angle-bracketed <user>:<password> placeholders are documentation, not secrets.
  { name: 'proxy credentials in url', source: /https?:\/\/[^/\s:@<>]+:[^/\s@<>]+@/ },
];

function* walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (!skipDirs.has(entry)) yield* walk(path);
    } else if (!skipFiles.has(entry) && /\.(js|mjs|cjs|ts|json|ya?ml|md|svg|html|css|txt)$/.test(entry)) {
      yield path;
    }
  }
}

const hits = [];
for (const path of walk(root)) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  const relative = path.slice(root.length + 1);
  for (const { name, source } of patterns) {
    const match = text.match(source);
    if (match) hits.push(`${relative}: ${name} near ${JSON.stringify(match[0].slice(0, 80))}`);
  }
}

if (hits.length > 0) {
  for (const hit of hits) console.error(`error: ${hit}`);
  process.exit(1);
}
console.log('check:no-secrets ok');

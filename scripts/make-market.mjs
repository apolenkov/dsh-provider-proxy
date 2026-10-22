#!/usr/bin/env node
/**
 * Generate a production DSH market index (`format: 1`) from this repository.
 *
 * Reads `package.json` for the package name, version, description, and
 * repository URL, takes the current HEAD commit, and writes an index that
 * `scripts/verify-market.mjs` accepts. Refuses to run while the repository URL
 * still carries an owner placeholder, so an unpublished template can never be
 * shipped as a real listing.
 *
 * Usage:
 *   node scripts/make-market.mjs [--out market/dsh-market.json] [--check] [--source npm|git]
 *
 *   --check   validate the inputs and print the planned entry without writing
 *   --source  install source recorded in the index: `npm` (default, uses the
 *             published package) or `git` (pins the current commit)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const argv = process.argv.slice(2);

function flag(name) {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

function has(name) {
  return argv.includes(name);
}

const out = flag('--out') ?? 'market/dsh-market.json';
const checkOnly = has('--check');
const sourceKind = flag('--source') ?? 'npm';
if (sourceKind !== 'npm' && sourceKind !== 'git') {
  console.error(`error: --source must be npm or git, got ${sourceKind}`);
  process.exit(1);
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const rawUrl = manifest.repository?.url ?? '';
const url = rawUrl.replace(/^git\+/, '').replace(/\.git$/, '');

if (url === '') fail('package.json: repository.url is required');
if (url.includes('<') || url.includes('>')) {
  fail(`package.json: repository.url still has an owner placeholder (${rawUrl}); set the real public repository before generating a release index`);
}
if (!/^https:\/\/[^/\s]+\/[^/\s]+\/[^/\s]+$/.test(url)) {
  fail(`package.json: repository.url must be a canonical https repository URL, got ${rawUrl}`);
}

let commit;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
} catch {
  fail('cannot read the HEAD commit; generate the index from a git checkout');
}
if (!/^[0-9a-f]{40}$/.test(commit)) fail(`HEAD is not a 40-hex commit: ${commit}`);

const version = manifest.version;
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? '')) fail(`package.json: version must be exact SemVer, got ${version}`);

const publishTimestamp = Number.parseInt(execFileSync('git', ['log', '-1', '--format=%ct', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), 10);
if (!Number.isInteger(publishTimestamp) || publishTimestamp <= 0) fail('cannot read the HEAD commit timestamp');

const dshEngine = manifest.engines?.dsh;
if (typeof dshEngine !== 'string' || dshEngine.trim() === '') fail('package.json: engines.dsh is required for a market entry');

const document = {
  format: 1,
  title: { en: 'dsh-provider-proxy', ru: 'dsh-provider-proxy' },
  description: {
    en: 'Per-provider and per-model proxy routing plugin index.',
    ru: 'Индекс плагина маршрутизации прокси по провайдерам и моделям.',
  },
  metadata: {
    categories: { networking: { title: { en: 'Networking', ru: 'Сеть' } } },
    labels: {
      proxy: { title: { en: 'Proxy', ru: 'Прокси' } },
      llm: { title: { en: 'LLM routing', ru: 'Маршрутизация LLM' } },
    },
    sortKeys: {},
  },
  plugins: [
    {
      name: manifest.name,
      title: { en: 'Provider Proxy', ru: 'Маршруты прокси' },
      description: {
        en: manifest.description,
        ru: 'Направляйте хосты провайдеров и ID моделей через выбранные прокси.',
      },
      icon: `https://raw.githubusercontent.com/apolenkov/dsh-provider-proxy/main/icon.svg`,
      author: 'dsh-provider-proxy contributors',
      homepage: url,
      repository: { url: `${url}.git` },
      metadata: {
        category: 'networking',
        keywords: ['proxy', 'provider', 'model', 'routing'],
        labels: ['proxy', 'llm'],
        sortKeys: {},
      },
      versions: [
        {
          version,
          publishTimestamp,
          source: sourceKind === 'npm'
            ? { type: 'npm', name: manifest.name, version }
            : { type: 'git', url: `${url}.git`, commit },
          engines: { dsh: dshEngine },
        },
      ],
    },
  ],
};

const text = `${JSON.stringify(document, null, 2)}\n`;
if (checkOnly) {
  console.log(`check ok: ${manifest.name}@${version} at ${commit} from ${url}`);
  process.exit(0);
}

const target = isAbsolute(out) ? out : resolve(root, out);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, text);
console.log(`wrote ${out} (${manifest.name}@${version}, commit ${commit.slice(0, 12)})`);

if (!existsSync(target)) fail(`write failed: ${target}`);

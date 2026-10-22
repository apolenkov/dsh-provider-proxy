# Contributing

## Workflow

1. Pick an issue or open one describing the bug, feature, or UX gap.
2. Implement the smallest change that satisfies the acceptance criteria; keep host transport, UI copy, examples, and docs in sync.
3. Run the full gate before opening a PR:
   ```sh
   pnpm install --frozen-lockfile
   pnpm check
   ```
4. Open a PR with: what changed, why, how it was verified (tests + commands), screenshots or GIFs for UI changes, and the docs you updated.

## Rules

- Transport behavior is fail-closed: no half-applied route sets, no startup blocks on bad config, no secret values in logs, diagnostics, or committed files.
- UI text lives in `client/client.js` (`STRINGS.en` / `STRINGS.ru`); `locale/*.json` carries only the plugin metadata shown by DSH. Keep both locales complete when adding copy.
- Examples and tests use only loopback proxies (`127.0.0.1` with ephemeral ports) and `*.example` hostnames. Never commit real endpoints, credentials, API keys, or `~/.dsh` contents.
- Accessibility is a requirement, not polish: visible labels, inline errors with links from an error summary, keyboard focus management, 44px minimum touch targets, and `prefers-reduced-motion` support.
- New model/host matching semantics need unit tests in `test/core.test.js`; new transport behavior needs egress tests with the recording proxy; new plugin lifecycle behavior needs wiring tests.

## Labels

| Label | Use it for |
|---|---|
| `area/routing` | Matcher, precedence, dispatcher, fail-closed behaviour. |
| `area/ui` | Settings/Plugins pages, accessibility, copy, screenshots. |
| `area/docs` | Documentation, diagrams, examples, translations. |
| `area/marketplace` | Market index, packaging, distribution, release tooling. |
| `security` | Security-relevant reports (see also SECURITY.md — report privately first). |
| `good first issue` | Scoped, documented, no deep harness knowledge needed. |

## Versioning and release

- Versions follow SemVer; every release updates `CHANGELOG.md`.
- The `market/dsh-market.example.json` file is a template. A release index must reference the real repository URL, an exact tag commit, and the exact published version, then pass `pnpm check:market`.
- Never publish from a dirty tree: run `pnpm check`, tag with `git tag vX.Y.Z && git push --follow-tags`.
- `npm publish` is blocked until the final scoped package name is chosen: the unscoped `dsh-provider-proxy` is already taken on the public registry by an unrelated package. Until then, distribute via git (`dsh plugin add git+https://…#<commit>`) or a local path.

## Owner decisions still open

- GitHub owner/organization and final public repository URL.
- Final npm package scope (the unscoped `dsh-provider-proxy` is taken on the public registry by an unrelated package).
- Inclusion in community marketplaces (e.g. dsh.market) via the `dsh-plugin` topic or the hub's submission flow.

# dsh-provider-proxy

[![CI](https://github.com/apolenkov/dsh-provider-proxy/actions/workflows/ci.yml/badge.svg)](https://github.com/apolenkov/dsh-provider-proxy/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@apolenkov/dsh-provider-proxy?style=flat-square&logo=npm)](https://www.npmjs.com/package/@apolenkov/dsh-provider-proxy)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](./LICENSE)
[![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-339933?style=flat-square&logo=node.js&logoColor=white)](./package.json)
[![DSH ^0.2.1-rc.2](https://img.shields.io/badge/DSH-%5E0.2.1--rc.2-4D6BFE?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)
[![Tests](https://img.shields.io/badge/tests-41%20passing-brightgreen?style=flat-square)](#development)

Per-provider and per-model outbound proxy routing for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

DeepSeek Harness applies **one** proxy policy per process (`HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` / `ALL_PROXY`). This plugin layers two routing axes on top of it, configurable per provider host and per model ID — from a Plugins settings page, without touching YAML unless you want to.

```text
ctx.llm.stream({ provider, model })
        │  llm/stream waterfall → AsyncLocalStorage store per stream pull
        ▼
   adapter → globalThis.fetch
        ▼
   RoutingDispatcher (this plugin)
        ├─ model rule matched?  → direct / proxy / inherit
        ├─ host rule matched?   → direct / proxy / inherit
        ├─ loopback?            → always direct
        └─ otherwise            → the launcher’s policy (env + NO_PROXY)
```

- **Host axis** (`providers`): matches the request URL host — exact, subdomains, optional `host:port`. Applies to every `fetch()` in the process (LLM, web search, MCP).
- **Model axis** (`models`): matches the `provider`/`model` pair of the model call that issued the request. Exact ids and trailing-`*` prefixes, with an optional provider pin.
- **Precedence**: provider-pinned exact model → bare exact model → provider-pinned prefix → bare prefix → provider host rule → `default` (`inherit` or `direct`).

## Install

Prerequisite: a DSH profile with a plugin manager (the Desktop app and `dsh web` both qualify).

**From npm** (recommended):

```sh
dsh plugin --profile <profile> add @apolenkov/dsh-provider-proxy
```

**From git** (a release tag, no registry involved):

```sh
dsh plugin --profile <profile> add git+https://github.com/apolenkov/dsh-provider-proxy.git#v0.1.0
```

**From a local checkout:**

```sh
dsh plugin --profile <profile> add /absolute/path/to/dsh-provider-proxy
# or: link the directory in the profile's package.json and run pnpm install there
```

Then restart DSH. The bundle inserts the `provider-proxy` row; routes live in that row's config.

> npm note: the package is `@apolenkov/dsh-provider-proxy`; the unscoped name `dsh-provider-proxy` belongs to an unrelated package on the public registry, so never `pnpm add dsh-provider-proxy`.

## Configure

### In the UI (recommended)

Open **Plugins** in the sidebar → open the **dsh-provider-proxy** bundle → **Configure**. The page shows:

- **Default route** (`inherit` or `direct`);
- **Provider rules**: label, hosts (comma or newline separated), proxy (`inherit` / `direct` / custom `http(s)://` URL);
- **Model rules**: model id (exact or trailing `*`), optional provider pin, proxy.

Edits are staged locally and applied on **Save** with revision fencing: if someone changed the config meanwhile, the save is refused instead of silently overwriting. Clearing the form is never written; leaving the page drops staged edits.

### In YAML

Add or edit the row in the profile’s `cordis.patch.yml` (HMR applies it live, no restart):

```yaml
- id: provider-proxy
  name: "dsh-provider-proxy"
  config:
    default: inherit
    providers:
      corp:
        hosts: ["llm.internal.example"]
        proxy: direct
      opencode-go:
        hosts: ["opencode.ai"]
        proxy: "http://127.0.0.1:1301"
    models:
      "muse-spark-1.3-contributor":
        provider: opencode-go
        proxy: "http://127.0.0.1:1301"
      "longcat-*": inherit
```

An invalid entry refuses the whole configuration (fail-closed): the plugin logs the reason, keeps the previous routes, and never partially applies them.

### Proxy values

| Value | Meaning |
|---|---|
| `inherit` | Use the launcher’s process proxy policy (env + `NO_PROXY`). |
| `direct` | Connect to the origin directly, ignoring the process proxy policy. |
| `http(s)://…` | Route through that proxy (`ProxyAgent`). SOCKS and PAC are rejected. |

The UI additionally refuses proxy URLs with embedded credentials — keep secrets out of the profile patch.

## Muse Spark example

Route one model through its own proxy while everything else follows the launcher policy:

```yaml
- id: provider-proxy
  name: "dsh-provider-proxy"
  config:
    default: inherit
    models:
      "muse-spark-1.3-contributor":
        provider: opencode-go
        proxy: "http://127.0.0.1:1291"
```

See [`examples/models-muse-spark.yaml`](./examples/models-muse-spark.yaml) (sanitized: loopback endpoints, no credentials). The same rule can be created in the Plugins page — the walkthrough is captured with [`assets/scripts/record-proxy-ui.sh`](./assets/scripts/record-proxy-ui.sh) into [`assets/gifs`](./assets/gifs/).

## Verify it works

The plugin writes its last apply outcome (never secrets) to `$DSH_HOME/provider-proxy/state.json`:

```json
{
  "appliedAt": "2026-10-22T07:59:22Z",
  "pid": 42120,
  "status": "active",
  "routes": "muse-spark-1.3-contributor→http://127.0.0.1:1301, llm.internal.example→direct, default→inherit"
}
```

A live rule can be proven by pointing it at a dead proxy (`http://127.0.0.1:9`) and watching the request fail with `ECONNREFUSED 127.0.0.1:9` instead of reaching its target — then restore the real proxy.

## Limits

- WebSocket transports are not guaranteed to pass through the undici dispatcher; use an `http`/`https` transport for strict routing.
- `web_fetch` pins validated addresses through the launcher's own policy and may bypass these routes; model traffic is covered.
- Model rules apply only inside `llm/stream`; web search and MCP use the host axis.
- A model rule never fires for non-model traffic that happens to hit the same host, and a host rule never overrides `localhost` / loopback.
- Proxy URLs with credentials are accepted by the transport but rejected by the UI; prefer credential-free proxy endpoints.

## Walkthrough

![Proxy routes settings page: provider and Muse Spark model rules, an inline validation error, and a successful save](assets/gifs/proxy-ui.gif)

Recorded in a scratch profile with a loopback proxy: open the bundle’s Configure page, add the Muse Spark model rule, trigger and fix a validation error, save. Individual frames live in [`assets/screenshots/`](./assets/screenshots/); reproduce or re-record with [`assets/scripts/record-proxy-ui.sh`](./assets/scripts/record-proxy-ui.sh).

## Publishing

Owner-side checklist for the first public release (repository URL, npm scope, market index,
hub listing): [docs/publishing.md](./docs/publishing.md). Automated gates:

```sh
pnpm check:release   # strict manifest + secrets + generated market index + tests
pnpm release:market  # writes market/dsh-market.json from package.json + HEAD
```

## Development

```sh
pnpm install --ignore-scripts   # or: pnpm install --frozen-lockfile
pnpm test                       # node:test, 41 tests: matching, precedence, ALS isolation, egress, wiring, volatile updates, agent retirement, client contract, UI form logic
pnpm check                      # manifest + secrets + market validation + full test suite
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) (workflow, commit style, release checklist), [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md), and [docs/](./docs/) — an index with architecture, configuration reference, UI guide, publishing checklist, marketplace notes, troubleshooting, and a glossary.

## Marketplace

To list this plugin in a DSH market, ship a format-1 index validated with `pnpm check:market`. A documented example lives in [`market/dsh-market.example.json`](./market/dsh-market.example.json); production indexes must replace the example repository URL and commit. Listing on community hubs (e.g. [dsh.market](https://dsh.market/)) additionally requires the `dsh-plugin` topic on the GitHub repository or a submission through the hub’s own flow — see [docs/marketplace.md](./docs/marketplace.md).

## License

MIT — see [LICENSE](./LICENSE). DeepSeek Harness itself is a separate project by DeepSeek; this plugin is community work and is not affiliated with or endorsed by them.

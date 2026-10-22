# Changelog

All notable changes to `dsh-provider-proxy` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-22

### Added
- **Settings page**: the route editor is now also a first-class `Settings → Proxy routes`
  section beside Models, registered through the `settings.section` slot. Same component,
  same form, same revision fencing as the Plugins page.
- **Chinese localisation**: full `zh` dictionary, `locale/zh.json`, and `README.zh.md`;
  the UI follows the harness locale (Settings → General → Language) with `en`/`zh`/`ru`.
- Mermaid diagrams (flow, precedence, failure states), repository banner, roadmap,
  and area labels for issues and pull requests.

### Changed
- The browser entry reads the active locale from the harness locale face instead of
  the browser language, so switching the harness language switches the page.

## [Unreleased]

### Added
- Per-provider and per-model outbound proxy routing through a process-wide undici dispatcher.
- Settings UI page (Plugins row configuration) with staged drafts, revision-fenced writes, inline validation, and `en`/`ru` copy.
- Fail-closed configuration: invalid entries refuse the whole route set and never route traffic surprisingly.
- Diagnostics file `$DSH_HOME/provider-proxy/state.json` recording apply outcome and routes.
- Removed proxy rules retire and close their cached proxy agents instead of leaking them for the process lifetime.
- Egress, concurrency, wiring, and manifest test suites (`node --test`).
- DSH marketplace format-1 example index, a generator for the production index, and validating tooling.
- Verified Discover-to-install flow: the published index installs the bundle from its pinned git source, and the configuration UI loads.

## [0.1.0] - 2026-10-22

- Initial public release: per-provider and per-model proxy routing, the Proxy routes
  Plugins page, diagnostics, examples, docs, and market tooling.
- Published to npm as `@apolenkov/dsh-provider-proxy`.

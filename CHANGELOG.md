# Changelog

All notable changes to `dsh-provider-proxy` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [0.2.2] - 2026-10-23

### Fixed
- **Rules collapse into full-width cards in narrow panels**: the Settings modal gives the
  editor only ~530 px, so a four-column table left ~106 px per field and clipped the text.
  A container query now stacks each rule into a card below 760 px — every field spans the
  panel, the row action stays visible, and no horizontal scroll appears. Wide pages keep
  the table.
- Rebalanced the wide table columns so the longest model id is no longer clipped by 2 px.

## [0.2.1] - 2026-10-23

### Fixed
- **Invisible primary button in dark themes**: Save used the brand accent fill
  (`--dsw-alias-brand-primary`, near-white in the DSH dark theme) with hard-coded white
  text, so the label disappeared. It now uses the contrast button token pair
  (`--dsw-alias-button-contrast-fill` + `--dsw-alias-label-primary-inverted`), which stays
  readable in both light and dark themes.
- **Clipped rule fields**: the rule table now uses a fixed layout with proportional
  columns, so the model/host inputs and the row action keep their width instead of
  squeezing the text out of view at narrow widths.

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

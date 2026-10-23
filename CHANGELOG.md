# Changelog

All notable changes to `dsh-provider-proxy` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [0.2.4] - 2026-10-23

### Changed
- **Rules render as cards instead of a table.** Each rule is a card with a muted
  "Provider rule N" / "Model rule N" header, the action in the header, and a responsive grid
  (`repeat(auto-fit, minmax(260px, 1fr))`): one full-width column at the ~530 px Settings
  panel, three columns on the wide Plugins page. This removes the table-layout leftovers that
  squeezed fields to half the card and left the action floating at the card bottom.
- **Spacing scale:** root gap 16, card padding 16, field gap 6, controls 40 px high, hints
  `line-height: 1.45`; section rhythm is now 4/8/12/16 instead of ad-hoc values.
- **Copy:** the status pill pluralises properly — "1 provider rule · 1 model rule" instead of
  "1 provider rule(s)", with Russian three-form plurals.

## [0.2.3] - 2026-10-23

### Fixed
- **Rule action moved into the card corner**: in the narrow Settings panel the row action sat
  at the bottom of a tall card, added ~44 px of height, and scrolled out of view below the
  fold. It is now a compact 28 px button pinned to the card's top-right corner (still labelled
  for screen readers) and the fields keep the full width next to it.

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

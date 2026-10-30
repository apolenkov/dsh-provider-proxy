# Changelog

## [0.3.0] - 2026-10-29

### Added
- **Injected headers per rule**: `providers[label].headers` and `models[id].headers` add headers to the requests a rule matches. The value token `{{opencodeSession}}` expands to a fresh OpenCode-shaped `ses_`-id on every dispatch, so an anonymous gateway that requires a per-conversation header works with a hand-declared model route.
- `injectHeaders` and `opencodeSessionId` exports in the routing core, covered by unit tests.
- **Headers editor in the Plugins page**: both rule kinds show an "Injected headers" field (one `Name: value` per line), validated before save; the token `{{opencodeSession}}` is editable there too.
- Route summary marks rules with injected headers (`+hdr`) in the startup log and `state.json`.

### Changed
- The Plugins page keeps a rule's `headers` through edits and saves; there is no dedicated header editor yet, so header rules are authored in `cordis.patch.yml`.

All notable changes to `dsh-provider-proxy` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [0.2.7] - 2026-10-24

### Fixed
- **Vertical spacing around the action row**: the Add/Save/Discard buttons sat flush against
  the last rule card and the state note sat flush against the buttons. The action row now has
  16 px above it, section titles get 16 px above them (except at the card top), and the note
  gets 10 px below the buttons. Horizontal gaps and the right-aligned Save are unchanged.

## [0.2.6] - 2026-10-24

### Fixed
- **Card header action**: the per-rule delete moved from the card bottom into the header
  next to the rule name, so it never scrolls out alone and adds no dead height.
- **Duplicate caption removed**: the proxy URL now has a real `<label>` above the input;
  the format hint shows only in custom mode instead of under every Proxy select.
- **Rhythm**: `px-field` gap 8, card head margin 14, grid row gap 20; empty error rows
  collapse (`:empty` + conditional render keeps the `aria-describedby` node); hints 12px;
  Hosts textarea 48px instead of 66px; Remove button 32px with a disabled state.

## [0.2.5] - 2026-10-23

### Changed
- **Cards at every width:** rules no longer depend on a table + container query. Each rule
  is a card (header with the rule name and the Remove action, fields in an auto-fit grid:
  one column in the ~530 px Settings panel, three on the wide Plugins page). Fields always
  span the card, and the action never overlaps content or scrolls out of view.
- **Status pill pluralises:** "1 provider rule · 1 model rule" (Russian three-form plurals too).

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

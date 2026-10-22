# Roadmap

What is shipped, what is next, and what is deliberately out of scope.

## Shipped in 0.1.0

- Per-provider (host axis) and per-model (model axis) routing over the process proxy policy.
- Route editor in two seats: **Settings → Proxy routes** and the bundle's page on Plugins.
- Fail-closed configuration, revision-fenced saves, live HMR updates.
- Diagnostics in `$DSH_HOME/provider-proxy/state.json`.
- en / ru / zh copy, screenshots, walkthrough GIF.
- npm + git distribution, DSH market index, `dsh-plugin` topic.

## Next

1. **Models-page presence** — decide between a footer summary on the Models page and a provider-card block once a stable public mapping from provider route to settings namespace exists. Today the provider-card slot belongs to adapter-family plugins and a keyed registration would replace its owner, so the plugin uses its own Settings page instead (see `docs/proxy-ui.md`).
2. **Route presets** — one-click "all traffic direct", "everything through this proxy", and per-provider templates to cut the blank-page problem.
3. **Rule import/export** — copy a JSON/YAML fragment for the profile patch, so the UI and hand-edited config stay interchangeable.
4. **Better diagnostics** — a "last matched rule" field per request in `state.json` (bounded ring buffer), to answer "which rule caught this?" without log diving.
5. **End-to-end UI test** — headless browser test that opens the Settings page, edits a rule, and saves against a scratch profile.

## Investigate

- **SOCKS5** — the transport currently accepts only `http(s)` proxies. Supporting `socks5://` means adding a SOCKS dispatcher dependency; worth it only if users ask.
- **Per-MCP / per-tool routing** — model rules cover `llm/stream`; tool traffic falls back to the host axis. A tool-aware axis needs a stable carry from the tool call into ALS.
- **WebSocket transports** — undici does not route WS through the dispatcher; document per-transport behaviour rather than promise coverage.

## Out of scope

- Patching the DeepSeek Harness installation (the Models page, its provider cards, or the global proxy bootstrap). This plugin extends through documented slots only.
- Global credential storage for proxy authentication; the UI refuses proxy URLs with embedded credentials on purpose.
- Acting as a general HTTP proxy or PAC server.

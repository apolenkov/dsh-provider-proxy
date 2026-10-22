# Troubleshooting

## The plugin row shows `rejected`

Open `$DSH_HOME/provider-proxy/state.json`. `status: rejected` means the last configuration failed validation and the previous routes (or the launcher policy) stayed in place. The application log names the offending path, for example `models["muse-spark-1.3-contributor"].proxy`.

Common causes:

- `socks5://…` or `pac:` URLs — only `http://` and `https://` are supported;
- an empty `hosts` list, or a host with a path (`example.com/v1`), scheme (`https://…`), or whitespace;
- an out-of-range or non-numeric port (`:0`, `:99999`, `:abc`);
- a `provider` pin that is empty while the long object form is used;
- an empty model id (`""` or a bare `"*"`).

Fix the entry and save again; the next valid configuration replaces the failed one.

## `state.json` says `idle`

No rules are configured: `providers` and `models` are both empty. The process policy installed by the launcher keeps deciding everything. Add at least one rule.

## UI shows “conflict” on save

Another writer changed the entry after the form was read. Re-read the page (`Discard` reloads the current server state), re-apply your change if still needed, and save again.

## UI shows “read-only”

The deployment’s settings document does not accept writes from this client. Edit the profile patch directly, as documented in [configuration.md](./configuration.md).

## Traffic does not follow a rule

1. Check `state.json`: it lists the routes the dispatcher actually installed.
2. Confirm loopback is not involved — `localhost`, `127.0.0.1`, `::1`, and friends always go direct by design.
3. Confirm WebSocket transports are not involved — only `http(s)` model traffic is covered.
4. Confirm you are not expecting `web_fetch` to follow these routes — it pins addresses through the launcher policy by design.
5. Prove the mechanism with a dead proxy: point the rule at `http://127.0.0.1:9` and watch the request fail with `ECONNREFUSED 127.0.0.1:9`, then restore the real proxy.

## Startup is unaffected

A broken configuration, a missing `undici`, or a dispatcher install failure never stops the Harness boot: the plugin logs, writes a `failed` or `rejected` state, and leaves the launcher’s policy in place.

# Configuration reference

Routes live on the profile entry with id `provider-proxy`, edited in the Plugins page or in `cordis.patch.yml`.

```yaml
- id: provider-proxy
  name: "dsh-provider-proxy"
  config:
    default: inherit
    providers:
      corp:
        hosts: ["llm.internal.example", "[::1]:8443"]
        proxy: direct
    models:
      "muse-spark-1.3-contributor":
        provider: opencode-go
        proxy: "http://127.0.0.1:1301"
      "longcat-*": inherit
```

## `default`

`inherit` (defer to the launcher policy) or `direct` (bypass it). Used when no rule matches.

## `providers`

A mapping of labels to `{ hosts, proxy }`. Labels are free-form names.

- `hosts`: one host, or a list. Forms: `example.com` (also matches all subdomains, not lookalikes like `notexample.com`), `host:port` (that port only), `[IPv6]` and `[IPv6]:port`. Case-insensitive; a trailing dot is ignored.
- `proxy`: `inherit`, `direct`, or an `http://` / `https://` URL.
- `headers` (optional): headers added to every request the rule matches, as a flat name→value mapping.

## `models`

A mapping of model ids (or trailing-`*` prefixes) to a proxy string or a `{ proxy, provider?, headers? }` object. `provider` pins the rule to one Harness provider route; an empty/absent pin means any provider.

### Injected headers

Both axes accept `headers`. A header value may contain the token `{{opencodeSession}}`; at dispatch time it is replaced with a fresh OpenCode-shaped session id (`ses_` + 12 hex of an inverted millisecond timestamp + 14 base62 characters). This covers anonymous gateways that require a per-conversation header the model adapter does not send for hand-declared models:

```yaml
    models:
      "beam-free":
        provider: opencode-go
        proxy: "http://127.0.0.1:1301"
        headers:
          x-opencode-session: "{{opencodeSession}}"
```

Rules are validated as a unit: an invalid header name, an empty value, or a value containing a line break refuses the whole configuration. Loopback traffic never receives injected headers, because loopback always bypasses routing.

Precedence (first match wins):

1. Model exact id with provider pin.
2. Model exact id without provider pin.
3. Model prefix with provider pin.
4. Model prefix without provider pin.
5. Provider host rule.
6. `default`.

## Volatile fields

`default`, `providers`, and `models` are volatile: settings writes commit into the running references through `loader/volatile-update` without restarting the plugin. Unknown or malformed entries reject the whole configuration; the previous routes keep serving.

# Proxy UI

Open **Plugins** in the sidebar → open the **dsh-provider-proxy** bundle → **Configure**. The page edits the Host entry `provider-proxy` through the shared settings form.

## What you see

- A summary line: rule counts and the default route.
- **Default route** select (`inherit` / `direct`).
- **Provider rules** table: label, hosts, proxy (inherit / direct / custom URL).
- **Model rules** table: model ID, optional provider pin, proxy.
- Save / Discard / Reset to defaults, plus a precedence reminder and a diagnostics note.

The page renders inside the plugin manager’s bundle-configuration slot between the bundle description and its rows. The Models page is untouched: this page mirrors the model/provider vocabulary but writes a different entry.

## Behavior

- Nothing is written until **Save**. Leaving the page drops staged edits.
- Every write carries the settings revision the form was read at; a stale write is refused instead of silently overwriting, and the page offers reload-or-overwrite.
- Validation runs on blur and on save: inline errors under the offending field, linked from a keyboard-focusable error summary.
- Proxy URLs with embedded credentials are refused by the page (keep secrets out of the profile patch).
- Saving applies live through HMR: the host replaces the route table atomically and updates `$DSH_HOME/provider-proxy/state.json`.

## Accessibility

- Visible labels on every input; no placeholder-only fields.
- `aria-invalid` and `aria-describedby` link each field to its hint and error.
- Error summary uses `role="alert"`, receives focus on failed submit, and links to fields.
- Controls are at least 44px tall; tables scroll horizontally on narrow screens instead of overflowing.
- Motion respects `prefers-reduced-motion`.

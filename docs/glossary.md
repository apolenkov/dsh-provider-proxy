# Glossary

- **Process proxy policy** — the one undici dispatcher the launcher resolves from `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, and `NO_PROXY` before any plugin loads.
- **Host axis** — a rule on `providers.<label>.hosts`: matches a request URL’s host (exact, subdomains, optional port).
- **Model axis** — a rule on `models.<id>`: matches the `provider`/`model` pair of the model call that issued the request.
- **Decision** — `inherit` (defer to the process policy), `direct` (bypass it), or an `http(s)://` proxy URL.
- **Volatile field** — a Cordis config field the settings service can commit into a running plugin without remounting it.
- **Entry / namespace** — the profile patch row `provider-proxy`; the UI reads and writes the same namespace the Host validates.
- **Fail-closed** — any invalid rule refuses the whole configuration instead of routing some traffic by surprise.
- **`state.json`** — `$DSH_HOME/provider-proxy/state.json`: the last apply outcome (`active`, `idle`, `rejected`, `failed`) and the installed routes, without secrets.

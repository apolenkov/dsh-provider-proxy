# Security Policy

## Supported versions

Only the latest `0.x` release line receives security fixes until the first stable `1.0.0`.

## Reporting a vulnerability

Open a **private** security advisory on the GitHub repository (Security → Advisories). Do not open public issues for vulnerabilities. Include:

- what is affected (routing core, UI, settings writes, marketplace metadata),
- steps to reproduce with loopback endpoints only,
- impact assessment (proxy bypass, credential exposure, startup denial).

Expect an acknowledgment within 7 days.

## Handling secrets

- Never commit proxy credentials, API keys, private endpoints, or `$DSH_HOME` contents. Run `pnpm check:no-secrets` before every PR.
- The UI refuses proxy URLs with embedded credentials; YAML configuration does not block them because some deployments legitimately use authenticated proxies. Storing them in a profile patch is at your own risk — prefer credential-free proxy endpoints or mount-level secret injection.
- Diagnostics (`$DSH_HOME/provider-proxy/state.json`, logs, GIFs) must never contain credentials, full proxy URLs with userinfo, or private hostnames.

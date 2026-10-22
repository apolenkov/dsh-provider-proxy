## What changed

<!-- One or two sentences. Link the issue when there is one. -->

## Why

<!-- The routing/UI/behavior gap this closes. -->

## Verification

- [ ] `pnpm check` passes locally (manifest, secrets, market example, tests)
- [ ] New routing semantics have unit tests; new transport behavior has egress tests
- [ ] Both locales (`en`, `ru`) updated when UI copy changed
- [ ] Examples and docs updated when the configuration surface changed
- [ ] Screenshots/GIF re-recorded when the Proxy routes page changed
- [ ] No credentials, private hostnames, or `$DSH_HOME` contents in the diff

## Notes for reviewers

<!-- Tradeoffs, failure semantics, rollback, anything surprising. -->

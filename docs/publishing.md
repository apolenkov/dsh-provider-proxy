# Publishing and marketplace release

This is the owner-side checklist that turns this repository into a public,
installable, market-listed plugin. Everything mechanical is automated; only the
identity decisions below need a human.

## 0. Decisions only the owner can make

| Decision | Why it is not automated | Recommendation |
|---|---|---|
| Public repository URL (`<OWNER>/dsh-provider-proxy`) | Needs the GitHub account/organization | Create the repository, then set it in `package.json` |
| npm package name | The unscoped `dsh-provider-proxy` is already published by an unrelated package (v0.6.0), so the registry refuses this one | Publish as `@<scope>/dsh-provider-proxy` |
| npm scope ownership | Registry permissions | Use a scope you control; keep the bundle name and row id unchanged |

Git-only distribution needs neither decision: `dsh plugin add git+ssh://…` works
today and is documented in the README.

## 1. Point the repository at its public home

```sh
# repository URL (no angle brackets, canonical https form)
npm pkg set repository.url="git+https://github.com/<OWNER>/dsh-provider-proxy.git"

# only when publishing to npm under a scope
npm pkg set name="@<scope>/dsh-provider-proxy"
npm pkg set publishConfig.access=public
```

If the npm name changes, update the bundle id in `client/client.js`
(`const BUNDLE_ID = …`) and re-run the contract test; the test fails while they
disagree. Keep `name` in `cordis.patch.yml` and `$DSH_HOME` expectations in sync.

## 2. Verify before anything leaves the machine

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check            # manifest, secrets, market example, full test suite
pnpm check:release    # strict: refuses placeholders + validates the generated index
```

`check:release` fails while `package.json` still has `<OWNER>` in the repository
URL — that is the intended guard.

## 3. Publish

**Git (always available):**

```sh
git tag v0.1.0 && git push --follow-tags
dsh plugin --profile <profile> add "git+https://github.com/<OWNER>/dsh-provider-proxy.git#$(git rev-parse HEAD)"
```

**npm (scoped name only):**

```sh
npm publish --access public
```

The unscoped name cannot be published: `npm publish` refuses it because the
registry already has `dsh-provider-proxy@0.6.0` from another author.

## 4. Produce the market index

```sh
pnpm release:market             # writes market/dsh-market.json from package.json + HEAD
pnpm check:market               # validates market/dsh-market.example.json
node scripts/verify-market.mjs market/dsh-market.json
```

Commit `market/dsh-market.json` with the release tag, or host it wherever your
index is served. `market/dsh-market.example.json` stays a template.

## 5. List in the community hub

1. Add the `dsh-plugin` topic to the public repository (the hub discovers plugins by topic).
2. Open a submission issue through [dsh.market](https://dsh.market/) if the hub requires one.
3. After acceptance, add the hub badge to both READMEs.

## 6. After release

- Verify the published bundle loads: install it into a scratch profile, open
  Plugins → provider-proxy → Configure, and confirm `$DSH_HOME/provider-proxy/state.json`
  reports `active` with the expected routes.
- Record the walkthrough GIF against that scratch profile with
  [`assets/scripts/record-proxy-ui.sh`](../assets/scripts/record-proxy-ui.sh).
- Update `CHANGELOG.md` with the released version and date.

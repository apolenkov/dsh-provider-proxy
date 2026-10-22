# Publishing and marketplace release

This is the owner-side checklist that turns this repository into a public,
installable, market-listed plugin. Everything mechanical is automated; only the
identity decisions below need a human.

## 0. Decisions only the owner can make

| Decision | Why it is not automated | Recommendation |
|---|---|---|
| ~~Public repository URL~~ | Decided | `https://github.com/apolenkov/dsh-provider-proxy` |
| ~~npm package name~~ | Decided | `@apolenkov/dsh-provider-proxy` — the unscoped name belongs to an unrelated package (v0.6.0) |
| npm publish credentials | The registry token on this machine is expired | Run `npm login`, then `npm publish --access public` |

Git-only distribution needs neither decision: `dsh plugin add git+ssh://…` works
today and is documented in the README.

## 1. Repository and package identity (decided)

- Public repository: <https://github.com/apolenkov/dsh-provider-proxy> (public, topics `dsh-plugin`, `deepseek-harness`, `proxy`, `model-routing`).
- npm package name: `@apolenkov/dsh-provider-proxy`.
- Production market index: `market/dsh-market.json`, generated with `pnpm release:market`.

## 2. Point the repository at its public home

```sh
# repository URL (no angle brackets, canonical https form)
npm pkg set repository.url="git+https://github.com/apolenkov/dsh-provider-proxy.git"

# only when publishing to npm under a scope
```

The package name is already final: `@apolenkov/dsh-provider-proxy`. It appears in
`package.json`, `cordis.patch.yml` (loader `name`), the browser module ids in
`client/client.js` and its chunks, and the examples. The contract test fails if
the bundle id drifts from the manifest name.

## 2. Verify before anything leaves the machine

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check            # manifest, secrets, market example, full test suite
pnpm check:release    # strict: refuses placeholders + validates the generated index
```

`check:release` fails while `package.json` still has an owner placeholder in the
repository URL — that guard is now satisfied.

## 3. Publish

**Git (always available):**

```sh
git tag v0.1.0 && git push --follow-tags
dsh plugin --profile <profile> add "git+https://github.com/apolenkov/dsh-provider-proxy.git#$(git rev-parse HEAD)"
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

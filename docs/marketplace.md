# Marketplace

Two different things are both called “the market”. This plugin supports both.

## 1. DSH format-1 index (user-configured indexes)

The Host reads `format: 1` JSON indexes that list installable bundles with display metadata. Generate and validate an entry with:

```sh
pnpm check:market
```

The committed example is [`market/dsh-market.example.json`](../market/dsh-market.example.json). It is a **template**: replace the example repository URL with the real one and the zero commit with the exact published commit, then re-run the check. Production indexes must not contain `example.com` URLs or placeholder commits.

An entry needs, per version:

- an exact SemVer version and an integer `publishTimestamp`,
- a source: `npm` (`name@version`, optional registry) or `git` (canonical `https:` URL, lowercase 40-hex commit SHA, optional in-repo `path`),
- an `engines.dsh` SemVer range the target runtime satisfies, and no `workspace:` ranges.

Install from a git source:

```sh
dsh plugin --profile <profile> add git+https://github.com/apolenkov/dsh-provider-proxy.git#<commit>
```

## 2. Community hub (dsh.market)

The community hub at [dsh.market](https://dsh.market/) auto-discovers DSH plugins by the `dsh-plugin` GitHub topic and by submission issues. To be listed:

1. Add the `dsh-plugin` topic to the public repository.
2. Optionally open a submission issue through the hub’s own flow, and add the hub’s “listed” badge to the README once accepted.

The hub may impose its own review and metadata requirements; they are independent of the format-1 file shipped here.

## Why this repo does not modify the Models page

The Models card belongs to the installation-owned Models package. Adding proxy fields there would mean patching DSH itself, which updates overwrite. The Proxy routes page is registered separately on this bundle (`plugins.bundle.config`), so it survives DSH upgrades.

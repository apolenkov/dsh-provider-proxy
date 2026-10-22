# Publishing to a DSH market

This directory holds the ingredients, not a finished production index.

## Format-1 index

`dsh-market.example.json` is a documented template of a DeepSeek Harness plugin-market index (format 1). The real index must replace:

- `homepage` and `repository.url` with the public repository,
- `source.url` with the real repository URL,
- `source.commit` with the exact 40-hex release commit,
- `publishTimestamp` with the release timestamp,
- `name` with the final package name if it differs from the template.

Validate with:

```sh
pnpm check:market           # validates market/dsh-market.example.json
node scripts/verify-market.mjs path/to/real-index.json
```

The checked-in example deliberately uses `example.com` URLs and a zero commit so it can never be mistaken for a real listing.

## Community hub (dsh.market)

dsh.market discovers plugins by the `dsh-plugin` GitHub topic and by submission issues:

1. Publish the repository publicly.
2. Add the `dsh-plugin` topic to the repository.
3. Optionally open a submission issue through the hub’s own flow, and add its “listed” badge once accepted.

The hub may impose its own review and metadata. Those requirements are independent of the format-1 file validated here.

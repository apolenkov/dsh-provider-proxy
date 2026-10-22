# Examples

Copy a block into the `provider-proxy` entry of the profile’s `cordis.patch.yml` (or enter it in the Plugins → dsh-provider-proxy → Configure page). All endpoints are loopback placeholders: replace them with the real proxy of the deployment, never commit credentials.

- [`providers.yaml`](./providers.yaml) — host-axis rules.
- [`models-muse-spark.yaml`](./models-muse-spark.yaml) — the worked Muse Spark example used in the README and GIFs.
- [`models-wildcard.yaml`](./models-wildcard.yaml) — model prefixes and a provider pin.
- [`invalid-examples.yaml`](./invalid-examples.yaml) — commented-out shapes the plugin rejects (do not paste them active).

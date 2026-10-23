# UI GIFs

Recorded walkthroughs live here, captured against a scratch profile with loopback endpoints only:

- [`proxy-ui.gif`](./proxy-ui.gif) (960px, 5 frames × 1.5 s, loops, English UI) — open Plugins → dsh-provider-proxy → Configure, show the configured Muse Spark rule, trigger and fix a validation error, save, then open the same editor in Settings → Proxy routes. Individual frames live in [`assets/screenshots/en/`](../screenshots/en/).

Rules while recording:

- loopback proxies (`127.0.0.1`) and `*.example` hosts only;
- no credentials, no real endpoints, no API keys;
- capture at most 960px wide, 2 fps, with captions and pause controls on playback;
- honor `prefers-reduced-motion` for any autoplay on the README page.

Until the GIFs are recorded, follow [`assets/scripts/record-proxy-ui.sh`](../scripts/record-proxy-ui.sh).

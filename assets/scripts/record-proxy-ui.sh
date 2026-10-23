#!/usr/bin/env bash
# Record the Proxy UI walkthrough as a GIF for the README.
#
# What it does:
#   1. Opens the Plugins page and the dsh-provider-proxy Configure page.
#   2. Stages the Muse Spark example from docs/usage.
#   3. Captures screenshots of: default view, staged edit, validation error,
#      save, and the same editor in Settings → Proxy routes.
#   4. Assembles assets/gifs/proxy-ui.gif from the screenshots.
#
# Record with the harness locale set to English (Settings → General → Language,
# or `- id: locale` with `preference: en` in the scratch profile) so the
# walkthrough ships in English; crop the session sidebar out of every frame.
#
# What it never does:
#   - no real proxy credentials, hosts, or model traffic;
#   - no writes outside a scratch profile and the loopback test endpoints.
#
# Usage:
#   bash assets/scripts/record-proxy-ui.sh "<dsh-web-url>" <profile>
#
# Requirements: agent-browser, ffmpeg (or Pillow fallback, see below), jq.
set -u
WEB_URL="${1:?usage: record-proxy-ui.sh <dsh-web-url> <profile>}"
PROFILE="${2:?usage: record-proxy-ui.sh <dsh-web-url> <profile>}"
OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHOTS="$OUT_DIR/screenshots/proxy-ui"
GIF="$OUT_DIR/gifs/proxy-ui.gif"
mkdir -p "$SHOTS"
echo "1. Open $WEB_URL in the profile '$PROFILE'."
echo "2. Go to Plugins > dsh-provider-proxy > Configure."
echo "3. Add model rule: id 'muse-spark-1.3-contributor', provider 'opencode-go', proxy 'http://127.0.0.1:1291'."
echo "4. Trigger one validation error (e.g. socks5://...), screenshot it, then fix it."
echo "5. Save; screenshot the confirmation."
echo "6. Assemble: ffmpeg -framerate 2 -i '$SHOTS/shot-%02d.png' -vf 'scale=960:-1' '$GIF'"
echo "   (If ffmpeg is missing, use Python Pillow to stitch the PNGs.)"
echo "Screenshots go in: $SHOTS"
echo "Final GIF: $GIF"

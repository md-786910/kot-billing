#!/usr/bin/env bash
# Creates the Layali Android release key (once) and prints what to add to GitHub Secrets.
# Keep the .keystore file and its passwords safe: every future update must be signed with the
# same key, or phones will refuse to install it over the existing app.
set -euo pipefail

DIR="${1:-$HOME/.layali}"
KEYSTORE="$DIR/layali-release.keystore"
ALIAS="layali"

if [ -f "$KEYSTORE" ]; then
  echo "A key already exists at $KEYSTORE — reuse it (do not create a new one for the same app)." >&2
  exit 1
fi

mkdir -p "$DIR"
chmod 700 "$DIR"
echo "Creating $KEYSTORE (you will be asked for a password and your organisation details)…"
keytool -genkeypair -v -storetype PKCS12 -keystore "$KEYSTORE" -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000
chmod 600 "$KEYSTORE"

cat <<EOF

Done. In GitHub: repo → Settings → Secrets and variables → Actions → New repository secret, add:

  ANDROID_KEYSTORE_BASE64   the output of:  base64 -w0 "$KEYSTORE"
  ANDROID_KEYSTORE_PASSWORD the password you just typed
  ANDROID_KEY_ALIAS         $ALIAS
  ANDROID_KEY_PASSWORD      the same password (PKCS12 keys use one password)

Back up $KEYSTORE and the password somewhere safe (not in the repo).
EOF

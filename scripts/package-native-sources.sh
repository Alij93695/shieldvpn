#!/usr/bin/env bash
# Archives the complete source of the prebuilt native libraries ShieldVPN ships
# (ics-openvpn v0.7.60 with all its submodules), so it can be published next to
# ShieldVPN's own source as GPLv2 / MPL-2.0 require. See NATIVE_SOURCES.md.
set -euo pipefail

TAG="v0.7.60"
EXPECTED_COMMIT="4388b6cdad674b120c26f5875d98b401a3c6eb6a"
EXPECTED_OPENVPN="c5888a12571b4bf3a52bd1cc135d964a4f758c9e"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/native-sources"
WORK="$OUT/ics-openvpn"
ARCHIVE="$OUT/ics-openvpn-$TAG-with-submodules.tar.gz"

mkdir -p "$OUT"
rm -rf "$WORK"

echo "Cloning ics-openvpn $TAG with submodules (this is large)..."
# Line-ending conversion must be off for the whole clone, submodules included:
# with core.autocrlf=true (the Git for Windows default) every text file would be
# checked out with CRLF and the archive would no longer be the exact upstream
# source. `git -c` reaches submodule clones via GIT_CONFIG_PARAMETERS;
# `git clone --config` would only reach the top-level repository.
git -c core.autocrlf=false -c core.eol=lf \
  clone --depth 1 --branch "$TAG" --recurse-submodules --shallow-submodules \
  https://github.com/schwabe/ics-openvpn.git "$WORK"

if grep -q $'\r' "$WORK/gradlew" "$WORK/main/src/main/cpp/openvpn/configure.ac" 2>/dev/null; then
  echo "Files were checked out with CRLF line endings; refusing to archive a modified tree." >&2
  exit 1
fi

commit="$(git -C "$WORK" rev-parse HEAD)"
openvpn="$(git -C "$WORK/main/src/main/cpp/openvpn" rev-parse HEAD)"
if [ "$commit" != "$EXPECTED_COMMIT" ] || [ "$openvpn" != "$EXPECTED_OPENVPN" ]; then
  echo "Unexpected commits: ics-openvpn=$commit openvpn=$openvpn" >&2
  echo "Expected: ics-openvpn=$EXPECTED_COMMIT openvpn=$EXPECTED_OPENVPN" >&2
  exit 1
fi

echo "Verified: ics-openvpn $commit, openvpn submodule $openvpn"
tar -czf "$ARCHIVE" -C "$OUT" ics-openvpn
rm -rf "$WORK"
echo "Wrote $ARCHIVE"

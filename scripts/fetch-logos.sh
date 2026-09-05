#!/usr/bin/env bash
# Downloads one favicon per company in src/data/companies.json into
# public/logos/<slug>.png, where <slug> is the first label of the domain.
#
# Why vendor them instead of fetching at runtime: the map draws each logo into
# a canvas and reads the pixels back for map.addImage, which needs CORS. Google's
# favicon service serves no CORS header, and the one public service that does
# (unavatar.io) answered 20 of 39 requests with HTTP 429. Same-origin files have
# neither problem and cost one run of this script.
#
# Usage:
#   scripts/fetch-logos.sh
set -euo pipefail

CURL=/usr/bin/curl
JQ=/usr/bin/jq
ROOT="$(dirname "$0")/.."
SRC="$ROOT/src/data/companies.json"
OUT="$ROOT/public/logos"

mkdir -p "$OUT"

ok=0
missing=0

while IFS=$'\t' read -r domain name; do
  [ -z "$domain" ] && continue
  slug=$(echo "${domain%%.*}" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-')
  slug=${slug%-}
  dest="$OUT/${slug}.png"

  # Google 404s an unknown domain rather than serving a generic globe, so -f is
  # the whole check. Do not filter on file size: a simple mark like Zerodha's
  # compresses to 350 bytes and is still the real logo.
  url="https://www.google.com/s2/favicons?domain=${domain}&sz=128"
  if "$CURL" -sSfL --max-time 15 "$url" -o "${dest}.tmp" 2>/dev/null; then
    mv "${dest}.tmp" "$dest"
    ok=$((ok + 1))
  else
    rm -f "${dest}.tmp"
    echo "  no favicon, falls back to initials: $name ($domain)" >&2
    missing=$((missing + 1))
  fi
done < <("$JQ" -r '.[] | [.domain, .name] | @tsv' "$SRC")

echo "wrote $ok logos to $OUT ($missing fall back to an initials chip)" >&2

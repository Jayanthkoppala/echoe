#!/usr/bin/env bash
# Fetches Bengaluru pubs, bars, breweries and cafes from OpenStreetMap via the
# Overpass API and writes the raw JSON to a scratch path (not the repo).
# Run scripts/normalize-osm-spots.py afterwards to produce src/data/spots.json.
#
# One request, no retries: Overpass is a shared public service and another
# process may be hitting it too, so this script is deliberately a single shot.
#
# Usage:
#   scripts/fetch-osm-spots.sh /path/to/scratch/osm-spots-raw.json
set -euo pipefail

CURL=/usr/bin/curl
OUT="${1:?usage: fetch-osm-spots.sh <output-path>}"

SOUTH=12.83
WEST=77.45
NORTH=13.13
EAST=77.78

QUERY=$(cat <<EOF
[out:json][timeout:180];
(
  node["name"]["amenity"~"^(pub|bar|biergarten|cafe)$"](${SOUTH},${WEST},${NORTH},${EAST});
  way["name"]["amenity"~"^(pub|bar|biergarten|cafe)$"](${SOUTH},${WEST},${NORTH},${EAST});
  node["name"]["craft"="brewery"](${SOUTH},${WEST},${NORTH},${EAST});
  way["name"]["craft"="brewery"](${SOUTH},${WEST},${NORTH},${EAST});
  node["name"]["microbrewery"="yes"](${SOUTH},${WEST},${NORTH},${EAST});
  way["name"]["microbrewery"="yes"](${SOUTH},${WEST},${NORTH},${EAST});
  node["name"]["brewery"](${SOUTH},${WEST},${NORTH},${EAST});
  way["name"]["brewery"](${SOUTH},${WEST},${NORTH},${EAST});
);
out center;
EOF
)

"$CURL" -sS --max-time 200 \
  -H "User-Agent: Echoe hackathon (jay@bosshq.in)" \
  --data-urlencode "data=${QUERY}" \
  https://overpass-api.de/api/interpreter \
  -o "$OUT"

count=$(/opt/homebrew/bin/python3 -c "import json,sys; print(len(json.load(open(sys.argv[1]))['elements']))" "$OUT")
echo "wrote $count raw elements to $OUT" >&2

#!/usr/bin/env bash
# Fetches driving routes between all 45 unordered pairs of the 10 Bengaluru
# landmarks from the public OSRM demo server (router.project-osrm.org).
# OSRM demo usage policy: max 1 req/sec, non-commercial use only.
# Falls back to a straight two-point line if a pair's request fails.
set -euo pipefail

CURL=/usr/bin/curl
JQ=/usr/bin/jq
OUT="$(dirname "$0")/../src/data/routes.json"

# id lng lat (must match src/data/landmarks.ts)
LANDMARKS='
bangalore-palace 77.5920 12.9987
vidhana-soudha 77.5906 12.9796
ulsoor-lake 77.6192 12.9815
church-street 77.6048 12.9750
cubbon-park 77.5933 12.9750
indiranagar 77.6499 12.9699
lalbagh 77.5900 12.9500
mg-road 77.6119 12.9738
koramangala 77.6229 12.9259
commercial-street 77.6084 12.9822
'

ids=()
lngs=()
lats=()
while read -r id lng lat; do
  [ -z "$id" ] && continue
  ids+=("$id"); lngs+=("$lng"); lats+=("$lat")
done <<< "$LANDMARKS"

echo "{" > "$OUT"
first=true
fallback_count=0
n=${#ids[@]}

for ((i = 0; i < n; i++)); do
  for ((j = i + 1; j < n; j++)); do
    a_id=${ids[$i]}; b_id=${ids[$j]}
    a_lng=${lngs[$i]}; a_lat=${lats[$i]}
    b_lng=${lngs[$j]}; b_lat=${lats[$j]}

    # sort pair by id so the key is deterministic ("a__b")
    if [[ "$a_id" < "$b_id" ]]; then
      key="${a_id}__${b_id}"
    else
      key="${b_id}__${a_id}"
      tmp_lng=$a_lng; tmp_lat=$a_lat
      a_lng=$b_lng; a_lat=$b_lat
      b_lng=$tmp_lng; b_lat=$tmp_lat
    fi

    url="https://router.project-osrm.org/route/v1/driving/${a_lng},${a_lat};${b_lng},${b_lat}?overview=full&geometries=geojson"
    resp=$("$CURL" -sS --max-time 10 "$url" || echo '{}')
    coords=$(echo "$resp" | "$JQ" -c '.routes[0].geometry.coordinates // empty' 2>/dev/null || echo '')

    if [ -z "$coords" ] || [ "$coords" = "null" ]; then
      echo "  fallback (straight line): $key" >&2
      coords="[[${a_lng},${a_lat}],[${b_lng},${b_lat}]]"
      fallback_count=$((fallback_count + 1))
    fi

    $first || echo "," >> "$OUT"
    first=false
    printf '  "%s": %s' "$key" "$coords" >> "$OUT"

    sleep 1.1
  done
done

echo "" >> "$OUT"
echo "}" >> "$OUT"

# validate + pretty-print in place
"$JQ" . "$OUT" > "${OUT}.tmp" && mv "${OUT}.tmp" "$OUT"

echo "wrote $OUT ($fallback_count fallback pairs of $(( n * (n-1) / 2 )) total)" >&2

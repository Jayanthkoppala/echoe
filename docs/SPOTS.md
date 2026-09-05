# Pubs, bars, breweries and cafes

Source: OpenStreetMap, © OpenStreetMap contributors, data under the [Open
Database Licence (ODbL)](https://opendatacommons.org/licenses/odbl/). Map
attribution already appears on the live map; this file documents where the
data in `src/data/spots.json` comes from.

## Fetch

`scripts/fetch-osm-spots.sh <out.json>` runs one Overpass API query (one
request, no retries) for nodes and ways in the Bengaluru bounding box
(south 12.83, west 77.45, north 13.13, east 77.78) with a `name` and one of
`amenity=pub|bar|biergarten|cafe`, `craft=brewery`, `microbrewery=yes`, or a
truthy `brewery` tag, using `out center;`.

`scripts/normalize-osm-spots.py <raw.json> <out.json>` turns that into
`spots.json`: dedupes by name plus 4-decimal coordinates, drops cafes with
fewer than 4 OSM tags (bare stub nodes from mapathons), caps chain outlets
at 3 per exact name, flags a fixed featured list (capped at 40), and ranks
featured first, then pub/brewery/bar, then cafe.

## Counts (as of this run)

872 total: 164 pub, 111 brewery, 179 bar, 418 cafe. 36 featured.

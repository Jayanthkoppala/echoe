# OSM company pins

A second, larger company-pin layer alongside the 39 hand-verified startups in
`src/data/companies.json` and the 44 VCs in `src/data/vcs.json`. Built from
OpenStreetMap office data instead of scraping bangalorestartupmap.com, whose
994-company directory has no stated licence (see `docs/STARTUP-MAP-RESEARCH.md`)
and is therefore not reusable.

## Licence

Data (c) OpenStreetMap contributors, ODbL
(https://www.openstreetmap.org/copyright). The attribution already shown on
the map satisfies the ODbL's attribution requirement; nothing extra is needed
for this layer. Logos are linked from Google's public favicon endpoint
(`https://www.google.com/s2/favicons?domain=<domain>&sz=128`) at render time,
never downloaded or stored, so no separate logo licence applies.

## Pipeline

`scripts/fetch-osm-companies.sh`:

1. Queries the Overpass API (`overpass-api.de/api/interpreter`) for nodes and
   ways in the Bengaluru bounding box (south 12.83, west 77.45, north 13.13,
   east 77.78) tagged `office` in `company, it, software, coworking, startup,
   financial, consulting, research, telecommunication` (estate_agent
   excluded), OR any `brand` + `office=*` combination, restricted to features
   with a `name`. One request per run, a `EchoeMapBot` user agent, 180s
   timeout, per Overpass's usage policy. The raw response is scratch data
   kept at `/tmp/echoe-osm/raw.json`, outside the repo, never committed.
2. If that comes back under 200 named results, it re-queries with
   `office=yes` added and reports the widening. Not needed on the current
   Bengaluru data (1833 raw elements came back on the first pass).
3. A normalisation pass (embedded Python, no extra file) filters and dedupes,
   then writes `src/data/companies-osm.json` in one atomic write at the end.

Re-run any time with:

```
scripts/fetch-osm-companies.sh
```

It's idempotent: re-running against unchanged OSM data reproduces the same
file byte for byte.

## Filtering rules

- **Category noise.** `office=company` is OSM's generic catch-all; mappers
  apply it to any small registered business as readily as to a real tech
  company. A `company`-tagged node with no website and fewer than 6 tags
  total is dropped as unverifiable noise. This is the one filter tuned
  specifically to land in the 300-800 target range (raw candidates: 1833;
  after this filter alone: 817; final after dedup: 763).
- **Non-company categories** reached only through the `brand`+`office=*`
  clause (`insurance`, `political_party`, `ngo`) are dropped outright — LIC
  branches, a BJP party office, the Red Cross are not companies.
- **Franchise/agent counters** (a courier or insurance drop-off shop branded
  as, but not literally named after, the parent company) are dropped unless
  the outlet's own name plausibly is the brand.
- **Name patterns**: `ATM` or `Branch` as whole words, and government-office
  words (`government`, `municipal`, `panchayat`, `bbmp`, etc.) drop the entry.
  A blind match on the word "Bank" was tried and reverted — it caught
  legitimate corporate offices (Standard Chartered Bank, Axis Bank, HSBC
  Bank) rather than local branch counters, which don't carry an `office` tag
  in this data at all.
- **Brand-chain cap**: after `Pvt Ltd` / `Private Limited` / trailing branch
  numbers are stripped from the name, no more than 3 locations of the same
  normalised brand survive (0 triggered this on the current pull; it's a
  safety net for future runs with more branch duplication).

## Dedup and ranking

1. Dedupe by `domain` (when present), keeping the richest-tagged entry.
2. Dedupe by `name` + `hq_area`, preferring whichever duplicate has a domain,
   then the richer-tagged one. (Fixed a bug here during testing: the naive
   version preferred tag count outright and silently dropped a domain-bearing
   Hustlehub location in favour of a domain-less duplicate one tag richer.)
3. Sort with a domain first, then by tag count. `featured: true` marks the
   top 30 that have a domain.

## Fields

`name`, `domain`, `hq_area`, `lat`, `lng` (5 decimals), `category` (the office
tag value), `logo`, `kind: "startup"`, `source: "osm"`, `osm_id` (`type/id`),
`featured`.

## Y Combinator directory: skipped

Checked the `yc-oss/api` GitHub dataset (scraped from YC's own Algolia search
index) as a possible source of YC-backed Bengaluru companies. Its README
calls itself "an unofficial API"; the GitHub repo has no `LICENSE` file and
the GitHub API reports `license: null`. No terms of reuse are stated anywhere
in the repo. Same problem as bangalorestartupmap.com: nothing to credit, no
granted permission, so it's skipped rather than assumed reusable.

## Current results (last run)

| Metric | Value |
|---|---|
| Total companies | 763 |
| With a domain (and therefore a logo) | 361 |
| Featured (top 30 by domain + tag richness) | 30 |
| Brand-chain entries capped | 0 |
| YC companies included | 0 (licence unclear, see above) |

## Spot-checked issues in the source data

- **"Access to Tokyo"** carries a `website` tag pointing to
  `metro.tokyo.lg.jp` — a Tokyo city government news page announcing this
  business-support desk, not a company domain. The generated favicon will
  show the Tokyo metro government's icon, not a company logo.
- **A "Hustlehub" node** carries `website: terratern.com`, an unrelated
  domain, while a separate "Hustlehub" way nearby correctly carries
  `hustlehub.xyz`. Likely a stale OSM tag on the first node; both entries
  survive as two locations since they have different `hq_area` values.
- **"315 Work Avenue" / "315Work Avenue"** appear as 3-4 separate entries
  for the same coworking chain, because exact-string name+area dedup doesn't
  catch cosmetic spacing differences between listings.

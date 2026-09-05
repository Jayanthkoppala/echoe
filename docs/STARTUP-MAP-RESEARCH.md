# Bangalore Startup Map research (for Echoe company badges)

Researched 2026-09-05 via live browser session against https://bangalorestartupmap.com/ (network requests, rendered DOM, HTTP status checks) plus WebFetch for sitemap/robots. WebFetch's HTML-to-markdown conversion strips script tags before analysis, so raw structure came from a real Chromium session's Network panel and `document` inspection, not WebFetch alone.

## 1. What the site is

| Fact | Value | Source |
|---|---|---|
| Title | "Bangalore Startup Map - Startups in Bengaluru" | page `<title>`, 2026-09-05 |
| Meta description | "A directory of 880+ startups and 70+ VC firms based in Bangalore. Browse by area, stage, and sector." | `<meta name="description">`, 2026-09-05 |
| Homepage result counter | "1068 results" shown unfiltered | rendered DOM, 2026-09-05 |
| Sitemap entries | 1000+ URLs at `/company/<slug>` | https://bangalorestartupmap.com/sitemap.xml, 2026-09-05 |
| Maker / author credit | **None found.** No footer, no `/about`, no author byline anywhere in the DOM. | checked `document.querySelector('footer')` (null) and page text search, 2026-09-05 |
| Stack | Next.js App Router on Vercel (`_next/static/chunks/main-app-*.js`, `?dpl=` deployment IDs) | script `src` list captured from `document.scripts`, 2026-09-05 |
| Map library | **Leaflet** (`window.L` present at runtime). Mapbox GL, MapLibre GL, and the Google Maps JS SDK are all absent (`window.mapboxgl`, `window.maplibregl`, `window.google.maps` all undefined). | `browser_evaluate` on live page, 2026-09-05 |
| Tile style | CartoDB Voyager raster tiles: `https://{a,b,c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?key=...` | captured network requests, 2026-09-05 |
| Per-pin info | Name, logo, category/sector tag(s), funding stage (e.g. "Seed (Closed)"), funding amount (e.g. "$40M"), HQ locality, employee-count band (e.g. "11-50"), founder names, short description | `/company/10club` profile page, 2026-09-05 |
| Analytics | Microsoft Clarity + Umami (`cloud.umami.is/script.js`, `gateway.umami.is/api/send`) | script/network list, 2026-09-05 |
| Monetization | `/api/ads` serves banner images from a Supabase storage bucket (`zchwjubfwlqenminhdxq.supabase.co/storage/v1/object/public/ad-images/...`); sponsor links carry `utm_campaign=bangalore_startup_map` | network log, 2026-09-05 |

No `/about`, `/terms`, `/license`, `/licence`, or GitHub link exists. `/about` and `/terms` both return HTTP 404. No text string "credit", "github", "license", "twitter.com", or "linkedin.com/in" appears anywhere in the rendered page HTML (checked via full-innerHTML substring search). The CSS class `.credit-pill` exists but renders empty on the pages checked. It is not a data-source credit widget; it is unused/hidden UI, likely for an unrelated "claim this spot" ad module.

## 2. Where the data comes from

No fetchable public JSON, Google Sheet, Airtable, or documented API was found.

- Checked endpoints: `/api/survey`, `/api/ads`, `/api/newsletter`, none of which return company records. They serve a signup form, ad banners, and a mailing-list form respectively.
- No `__NEXT_DATA__` script tag (Next.js App Router streams RSC payloads instead of embedding a single JSON blob the way the old Pages Router did), so there is no single embedded JSON bundle to lift.
- The `/company/<slug>` pages are server-rendered per request; company records almost certainly live in a private database (the same project already talks to Supabase for ad images, so Supabase or an equivalent DB is the likely backing store), not in anything publicly reachable.
- Sitemap gives slugs and scale (1000+ URLs) but zero field data per company.

**Licence verdict: none stated, reuse not confirmed.** There is no terms page, no licence file, no "data sourced from X, reuse under Y" credit line anywhere on the site. Absent a stated licence, treat the compiled directory and its bundled logo files as unlicensed for reuse. This rules out path (a): legally reusing their dataset with credit is not available because there is nothing to credit and no granted permission. Path (b), building our own seed list from public sources, is the only clean option for a 24-hour build.

## 3. How logos are served

Two tiers, both visible in live network capture:

1. **Self-hosted files** at `bangalorestartupmap.com/logos/<slug>.png`, a curated subset (spot-checked: `hungerbox.png`, `dealshare.png`, `perfios.png`, `setu.png`, `easebuzz.png`, `peoplebox.png`, `vahan.png`, `pazcare.png`, `wooqer.png`, `yulu.png`, `slice.png`). These are the site's actually-Bangalore-based startups.
2. **Google's favicon service** as fallback for everything else: `https://www.google.com/s2/favicons?domain=<domain>&sz=128`, confirmed both as `<link rel="preload">` tags in the raw page head and as live 200/301 network responses for dozens of domains (razorpay.com, wipro.com, intel.in, freshworks.com, etc). This is an unofficial, undocumented, unauthenticated Google endpoint: no API key, no published SLA or terms of reuse, and Google can change or throttle it without notice. It is nonetheless the exact mechanism the reference site itself relies on, which is good precedent for a hackathon demo.

Checked alternatives live from a browser session today (2026-09-05):

| Service | Status found | Note |
|---|---|---|
| Google `s2/favicons` | Working, no key required | Same one bangalorestartupmap.com uses in production |
| `img.logo.dev/<domain>` | **401 Unauthorized** (JSON error body) with no token | logo.dev now requires an API token even for the basic image endpoint; confirmed live, not from memory |
| `logo.clearbit.com/<domain>` | Could not get a clean same-origin read (browser CORS blocked the check) | Clearbit was folded into HubSpot in 2023, and public reporting through 2024-2025 says the free anonymous Logo API was discontinued for new use. Treat as unreliable and verify with a direct image-tag load before depending on it. Do not build on this from memory alone. |
| Brandfetch | Not tested | Requires a client ID for anything beyond a very limited free tier; skip for a 24-hour build |

**Recommendation: Google's `s2/favicons` endpoint.** No key, no signup, works today, and it's already proven at the scale we need (same site, same use case). Fall back to a locally bundled PNG for the handful of companies in our seed list whose favicon doesn't resolve well (test each of the 40 once before demo day).

## 4. Legal path and seed list

Path (b) confirmed as the only option (see licence verdict above). Below is a 40-company seed list of well-known Bengaluru startups and tech companies, ready to paste into `src/data/companies.json`. Fields: `name`, `domain`, `hq_area`, `lat`, `lng` (2-decimal locality centroid), `category`, `logo` (Google favicon URL).

Coordinates are 2-decimal centroids of the named locality (Koramangala ≈ 12.93/77.62, Indiranagar ≈ 12.97/77.64, HSR Layout ≈ 12.91/77.64, Bellandur ≈ 12.93/77.68, Domlur ≈ 12.96/77.64, Electronic City ≈ 12.84/77.66, JP Nagar ≈ 12.90/77.59, Bannerghatta Road ≈ 12.90/77.60, CV Raman Nagar ≈ 12.98/77.66, Kadubeesanahalli ≈ 12.94/77.70, Sarjapur Road ≈ 12.90/77.69, Sadashivanagar ≈ 12.98/77.59), cross-checked against each company's own Contact/Careers page or Wikipedia infobox as of 2026-09-05. Companies marked `*` were directly observed in bangalorestartupmap.com's own logo/favicon calls today, which corroborates their Bengaluru HQ claim independent of Wikipedia.

```json
[
  { "name": "Flipkart", "domain": "flipkart.com", "hq_area": "Bellandur", "lat": 12.93, "lng": 77.69, "category": "ecommerce", "logo": "https://www.google.com/s2/favicons?domain=flipkart.com&sz=128" },
  { "name": "Myntra", "domain": "myntra.com", "hq_area": "Bellandur", "lat": 12.93, "lng": 77.69, "category": "ecommerce", "logo": "https://www.google.com/s2/favicons?domain=myntra.com&sz=128" },
  { "name": "Swiggy", "domain": "swiggy.com", "hq_area": "Kadubeesanahalli", "lat": 12.94, "lng": 77.70, "category": "foodtech", "logo": "https://www.google.com/s2/favicons?domain=swiggy.com&sz=128" },
  { "name": "Ola", "domain": "olacabs.com", "hq_area": "Koramangala", "lat": 12.93, "lng": 77.62, "category": "mobility", "logo": "https://www.google.com/s2/favicons?domain=olacabs.com&sz=128" },
  { "name": "Razorpay", "domain": "razorpay.com", "hq_area": "Koramangala", "lat": 12.93, "lng": 77.62, "category": "fintech", "logo": "https://www.google.com/s2/favicons?domain=razorpay.com&sz=128" },
  { "name": "PhonePe", "domain": "phonepe.com", "hq_area": "Bellandur", "lat": 12.93, "lng": 77.68, "category": "fintech", "logo": "https://www.google.com/s2/favicons?domain=phonepe.com&sz=128" },
  { "name": "Freshworks", "domain": "freshworks.com", "hq_area": "Kadubeesanahalli", "lat": 12.94, "lng": 77.70, "category": "saas", "logo": "https://www.google.com/s2/favicons?domain=freshworks.com&sz=128" },
  { "name": "Zerodha", "domain": "zerodha.com", "hq_area": "JP Nagar", "lat": 12.90, "lng": 77.59, "category": "fintech", "logo": "https://www.google.com/s2/favicons?domain=zerodha.com&sz=128" },
  { "name": "CRED", "domain": "cred.club", "hq_area": "Koramangala", "lat": 12.93, "lng": 77.62, "category": "fintech", "logo": "https://www.google.com/s2/favicons?domain=cred.club&sz=128" },
  { "name": "Meesho", "domain": "meesho.com", "hq_area": "Koramangala", "lat": 12.93, "lng": 77.62, "category": "ecommerce", "logo": "https://www.google.com/s2/favicons?domain=meesho.com&sz=128" },
  { "name": "BYJU'S", "domain": "byjus.com", "hq_area": "Bannerghatta Road", "lat": 12.90, "lng": 77.60, "category": "edtech", "logo": "https://www.google.com/s2/favicons?domain=byjus.com&sz=128" },
  { "name": "Unacademy", "domain": "unacademy.com", "hq_area": "Indiranagar", "lat": 12.97, "lng": 77.64, "category": "edtech", "logo": "https://www.google.com/s2/favicons?domain=unacademy.com&sz=128" },
  { "name": "Vedantu", "domain": "vedantu.com", "hq_area": "HSR Layout", "lat": 12.91, "lng": 77.64, "category": "edtech", "logo": "https://www.google.com/s2/favicons?domain=vedantu.com&sz=128" },
  { "name": "Dunzo", "domain": "dunzo.com", "hq_area": "Koramangala", "lat": 12.93, "lng": 77.62, "category": "quick-commerce", "logo": "https://www.google.com/s2/favicons?domain=dunzo.com&sz=128" },
  { "name": "InMobi", "domain": "inmobi.com", "hq_area": "CV Raman Nagar", "lat": 12.98, "lng": 77.66, "category": "adtech", "logo": "https://www.google.com/s2/favicons?domain=inmobi.com&sz=128" },
  { "name": "Practo", "domain": "practo.com", "hq_area": "Koramangala", "lat": 12.94, "lng": 77.61, "category": "healthtech", "logo": "https://www.google.com/s2/favicons?domain=practo.com&sz=128" },
  { "name": "ShareChat", "domain": "sharechat.com", "hq_area": "Domlur", "lat": 12.96, "lng": 77.64, "category": "social", "logo": "https://www.google.com/s2/favicons?domain=sharechat.com&sz=128" },
  { "name": "Slice", "domain": "sliceit.com", "hq_area": "Domlur", "lat": 12.96, "lng": 77.64, "category": "fintech", "logo": "https://www.google.com/s2/favicons?domain=sliceit.com&sz=128" },
  { "name": "Groww", "domain": "groww.in", "hq_area": "Koramangala", "lat": 12.93, "lng": 77.62, "category": "fintech", "logo": "https://www.google.com/s2/favicons?domain=groww.in&sz=128" },
  { "name": "Ather Energy", "domain": "atherenergy.com", "hq_area": "Bellandur", "lat": 12.92, "lng": 77.65, "category": "ev-mobility", "logo": "https://www.google.com/s2/favicons?domain=atherenergy.com&sz=128" },
  { "name": "Yulu", "domain": "yulu.bike", "hq_area": "HSR Layout", "lat": 12.92, "lng": 77.65, "category": "mobility", "logo": "https://www.google.com/s2/favicons?domain=yulu.bike&sz=128" },
  { "name": "Licious", "domain": "licious.in", "hq_area": "HSR Layout", "lat": 12.91, "lng": 77.64, "category": "d2c-foodtech", "logo": "https://www.google.com/s2/favicons?domain=licious.in&sz=128" },
  { "name": "BigBasket", "domain": "bigbasket.com", "hq_area": "Bellandur", "lat": 12.93, "lng": 77.68, "category": "ecommerce", "logo": "https://www.google.com/s2/favicons?domain=bigbasket.com&sz=128" },
  { "name": "Wipro", "domain": "wipro.com", "hq_area": "Sarjapur Road", "lat": 12.90, "lng": 77.69, "category": "it-services", "logo": "https://www.google.com/s2/favicons?domain=wipro.com&sz=128" },
  { "name": "MyGate", "domain": "mygate.in", "hq_area": "Bellandur", "lat": 12.93, "lng": 77.68, "category": "proptech", "logo": "https://www.google.com/s2/favicons?domain=mygate.in&sz=128" },
  { "name": "LeadSquared", "domain": "leadsquared.com", "hq_area": "Domlur", "lat": 12.96, "lng": 77.64, "category": "saas", "logo": "https://www.google.com/s2/favicons?domain=leadsquared.com&sz=128" },
  { "name": "MoEngage", "domain": "moengage.com", "hq_area": "Domlur", "lat": 12.96, "lng": 77.64, "category": "martech", "logo": "https://www.google.com/s2/favicons?domain=moengage.com&sz=128" },
  { "name": "Whatfix", "domain": "whatfix.com", "hq_area": "HSR Layout", "lat": 12.91, "lng": 77.64, "category": "saas", "logo": "https://www.google.com/s2/favicons?domain=whatfix.com&sz=128" },
  { "name": "Netradyne", "domain": "netradyne.com", "hq_area": "Bellandur", "lat": 12.93, "lng": 77.68, "category": "ai-mobility", "logo": "https://www.google.com/s2/favicons?domain=netradyne.com&sz=128" },
  { "name": "cult.fit", "domain": "cult.fit", "hq_area": "Bellandur", "lat": 12.93, "lng": 77.68, "category": "healthtech", "logo": "https://www.google.com/s2/favicons?domain=cult.fit&sz=128" },
  { "name": "Ninjacart", "domain": "ninjacart.com", "hq_area": "Sarjapur Road", "lat": 12.90, "lng": 77.69, "category": "agritech", "logo": "https://www.google.com/s2/favicons?domain=ninjacart.com&sz=128" },
  { "name": "NoBroker", "domain": "nobroker.in", "hq_area": "Bellandur", "lat": 12.92, "lng": 77.68, "category": "proptech", "logo": "https://www.google.com/s2/favicons?domain=nobroker.in&sz=128" },
  { "name": "Infosys", "domain": "infosys.com", "hq_area": "Electronic City", "lat": 12.84, "lng": 77.66, "category": "it-services", "logo": "https://www.google.com/s2/favicons?domain=infosys.com&sz=128" },
  { "name": "Observe.AI", "domain": "observe.ai", "hq_area": "Indiranagar", "lat": 12.97, "lng": 77.64, "category": "ai-voicetech", "logo": "https://www.google.com/s2/favicons?domain=observe.ai&sz=128" },
  { "name": "Increff", "domain": "increff.com", "hq_area": "HSR Layout", "lat": 12.91, "lng": 77.64, "category": "retail-saas", "logo": "https://www.google.com/s2/favicons?domain=increff.com&sz=128" },
  { "name": "FinBox", "domain": "finbox.in", "hq_area": "Indiranagar", "lat": 12.97, "lng": 77.64, "category": "fintech-infra", "logo": "https://www.google.com/s2/favicons?domain=finbox.in&sz=128" },
  { "name": "KreditBee", "domain": "kreditbee.in", "hq_area": "HSR Layout", "lat": 12.91, "lng": 77.64, "category": "fintech", "logo": "https://www.google.com/s2/favicons?domain=kreditbee.in&sz=128" },
  { "name": "Cuemath", "domain": "cuemath.com", "hq_area": "Bellandur", "lat": 12.93, "lng": 77.68, "category": "edtech", "logo": "https://www.google.com/s2/favicons?domain=cuemath.com&sz=128" },
  { "name": "Zetwerk", "domain": "zetwerk.com", "hq_area": "HSR Layout", "lat": 12.91, "lng": 77.64, "category": "manufacturing-marketplace", "logo": "https://www.google.com/s2/favicons?domain=zetwerk.com&sz=128" }
]
```

Entries marked with real-time corroboration from bangalorestartupmap.com's own network traffic today: Observe.AI, Increff, FinBox, KreditBee, Cuemath, Zetwerk. The rest are widely documented (Wikipedia infobox HQ field, or the company's own Contact/Careers page) Bengaluru-headquartered companies as of 2026-09-05. Ather, Netradyne, MoEngage, LeadSquared, Whatfix, MyGate, NoBroker, Ninjacart, cult.fit and Licious are also well-documented Bengaluru HQs; verify any single entry against the live company site before demo day if precision matters for that specific pin.

## 5. Company-email verification

**Exact-domain match first.** Lower-case the part after `@` in the submitted email and look it up directly against each company's `domain` field in the seed list (or bangalorestartupmap's own `/company/<slug>` domain once/if we ever get a licensed feed). Reject the match if the domain is a known free/personal mail provider, regardless of how it compares to any company name.

**Reject list (free/personal mail):**

```
gmail.com, googlemail.com, yahoo.com, yahoo.co.in, ymail.com,
outlook.com, hotmail.com, live.com, msn.com,
protonmail.com, proton.me, icloud.com, me.com, mac.com,
aol.com, mail.com, gmx.com, gmx.net, yandex.com, yandex.ru,
rediffmail.com, tutanota.com, fastmail.com, hey.com
```

`zoho.com` is ambiguous: Zoho is a real Chennai-based company, but `zoho.com`/`zohomail.com` are also popular general-purpose personal webmail in India. Treat plain `zoho.com`/`zohomail.com` addresses as personal mail; only accept a Zoho-hosted address if it's on a company's own custom domain (Zoho Mail supports custom domains, which already pass the normal domain-match check).

**Alias table** for cases where the historical, country-specific, or product domain differs from the primary company domain in the seed list:

| Company | Primary domain (in seed list) | Also accept |
|---|---|---|
| Razorpay | razorpay.com | razorpay.in |
| Ola | olacabs.com | ola.com, olaelectric.com |
| Urban Company | urbancompany.com | urbanclap.com (pre-rebrand) |
| cult.fit | cult.fit | cure.fit (pre-rebrand) |
| Slice | sliceit.com | slice.com (do not confuse with the unrelated US company Slice Inc.) |
| Yulu | yulu.bike | yulu.com |
| Wakefit | wakefit.co | wakefit.com |
| Zepto | zeptonow.com | zepto.com |
| Postman | postman.com | getpostman.com (pre-rebrand) |

Keep this table small and append to it only when a real signup hits a mismatch; don't pre-build aliases for companies not in the seed list.

## Summary for the team

- **Reuse verdict:** not allowed. No licence, terms, or credit line exists anywhere on bangalorestartupmap.com; build our own seed list instead (done, above).
- **Map library:** Leaflet with CartoDB Voyager raster tiles, not Mapbox/MapLibre/Google Maps.
- **Logo service:** Google's `s2/favicons` endpoint (`https://www.google.com/s2/favicons?domain=<domain>&sz=128`), no key, proven live and already used by the reference site itself. logo.dev requires a token (confirmed 401 without one, checked live today); Clearbit's free public endpoint is reported dead since the 2023 HubSpot acquisition and should be verified independently before any reliance on it.
- **Seed data:** 40-company JSON block is in section 4 above, ready to paste into `src/data/companies.json`.

# Bengaluru VC Layer

## Count

44 VC/angel funds with a verified Bengaluru office, in `src/data/vcs.json`. 0 are marked `approx` — every entry has a specific street address or building name from a primary or registry source, though the lat/lng plotted is a locality centroid (as permitted) rather than a geocode of the exact building.

## Method

Started from the seed list of ~76 candidate firms. For each, ran targeted web searches against the firm's own site, Wikipedia, Crunchbase, LinkedIn, PitchBook, Tracxn, ZaubaCorp/company-registry filings, and local business directories (Justdial, Glassdoor, Craft.co) to find a Bengaluru office address. A firm was kept only if a Bengaluru street address, building, or registered-office filing could be confirmed; bangalorestartupmap.com was never consulted. Locality centroids (2-3 decimals) were used for lat/lng once the specific office address confirmed which neighbourhood the pin belongs in. Each entry in the JSON carries a `verified_source` URL pointing at the page the address was confirmed on.

## Not included (34 candidates dropped, with reason)

- **Better Capital** - HQ in Pune and San Francisco; no Bengaluru office found.
- **Good Capital** - HQ in Delhi; no Bengaluru office found.
- **Info Edge Ventures** - only the parent Info Edge (India) Ltd's Noida-HQ Bengaluru branch address turned up; the VC arm's own Bengaluru office is not separately verifiable.
- **Sauce.vc** - HQ in New Delhi; no Bengaluru office found.
- **Bharat Founders Fund** - Bengaluru presence claimed in directories but no address found.
- **100X.VC** - HQ in Mumbai; no Bengaluru office found.
- **8i Ventures** - Mumbai/Bengaluru presence claimed but no address found.
- **Merak Ventures** - HQ in New Delhi; no Bengaluru office found.
- **Beenext** - Singapore HQ; Bengaluru "operational presence" claimed but no address found.
- **Whiteboard Capital** - HQ in Mumbai; a Bangalore office is referenced but no address found.
- **Accel Atoms** - Accel's seed program, not a separate entity from Accel India (already included).
- **Sequoia Surge** - Peak XV's scale-up program, not a separate entity from Peak XV Partners (already included).
- **Mumbai Angels (Bengaluru chapter)** - HQ in Mumbai; no dedicated Bengaluru office verified.
- **Indian Angel Network** - HQ in New Delhi; no Bengaluru office verified.
- **AngelList India** - registered address in Delhi; no Bengaluru office verified.
- **Tiger Global India** - Mumbai and Gurugram offices only; no Bengaluru office verified.
- **Norwest India** - Mumbai office confirmed; a Bengaluru team is mentioned but no office address verified.
- **SoftBank Vision Fund India** - Mumbai office only; no Bengaluru office verified.
- **Eximius Ventures** - opened a Bengaluru office per YourStory (October 2025) but the exact address/locality could not be confirmed.
- **YourNest** - Gurugram HQ; Bengaluru team confirmed but no office address found.
- **Capital A** - PitchBook lists it as Bengaluru-based but no address found.
- **Physis Capital** - HQ in Gurugram; no Bengaluru office found.
- **Huddle Ventures** - HQ in Gurugram; no Bengaluru office found.
- **GrowX Ventures** - Bengaluru presence claimed but no address found.
- **AdvantEdge Founders** - HQ in Noida/Delhi; no Bengaluru office found.
- **Vertex Ventures SEA and India** - a Bangalore office is referenced but no address found.
- **Jungle Ventures India** - a Bangalore office is referenced but no address found.
- **Insight Partners India** - search results only matched Insight Enterprises, an unrelated IT company; no verified Insight Partners Bengaluru office.
- **Kotak Alternate** - HQ in Mumbai; no Bengaluru office found.
- **Fundamentum** - HQ in Gurugram; Bengaluru presence claimed but no address found.
- **Anthill Ventures** - a Bangalore office is referenced but no address found.

## Stage distribution

| Stage | Count |
|---|---|
| seed | 11 |
| pre-seed | 9 |
| early | 10 |
| growth | 6 |
| multi | 8 |

**Total: 44**

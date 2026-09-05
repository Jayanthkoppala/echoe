# Events seed data

Static seed for the Events screen, refreshed by hand, not a live feed.
Source: `src/data/events.json`. 39 real events, 2026-09-06 to 2026-10-31, Bengaluru.

Counts: trip 13, meetup 10, date 10, company 6 (below the 8 target - Google,
Microsoft Reactor, GDG Bangalore, Startup Grind, TiE Bangalore and SaaSBoomi
had no dated, verifiable listing in this window; leans on Razorpay, BitGo,
AWS User Group and Toast instead).

Top sources by yield: bmcadventures.com (13 treks/trips), allevents.in (12
food/music/comedy/social), luma.com (6, mostly Bengaluru Tech Week meetups).

Every event's URL was fetched or found on a fetched listing page. Summaries
are written fresh, not copied. lat/lng are neighbourhood or destination-town
centroids (`approx: true` on every row), not geocoded addresses. Refresh by
re-running the same source list and dropping rows whose dates have passed.

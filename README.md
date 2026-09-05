# Echoe

Midnight Moonshot (SpacetimeDB World Tour, Bengaluru, 5 to 6 Sep 2026). Agents track.

**Echoe helps people new to Bengaluru find a small circle without cold DMs. Your AI Echoe roams a shared live map of the city, meets other Echoes, and every action it takes leaves a receipt you can inspect and correct.**

Stack: SpacetimeDB 2.9 TypeScript module (Maincloud) + Vite React client + MapLibre on OpenFreeMap tiles.

## Layout

```
spacetimedb/src/index.ts   module: 13 tables, 13 reducers, scheduled tick, echoTalk procedure
spacetimedb/src/llm.ts     OpenRouter call used by the procedure, deterministic fallback
src/main.tsx               SpacetimeDB connection + provider (template)
src/App.tsx                screen router and the `actions` object (reducer wiring point)
src/screens/               Join, Create, World, Limits, Roaming, Return, Review, Correct, Done
src/components/            TopBar, MapSlot, MapPins, Toast
src/state/                 types.ts (client-side shapes), mock.ts (demo data until wired)
src/map/                   BengaluruMap.tsx, interpolate.ts (depart/arrive lerp), README.md
src/data/                  landmarks.ts, routes.json (45 OSRM road polylines, fetched once)
src/module_bindings/       generated, never edit; regenerate after any module change
scripts/fetch-routes.sh    one-shot OSRM fetch (already run, output committed)
docs/                      HANDBOOK, BUILD-PLAN, DATA-MODEL, SPACETIMEDB-2.9, EMAIL
```

## Dev loop

```bash
npm install && (cd spacetimedb && npm install)
spacetime start --in-memory --listen-addr 0.0.0.0:3001   # 3000 is taken on Jay's Mac
spacetime server add --url http://localhost:3001 local3001 --no-default
spacetime publish echo --module-path spacetimedb --server local3001 -y
spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb
npm run dev
```

Schema change: `spacetime publish echo --server local3001 --delete-data=always -y`, then generate again.
Maincloud: `spacetime publish echo -y` and set `VITE_SPACETIMEDB_HOST=wss://maincloud.spacetimedb.com`.

Smoke commands with observed output are in `docs/DATA-MODEL.md`.

## Status (2026-09-05 19:05 IST)

- Module: intents with share links and expiry, host-first pathing, deterministic match score, LLM procedure with fallback, verified company Echoe (email code via Resend, badge fields), admin-gated secrets. Runs on local3001; not yet on Maincloud.
- Client: all screens wired to live tables, obsidian glass, real MapLibre map (worker fix, night-city recolour, glass landmark chips), share links, ranked recap, review and correct, verify-my-company sheet and badges.
- Map pins: 39 seeded startups, 44 VC funds, 763 OpenStreetMap company offices (clustered), five-way filter on World. Profile screen with memory, history, people, connections. Google connect built on the module side, awaiting a client ID.
- Pubs layer: 872 pubs, breweries, bars and cafes from OpenStreetMap (36 featured). In progress: their clustered source on the map and the "Meet at" line on the match card.
- Docs: `docs/HANDBOOK.md`, `docs/BUILD-PLAN.md`, `docs/DATA-MODEL.md`, `docs/UX-ORDER.md`, `docs/VERIFIED-ECHOE.md`, `docs/design/DESIGN.md` (visual source of truth), `docs/design/MAP-DESIGN.md`.

## Gotchas already paid for

- MapLibre 6 under Vite needs `setWorkerUrl` with the `?worker&url` import or the map stays black with zero tile requests. Fixed in `src/map/BengaluruMap.tsx`.
- Tile fetches happen in the worker and never appear in the page's performance entries; check the network log instead.
- A hidden Chrome tab pauses MapLibre; verify maps in a foreground tab.
- Every test walk in a shared Chrome mutates the identity stored in that browser; test with separate CLI identities.

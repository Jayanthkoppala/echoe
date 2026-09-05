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

## Status

- Module builds, publishes locally, ticks, and passes the two-identity smoke flow.
- Client builds and every screen fits one viewport, currently on mock state.
- Next: replace `src/state/mock.ts` with `useTable` rows and map `actions` to reducers in `src/App.tsx`; drop `BengaluruMap` into `MapSlot`.

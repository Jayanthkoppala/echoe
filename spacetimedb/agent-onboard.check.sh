#!/bin/bash
# End-to-end check for the MCP onboarding loop: a player's own coding agent
# creates and updates their Echoe with nothing but a link token, over plain
# HTTP with a throwaway identity, exactly as the MCP server will.
#
#   bash spacetimedb/agent-onboard.check.sh [server-alias] [db-name]
#
# Assumes the module is already published to that server. Leaves its rows
# behind; `sh spacetimedb/reset-players.sh local3001 echo` clears them.
set -euo pipefail

SERVER="${1:-local3001}"
DB="${2:-echo}"
HOST="${HOST:-http://127.0.0.1:3001}"
STDB=/Users/jay/.local/bin/spacetime
CURL=/usr/bin/curl
TOKEN=onboard-token-0123456789abcdef
EVENT=midnight-moonshot
PERSONA="Builds Echoe, a map of coding agents, and wants to meet SpacetimeDB people."
BUILD="A SpacetimeDB module whose reducers a coding agent drives over plain HTTP."
OUT=/tmp/agent-onboard.check.out

sql() { "$STDB" sql --no-config -s "$SERVER" "$DB" "$1" 2>/dev/null; }
fail() { echo "FAIL: $1" >&2; exit 1; }
anon() { "$CURL" -s -X POST "$HOST/v1/identity" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'; }
# $1 = reducer name, $2 = JSON args array -> prints HTTP status, body in $OUT
post() {
  "$CURL" -s -o "$OUT" -w '%{http_code}' \
    -X POST "$HOST/v1/database/$DB/call/$1" \
    -H "Authorization: Bearer $(anon)" -H 'Content-Type: application/json' \
    --data-binary "$2"
}

# (b) The browser side: a player who has NOT created an Echoe links their agent.
#     set_agent_link must accept this, which is the relaxed guard.
"$STDB" call --no-config -s "$SERVER" "$DB" join '"MCP Check"' '""' >/dev/null
ME=$(sql "SELECT identity FROM player" | grep -o '0x[0-9a-f]*' | tail -1)
[ -n "$ME" ] || fail "could not read the caller identity"
sql "DELETE FROM echo WHERE owner = $ME" >/dev/null 2>&1 || true
"$STDB" call --no-config -s "$SERVER" "$DB" set_agent_link "\"$TOKEN\"" >/dev/null \
  || fail "set_agent_link refused a player with no Echoe (guard not relaxed)"
sql "SELECT echo_id FROM agent_link WHERE token = '$TOKEN'" | grep -q '\b0\b' \
  || fail "expected echo_id 0 on a link made before the Echoe existed"

# (c) The agent writes the persona by token. The Echoe appears, echo_id backfills.
[ "$(post set_persona_by_token "[\"$TOKEN\",\"$PERSONA\"]")" = 200 ] \
  || fail "set_persona_by_token: $(cat $OUT)"
sql "SELECT persona FROM echo WHERE owner = $ME" | grep -q "map of coding agents" \
  || fail "persona did not land on the echo row"
ECHO_ID=$(sql "SELECT id FROM echo WHERE owner = $ME" | tail -1 | tr -dc 0-9)
[ -n "$ECHO_ID" ] || fail "no echo id"
sql "SELECT echo_id FROM agent_link WHERE token = '$TOKEN'" | grep -q "\b$ECHO_ID\b" \
  || fail "agent_link.echo_id was not backfilled to $ECHO_ID"

# (d) The agent writes what its owner is building, before any event join.
[ "$(post set_event_build_by_token "[\"$TOKEN\",\"$EVENT\",\"$BUILD\"]")" = 200 ] \
  || fail "set_event_build_by_token: $(cat $OUT)"
sql "SELECT text FROM event_build WHERE event_id = '$EVENT'" | grep -q "drives over plain HTTP" \
  || fail "event_build row missing after set_event_build_by_token"

# (e) Joining with a blank `building` must keep what the agent wrote.
"$STDB" call --no-config -s "$SERVER" "$DB" join_event \
  "\"$EVENT\"" '"meet SpacetimeDB people"' '"jay"' '""' '""' >/dev/null
sql "SELECT text FROM event_build WHERE event_id = '$EVENT'" | grep -q "drives over plain HTTP" \
  || fail "join_event with a blank building overwrote the agent's text"

# (f) Memory now resolves the echo at call time and lands rows.
NOTES='- agent-onboard-check wired the MCP reducers\nagent-onboard-check published to local3001'
[ "$(post ingest_agent_memory "[\"$TOKEN\",\"2026-09-06\",\"claude-code\",\"$NOTES\"]")" = 200 ] \
  || fail "ingest_agent_memory: $(cat $OUT)"
KEPT=$(sql "SELECT note FROM agent_memory WHERE echo_id = $ECHO_ID" | grep -c agent-onboard-check || true)
[ "$KEPT" -eq 2 ] || fail "expected 2 memory rows on echo $ECHO_ID, got $KEPT"

# (g) The token is the whole authentication. A wrong one writes nothing.
for r in set_persona_by_token set_event_build_by_token ingest_agent_memory; do
  case "$r" in
    set_persona_by_token)     ARGS='["bogus-token-aaaaaaaaaaaa","nope"]';;
    set_event_build_by_token) ARGS='["bogus-token-aaaaaaaaaaaa","'"$EVENT"'","nope"]';;
    *)                        ARGS='["bogus-token-aaaaaaaaaaaa","2026-09-06","codex","nope nope"]';;
  esac
  CODE=$(post "$r" "$ARGS")
  [ "$CODE" != 200 ] || fail "$r accepted a bad token"
  grep -q bad_token "$OUT" || fail "$r on a bad token gave: $(cat $OUT)"
done

echo "agent-onboard.check: link before echo ok, persona+build by token ok, echo_id=$ECHO_ID backfilled, join kept build text, $KEPT memory rows, bad token refused (HTTP $CODE)"

#!/bin/bash
# End-to-end check for the coding-agent memory loop, driven exactly the way the
# nightly cron on a player's machine will drive it: plain HTTP, anonymous
# identity, token as the only credential.
#
#   bash spacetimedb/agent-memory.check.sh [server-alias] [db-name]
#
# Assumes the module is already published to that server.
set -euo pipefail

SERVER="${1:-local3001}"
DB="${2:-echo}"
HOST="${HOST:-http://127.0.0.1:3001}"
STDB=/Users/jay/.local/bin/spacetime
CURL=/usr/bin/curl
TOKEN=check-token-0123456789abcdef
MARK="agent-memory-check"

sql() { "$STDB" sql -s "$SERVER" "$DB" "$1" 2>/dev/null; }
notes() { sql "SELECT note FROM agent_memory" | grep -c "$MARK" || true; }
fail() { echo "FAIL: $1" >&2; exit 1; }

# The caller owns an Echoe and holds a link token. All three are idempotent.
"$STDB" call -s "$SERVER" "$DB" join '"agent-check"' '""' >/dev/null 2>&1
"$STDB" call -s "$SERVER" "$DB" create_echo '"circle"' '"Runs a nightly cron over their own coding sessions."' '"testing the agent memory loop"' >/dev/null 2>&1
"$STDB" call -s "$SERVER" "$DB" set_agent_link "\"$TOKEN\"" >/dev/null 2>&1

anon() { "$CURL" -s -X POST "$HOST/v1/identity" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'; }
ingest() { # $1 = link token, $2 = notes blob -> prints HTTP status
  "$CURL" -s -o /tmp/agent-memory.check.out -w '%{http_code}' \
    -X POST "$HOST/v1/database/$DB/call/ingest_agent_memory" \
    -H "Authorization: Bearer $(anon)" -H 'Content-Type: application/json' \
    --data-binary "[\"$1\",\"2026-09-05\",\"claude-code\",\"$2\"]"
}

# "ok" is under the 3-char floor and must be dropped; the "- " must be stripped.
BLOB="- $MARK shipped the agent memory tables\\n$MARK chased a worker 404\\nok"

[ "$(ingest "$TOKEN" "$BLOB")" = 200 ] || fail "first ingest: $(cat /tmp/agent-memory.check.out)"
FIRST=$(notes)
[ "$FIRST" -eq 2 ] || fail "expected 2 notes kept (short line dropped), got $FIRST"
sql "SELECT note FROM agent_memory" | grep -q "\"$MARK shipped" || fail 'leading "- " was not stripped'

[ "$(ingest "$TOKEN" "$BLOB")" = 200 ] || fail "second ingest: $(cat /tmp/agent-memory.check.out)"
[ "$(notes)" -eq "$FIRST" ] || fail "dedupe: replay added rows ($FIRST -> $(notes))"

# The token is the whole authentication: a wrong one must not write.
if [ "$(ingest bogus-token-aaaaaaaaaaaa "$MARK must not land")" = 200 ]; then fail "bad token was accepted"; fi
grep -q bad_token /tmp/agent-memory.check.out || fail "bad token gave: $(cat /tmp/agent-memory.check.out)"

SYNCS=$(sql "SELECT syncs FROM agent_link" | tail -1 | tr -dc 0-9)
echo "agent-memory.check: $FIRST notes stored, replay deduped, bad token refused, syncs=$SYNCS"

#!/bin/sh
# Empties every player-data table and keeps the house rows (place, company,
# mission, llm_config, secret, google_auth, world_tick). Usage:
#   sh spacetimedb/reset-players.sh local3001 echo
#   sh spacetimedb/reset-players.sh maincloud echoe
set -eu
SERVER=$1; DB=$2
TABLES="player echo intent linked_account event_join event_contact event_build agent_travel run receipt conversation transcript_line correction player_key reveal_secret reveal conversation_summary summary_job contact verification talk_job echo_memory agent_link agent_memory"
for t in $TABLES; do
  spacetime sql --no-config -s "$SERVER" "$DB" "DELETE FROM $t" 2>&1 | grep -v -e '^WARNING' -e '^$' || true
done
echo "remaining rows per table (blank = empty):"
for t in $TABLES; do
  n=$(spacetime sql --no-config -s "$SERVER" "$DB" "SELECT * FROM $t" 2>/dev/null | tail -n +3 | grep -c . || true)
  [ "${n:-0}" -gt 0 ] && echo "  $t: $n"
done
echo "done"

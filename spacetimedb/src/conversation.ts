// When a conversation is over. Pure and dependency-free for the same reason
// social.ts is: this is a rule worth a test, and a rule inside a reducer is a
// rule nobody can run. `spacetimedb/reveal.check.ts` covers it.

/**
 * A meeting lasts three minutes of talking, not a fixed number of lines. The
 * clock starts at `conversation.createdAt`, which for an event pairing is
 * stamped when its first exchange is queued rather than when the row appeared.
 */
export const CONVERSATION_MICROS = 180_000_000n;

/**
 * Safety net, not the rule: one exchange per 5s tick means three minutes is
 * about 36 exchanges, so this only fires if the clock somehow does not.
 */
export const MAX_EXCHANGES = 40;

/**
 * Floor before `[END]` counts. Left to itself the model wraps up in two or
 * three lines, which is a introduction, not a conversation. Below this the
 * marker is stripped and ignored, so only the clock or the ceiling can close.
 */
export const MIN_EXCHANGES = 12;

/** `conversation.closedAt` while the conversation is still open. */
export const OPEN = 0n;

/**
 * Three ways a conversation ends: the model closed it with `[END]` (which
 * stamped `closedAt`) after at least `MIN_EXCHANGES`, the clock ran out, or
 * the safety ceiling was hit. `closedAt` is the record; this is the live test,
 * because a street conversation nobody is ticking still has to read as closed.
 * `replies > 0` keeps an event pairing that has not been given a slot yet from
 * being born expired: its clock has not started.
 */
export function isClosed(
  now: bigint,
  c: { closedAt: bigint; replies: number; createdAt: bigint }
): boolean {
  if (c.replies >= MAX_EXCHANGES) return true;
  if (c.closedAt > OPEN && c.replies >= MIN_EXCHANGES) return true;
  return c.replies > 0 && now - c.createdAt >= CONVERSATION_MICROS;
}

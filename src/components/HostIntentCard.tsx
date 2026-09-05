import { AVATAR_COLOUR, AVATAR_GLYPH } from '../state/copy';
import type { HostCard } from '../state/types';

/** The card a stranger sees when they open someone's /i/<shareId> link. */
export function HostIntentCard({ host }: { host: HostCard }) {
  return (
    <div className="host-card">
      <div className="host-top">
        <span
          className="host-avatar"
          style={{ background: AVATAR_COLOUR[host.avatar] ?? '#f4b857' }}
          aria-hidden="true"
        >
          {AVATAR_GLYPH[host.avatar] ?? '●'}
        </span>
        <div>
          <small>You were invited by</small>
          <strong>{host.name}</strong>
        </div>
      </div>
      <p className="host-intent">“{host.intent}”</p>
      <span className="host-expiry">
        {host.expiresInDays > 0
          ? `Expires in ${host.expiresInDays} ${host.expiresInDays === 1 ? 'day' : 'days'}`
          : 'Expires today'}
      </span>
    </div>
  );
}

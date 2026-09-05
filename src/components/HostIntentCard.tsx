import { VerifiedBadge } from './VerifiedBadge';
import { avatarUri } from '../state/copy';
import type { HostCard } from '../state/types';

/** The card a stranger sees when they open someone's /i/<shareId> link. */
export function HostIntentCard({ host }: { host: HostCard }) {
  return (
    <div className="host-card glass">
      <div className="host-top">
        <span className="host-avatar" aria-hidden="true">
          <img src={avatarUri(host.avatar)} alt="" />
        </span>
        <div>
          <small>You were invited by</small>
          <strong>{host.name}</strong>
          <VerifiedBadge badge={host.badge} />
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

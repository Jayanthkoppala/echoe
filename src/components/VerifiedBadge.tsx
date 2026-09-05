import type { Badge } from '../state/types';

/** Logo plus company name, or just the logo when compact. */
export function VerifiedBadge({ badge, compact = false }: { badge?: Badge; compact?: boolean }) {
  if (!badge) return null;
  return (
    <span className="verified" title={`Verified ${badge.companyName}`}>
      {badge.logo ? (
        <img className="verified-logo" src={badge.logo} alt="" />
      ) : (
        <i className="verified-initials">{badge.companyName.slice(0, 2).toUpperCase()}</i>
      )}
      {compact ? null : <b>Verified · {badge.companyName}</b>}
    </span>
  );
}

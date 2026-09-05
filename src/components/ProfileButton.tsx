import { AVATAR_COLOUR } from '../state/copy';

/** Small round avatar in the top bar. Opens the profile screen. */
export function ProfileButton({
  name,
  avatar,
  onClick,
}: {
  name: string;
  avatar: string;
  onClick: () => void;
}) {
  return (
    <button
      className="profile-btn"
      style={{ background: AVATAR_COLOUR[avatar] ?? '#d7f06c' }}
      onClick={onClick}
      aria-label="Your profile"
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </button>
  );
}

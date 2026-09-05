import { avatarUri } from '../state/copy';

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
      onClick={onClick}
      aria-label={`Your profile, ${name}`}
    >
      <img src={avatarUri(avatar)} alt="" />
    </button>
  );
}

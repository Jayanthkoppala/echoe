interface TopBarProps {
  title: string;
  step?: string;
  onBack?: () => void;
  showMark?: boolean;
}

/** Fixed header. Never scrolls. */
export function TopBar({ title, step, onBack, showMark }: TopBarProps) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="Go back">
          ←
        </button>
      ) : null}
      <div className="brand">
        {showMark ? <span className="brand-mark">E</span> : null}
        {title}
      </div>
      <span className="step-count">{step}</span>
    </header>
  );
}

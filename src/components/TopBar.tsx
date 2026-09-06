import type { ReactNode } from 'react';
import { replayTour, tourAvailable } from '../tour/useTour';

interface TopBarProps {
  title: string;
  step?: string;
  onBack?: () => void;
  showMark?: boolean;
  /** Extra control pinned to the right, e.g. the profile button. */
  right?: ReactNode;
}

/** Fixed header. Never scrolls. */
export function TopBar({ title, step, onBack, showMark, right }: TopBarProps) {
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
      {step ? <span className="step-count">{step}</span> : null}
      {tourAvailable() ? (
        <button
          className="icon-btn tour-help"
          data-tour="topbar-help"
          onClick={() => void replayTour()}
          aria-label="Replay the tour for this screen"
        >
          ?
        </button>
      ) : null}
      {right ?? (step ? null : <span />)}
    </header>
  );
}

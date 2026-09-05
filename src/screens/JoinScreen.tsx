import { useState } from 'react';
import { HostIntentCard } from '../components/HostIntentCard';
import { TopBar } from '../components/TopBar';
import type { HostCard, ScreenProps } from '../state/types';

interface JoinScreenProps extends ScreenProps {
  connected: boolean;
  hostCard?: HostCard;
  hostLinkExpired: boolean;
}

/** One field. A stranger types a name and is in the world. */
export function JoinScreen({ actions, connected, hostCard, hostLinkExpired }: JoinScreenProps) {
  const [name, setName] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    actions.onJoin(name.trim());
  };

  return (
    <form className={hostCard ? 'screen' : 'screen screen--cinema'} onSubmit={submit}>
      {hostCard ? null : (
        <video className="cinema-video" src="/echo-hero.mp4" autoPlay muted loop playsInline aria-hidden="true" />
      )}
      <TopBar title="Echoe" step={connected ? 'Live' : 'Connecting…'} showMark />
      <div className="content content--fit">
        {hostCard ? <HostIntentCard host={hostCard} /> : null}

        {hostLinkExpired ? (
          <p className="expired-note">This link has expired. You can still come in.</p>
        ) : null}

        <h2 className="join-title">
          {hostCard ? 'Send your Echoe to meet theirs.' : 'Send an Echoe into Bengaluru.'}
        </h2>
        <label className="label" htmlFor="playerName">
          Your name
        </label>
        <input
          className="input"
          id="playerName"
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Type your name"
          autoComplete="name"
          maxLength={40}
        />
      </div>
      <div className="footer">
        <button className="primary" type="submit" disabled={!name.trim() || !connected}>
          {connected ? 'Enter Bengaluru' : 'Connecting…'} <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}

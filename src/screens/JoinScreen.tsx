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
    <form className="screen" onSubmit={submit}>
      <TopBar title="Echoe" step={connected ? 'Live' : 'Connecting…'} showMark />
      <div className="content content--fit">
        {hostCard ? (
          <HostIntentCard host={hostCard} />
        ) : (
          <div className="hero-world" aria-hidden="true">
            <div className="city-grid" />
            <i className="pixel-building b1" />
            <i className="pixel-building b2" />
            <i className="pixel-building b3" />
            <i className="pixel-building b4" />
            <i className="tree-dot t1" />
            <i className="tree-dot t2" />
            <i className="tree-dot t3" />
            <i className="hero-agent" />
          </div>
        )}

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

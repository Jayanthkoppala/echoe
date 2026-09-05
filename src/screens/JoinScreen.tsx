import { useState } from 'react';
import { HostIntentCard } from '../components/HostIntentCard';
import { TopBar } from '../components/TopBar';
import type { HostCard, ScreenProps } from '../state/types';

interface JoinScreenProps extends ScreenProps {
  connected: boolean;
  hostCard?: HostCard;
  hostLinkExpired: boolean;
}

/** One field over the live city. A stranger types a name and is in. */
export function JoinScreen({ actions, connected, hostCard, hostLinkExpired }: JoinScreenProps) {
  const [name, setName] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    actions.onJoin(name.trim(), '');
  };

  return (
    <form className="screen screen--hero" onSubmit={submit}>
      <div className="hero-world" aria-hidden="true">
        <video className="hero-video" src="/echo-hero.mp4" autoPlay muted loop playsInline />
      </div>

      <TopBar title="Echoe" step={connected ? 'Live' : 'Connecting…'} showMark />

      <div className="content content--fit">
        {hostCard ? <HostIntentCard host={hostCard} /> : null}

        {hostLinkExpired ? (
          <p className="expired-note">This link has expired. You can still come in.</p>
        ) : null}

        {/* Fix 3: one card in the lower third carries the pitch and the field,
            so a stranger has something to read instead of bare video. */}
        <div className="join-card glass">
          <h2 className="join-title">
            {hostCard ? 'Send your Echoe to meet theirs.' : 'Send an Echoe into Bengaluru.'}
          </h2>
          <p className="join-pitch">
            For everyone in this hall who wants to meet the right person tonight without a
            single cold DM.
          </p>
          <p className="join-pitch">
            It walks the city, talks to other Echoes, comes back with names.
          </p>
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
      </div>

      <div className="footer">
        <button className="primary" type="submit" disabled={!name.trim() || !connected}>
          {connected
            ? hostCard
              ? `Send my Echoe to meet ${hostCard.name}`
              : 'Enter Bengaluru'
            : 'Connecting…'}{' '}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}

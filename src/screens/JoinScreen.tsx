import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import type { ScreenProps } from '../state/types';

/**
 * Entry is one field. A stranger types a name and is in the world.
 * No password, no profile, no interests picker before first value.
 */
export function JoinScreen({ actions }: ScreenProps) {
  const [name, setName] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    actions.onJoin(name.trim());
  };

  return (
    <form className="screen" onSubmit={submit}>
      <TopBar title="Echo" step="01 / 08" showMark />
      <div className="content content--fit">
        <div className="hero-world" aria-hidden="true">
          <video className="hero-video" src="/echo-hero.mp4" autoPlay muted loop playsInline />
        </div>
        <h2 className="join-title">Talk, meet and have fun with Echoes.</h2>
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
          maxLength={24}
        />
      </div>
      <div className="footer">
        <button className="primary" type="submit" disabled={!name.trim()}>
          Enter Bengaluru <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}

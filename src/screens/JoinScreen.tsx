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

import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { AVATARS, PERSONA_PROMPT } from '../state/mock';
import type { ScreenProps } from '../state/types';

export function CreateScreen({ actions, go }: ScreenProps) {
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [persona, setPersona] = useState('');
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(PERSONA_PROMPT);
    } catch {
      // Clipboard is unavailable in some embedded browsers. The prompt is
      // still selectable on screen, so this is not worth surfacing.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="screen">
      <TopBar title="Create your Echo" step="02 / 08" onBack={() => go('join')} />
      <div className="content content--fit">
        <div className="section-block" style={{ marginTop: 14 }}>
          <span className="label">Choose a character</span>
          <div className="avatar-row" role="list" aria-label="Character choices">
            {AVATARS.map(colour => (
              <button
                key={colour}
                className={colour === avatar ? 'avatar selected' : 'avatar'}
                style={{ ['--avatar' as string]: colour }}
                onClick={() => setAvatar(colour)}
                aria-label={`Character ${colour}`}
                aria-pressed={colour === avatar}
              />
            ))}
          </div>
        </div>

        <div className="section-block">
          <span className="label">Describe your persona</span>
          <div className="prompt-card">
            <p className="prompt-text">{PERSONA_PROMPT}</p>
            <button className="copy-btn" type="button" onClick={copyPrompt}>
              {copied ? 'Copied' : 'Copy prompt'}
            </button>
          </div>
          <p className="helper helper--tight">
            Paste this into ChatGPT or Claude, then bring the answer back here.
          </p>
          <textarea
            className="textarea"
            value={persona}
            onChange={event => setPersona(event.target.value)}
            placeholder="Paste your persona here…"
            aria-label="Your persona"
          />
        </div>
      </div>
      <div className="footer">
        <button className="primary" onClick={() => actions.onCreateEcho(avatar, persona)}>
          Create my Echo <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

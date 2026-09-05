import { useState } from 'react';
import { HostIntentCard } from '../components/HostIntentCard';
import { TopBar } from '../components/TopBar';
import { AVATAR_GLYPH, AVATAR_OPTIONS, INTENT_PLACEHOLDER, PERSONA_PROMPT } from '../state/copy';
import type { HostCard, ScreenProps } from '../state/types';

/** The intent is the product, so it is the first and only required field. */
export function CreateScreen({ actions, go, hostCard }: ScreenProps & { hostCard?: HostCard }) {
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0].id);
  const [intent, setIntent] = useState('');
  const [persona, setPersona] = useState('');
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(PERSONA_PROMPT);
    } catch {
      // Clipboard is blocked in some embedded browsers. The prompt is still on
      // screen and selectable, so this is not worth interrupting anyone over.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="screen">
      <TopBar title="Your intent" step="02 / 08" onBack={() => go('join')} />
      <div className="content">
        {hostCard ? <HostIntentCard host={hostCard} /> : null}

        <label className="label" htmlFor="intent">
          What are you here for, in one line?
        </label>
        <textarea
          className="textarea textarea--intent"
          id="intent"
          value={intent}
          onChange={event => setIntent(event.target.value)}
          placeholder={INTENT_PLACEHOLDER}
          maxLength={120}
        />
        <p className="helper helper--tight">
          Your Echoe carries this line around the city and shows it to anyone worth meeting.
        </p>

        <div className="section-block">
          <span className="label">Choose a character</span>
          <div className="avatar-row" role="list" aria-label="Character choices">
            {AVATAR_OPTIONS.map(option => (
              <button
                key={option.id}
                className={option.id === avatar ? 'avatar selected' : 'avatar'}
                style={{ ['--avatar' as string]: option.colour }}
                onClick={() => setAvatar(option.id)}
                aria-label={option.id}
                aria-pressed={option.id === avatar}
              >
                <span className="avatar-glyph" aria-hidden="true">
                  {AVATAR_GLYPH[option.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="section-block">
          <span className="label">Give it a voice (optional)</span>
          <div className="prompt-card">
            <p className="prompt-text">{PERSONA_PROMPT}</p>
            <button className="copy-btn" type="button" onClick={copyPrompt}>
              {copied ? 'Copied' : 'Copy prompt'}
            </button>
          </div>
          <p className="helper helper--tight">
            Paste this into ChatGPT or Claude, then bring the answer back here. Skip it and
            your Echoe still goes.
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
        <button
          className="primary"
          disabled={!intent.trim()}
          onClick={() => actions.onCreateEcho(avatar, persona, intent.trim())}
        >
          Send my Echoe out <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

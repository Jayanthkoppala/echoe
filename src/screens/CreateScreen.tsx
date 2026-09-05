import { useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import { HostIntentCard } from '../components/HostIntentCard';
import { TopBar } from '../components/TopBar';
import type { DbConnection } from '../module_bindings';
import { AVATAR_GLYPH, AVATAR_OPTIONS, INTENT_PLACEHOLDER, PERSONA_PROMPT } from '../state/copy';
import type { HostCard, ScreenProps } from '../state/types';

/**
 * Persona first: it is who your Echoe is and what other Echoes match against.
 * The intent is derived from it, by tapping a suggestion or typing a line.
 */
export function CreateScreen({ actions, go, hostCard }: ScreenProps & { hostCard?: HostCard }) {
  const { getConnection } = useSpacetimeDB();
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0].id);
  const [persona, setPersona] = useState('');
  const [intent, setIntent] = useState('');
  const [copied, setCopied] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);

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

  const suggest = async () => {
    const conn = getConnection() as DbConnection | undefined;
    if (!conn || suggesting) return;
    setSuggesting(true);
    try {
      const text: string = await conn.procedures.suggestIntents({ persona: persona.trim() });
      setSuggestions(text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0));
    } catch {
      setSuggestions([]);
    } finally {
      setSuggesting(false);
    }
  };

  const personaReady = persona.trim().length >= 12;

  return (
    <div className="screen">
      <TopBar title="Your Echoe" step="02 / 08" onBack={() => go('join')} />
      <div className="content">
        {hostCard ? <HostIntentCard host={hostCard} /> : null}

        <div className="section-block" style={{ marginTop: 0 }}>
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
          <label className="label" htmlFor="persona">
            Who is your Echoe?
          </label>
          <div className="prompt-card">
            <p className="prompt-text">{PERSONA_PROMPT}</p>
            <button className="copy-btn" type="button" onClick={copyPrompt}>
              {copied ? 'Copied' : 'Copy prompt'}
            </button>
          </div>
          <p className="helper helper--tight">
            Paste this into ChatGPT or Claude and bring the answer back, or type two lines yourself.
          </p>
          <textarea
            className="textarea"
            id="persona"
            value={persona}
            onChange={event => setPersona(event.target.value)}
            placeholder="Fintech founder, blunt, curious, buys coffee for anyone who has shipped payments…"
            aria-label="Your persona"
          />
        </div>

        <div className="section-block">
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
          <button
            className="secondary"
            type="button"
            disabled={!personaReady || suggesting}
            onClick={suggest}
          >
            {suggesting ? 'Reading your persona…' : 'Suggest from my persona'}
          </button>
          {suggestions.length > 0 ? (
            <div className="chip-row" role="list" aria-label="Suggested intents">
              {suggestions.map(line => (
                <button
                  key={line}
                  type="button"
                  className={line === intent ? 'chip selected' : 'chip'}
                  onClick={() => setIntent(line)}
                >
                  {line}
                </button>
              ))}
            </div>
          ) : null}
          <p className="helper helper--tight">
            Your Echoe carries your persona through the city and uses this line to find the people worth meeting.
          </p>
        </div>
      </div>
      <div className="footer">
        <button
          className="primary"
          disabled={!personaReady || !intent.trim()}
          onClick={() => actions.onCreateEcho(avatar, persona.trim(), intent.trim())}
        >
          Send my Echoe out <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

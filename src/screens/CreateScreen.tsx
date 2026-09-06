import { useState } from 'react';
import { HostIntentCard } from '../components/HostIntentCard';
import { TopBar } from '../components/TopBar';
import { PERSONA_PROMPT } from '../state/copy';
import type { HostCard, ScreenProps } from '../state/types';

/**
 * Persona only: who your Echoe is, and what other Echoes match against.
 * What you are here for is asked on the Start page, right before the run.
 */
export function CreateScreen({
  actions,
  go,
  hostCard,
  onConnect,
}: ScreenProps & { hostCard?: HostCard; onConnect: () => void }) {
  const [persona, setPersona] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

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
      <TopBar title="Your Echoe" onBack={() => go('join')} />
      <div className="content">
        {hostCard ? <HostIntentCard host={hostCard} /> : null}

        <div className="section-block">
          <label className="label" htmlFor="persona">
            Write it yourself
          </label>
          {showPrompt ? (
            <div className="prompt-card glass">
              <p className="prompt-text">{PERSONA_PROMPT}</p>
              <button className="copy-btn" type="button" onClick={copyPrompt}>
                {copied ? 'Copied' : 'Copy prompt'}
              </button>
            </div>
          ) : null}
          <textarea
            className="textarea"
            id="persona"
            value={persona}
            onChange={event => setPersona(event.target.value)}
            placeholder="Fintech founder, blunt, curious, buys coffee for anyone who has shipped payments…"
            aria-label="Your persona"
            autoFocus
          />
          <p className="helper helper--tight">
            Two lines in your own words is enough.{' '}
            {showPrompt ? (
              'Paste this into ChatGPT or Claude and bring the answer back.'
            ) : (
              <button className="link-btn" type="button" onClick={() => setShowPrompt(true)}>
                Prefer to generate one?
              </button>
            )}
          </p>
        </div>

        <div className="or-divider" aria-hidden="true"><span>or</span></div>

        <div className="section-block">
          <span className="label">Let your coding agent write it</span>
          <div className="agent-card glass">
            <p>
              On Claude Code or Codex? Our MCP writes your persona from what it already knows about you. One click, nothing to type.
            </p>
            <button className="agent-btn" type="button" onClick={onConnect}>
              Let my coding agent write it
            </button>
          </div>
        </div>
      </div>
      <div className="footer">
        <button
          className="primary"
          disabled={!persona.trim()}
          onClick={() => actions.onCreateEcho(persona.trim())}
        >
          {hostCard ? `Go and meet ${hostCard.name}` : 'Send my Echoe out'}{' '}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

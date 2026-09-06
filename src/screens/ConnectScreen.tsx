import { useEffect, useRef, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { AGENT_MCP_WHY, AGENT_SAFETY, AGENT_SAFETY_LINE, AGENT_TOKEN_KEY, agentOnboardPaste, agentOnboardUrl, dayChip } from '../state/copy';
import { FEATURED_EVENT } from '../state/copy';
import type { AgentNote, AgentStages, ScreenName, ScreenProps } from '../state/types';

interface ConnectScreenProps extends ScreenProps {
  agentNotes: AgentNote[];
  onToast: (message: string) => void;
  backTo: ScreenName;
  stages: AgentStages;
  hasEcho: boolean;
  onJoinEvent: () => void;
}

const newToken = (): string => crypto.randomUUID().replace(/-/g, '');

/** Selects the element's text so a clipboard-blocked browser can still copy it. */
function selectAll(el: HTMLElement | null) {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * One paste. The line points the player's coding agent at a document that
 * carries every step (read, persona, building, memory, confirm), so nothing is
 * installed and nothing is restarted.
 */
export function ConnectScreen({ actions, go, agentNotes, onToast, backTo, stages, hasEcho, onJoinEvent }: ConnectScreenProps) {
  const [token, setToken] = useState('');
  const pasteRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(AGENT_TOKEN_KEY);
    if (saved) {
      // Re-register every visit: the link row may be gone (a reset, a new
      // database) while the token lives on in this browser. The reducer upserts.
      setToken(saved);
      actions.onSetAgentLink(saved);
      return;
    }
    const fresh = newToken();
    localStorage.setItem(AGENT_TOKEN_KEY, fresh);
    setToken(fresh);
    actions.onSetAgentLink(fresh);
    // Runs once, on first mount of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotateToken = () => {
    const fresh = newToken();
    localStorage.setItem(AGENT_TOKEN_KEY, fresh);
    setToken(fresh);
    actions.onSetAgentLink(fresh);
    onToast('New link made. The old one stops working.');
  };

  const paste = agentOnboardPaste(token);
  // Split rather than re-typing the sentence, so the rendered <pre> stays byte-identical to what Copy writes.
  const url = agentOnboardUrl(token);
  const [beforeUrl, afterUrl] = paste.split(url);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(paste);
      onToast('Copied');
    } catch {
      selectAll(pasteRef.current);
      onToast('Copy blocked — text selected, copy it yourself');
    }
  };

  // The three things the agent writes. Once they are all in, the player's part
  // is the event page, so walk them there instead of leaving them on a done list.
  const written = stages.persona && stages.building && stages.memory;
  const handedOff = useRef(false);
  useEffect(() => {
    if (!written || handedOff.current) return;
    handedOff.current = true;
    // A beat, so the third tick is seen landing before the screen changes.
    const timer = setTimeout(() => go('events'), 1500);
    return () => clearTimeout(timer);
  }, [written, go]);

  const latestDay = agentNotes[0]?.day;
  const status = latestDay ? `Your agent last wrote on ${dayChip(latestDay)}` : 'Your agent has not written yet';

  return (
    <div className="screen">
      <TopBar title="Let your agent write it" onBack={() => go(backTo)} />
      <div className="content">
        <p className="lede">{AGENT_MCP_WHY}</p>
        <div className="safety-row" data-tour="connect-safety">
          <ul className="safety-list">
            {AGENT_SAFETY.map(claim => (
              <li key={claim}>{claim}</li>
            ))}
          </ul>
          <p className="safety-note">{AGENT_SAFETY_LINE}</p>
        </div>

        <div className="section-block">
          <div className="label">Paste this into Claude Code or Codex</div>
          <div className="copy-block connect-paste">
            <pre ref={pasteRef}>
              {beforeUrl}
              <span className="paste-url">{url}</span>
              {afterUrl}
            </pre>
            <div className="copy-actions">
              <button className="copy-btn" onClick={copy}>
                Copy
              </button>
              <button className="link-btn" onClick={rotateToken}>
                New token
              </button>
            </div>
          </div>
        </div>

        <div className="section-block stages-block">
          <div className="label">What lands, as it lands</div>
          <ol className="stages">
            <li className={stages.persona ? 'done' : ''}>Your Echoe, in your voice</li>
            <li className={stages.building ? 'done' : ''}>What you are building, for {FEATURED_EVENT.title}</li>
            <li className={stages.memory ? 'done' : ''}>What you have been working on lately</li>
            <li className={stages.joined ? 'done' : ''}>
              {stages.joined ? (
                `In the room at ${FEATURED_EVENT.title}`
              ) : (
                <>
                  You: one line on what you want from {FEATURED_EVENT.title}, and a link.
                  <button
                    className="copy-btn stage-action"
                    onClick={onJoinEvent}
                    disabled={!stages.building}
                  >
                    Join {FEATURED_EVENT.title} <span aria-hidden="true">→</span>
                  </button>
                  {!stages.building && <span className="stage-hint">Unlocks once your agent has written what you are building.</span>}
                </>
              )}
            </li>
          </ol>
          <p className={latestDay ? 'connect-status connect-status--live' : 'connect-status'}>{status}</p>
        </div>
      </div>
      <div className="footer">
        <button className="primary" onClick={() => go(written ? 'events' : hasEcho ? 'world' : backTo)}>
          {written ? (
            <>
              Continue to {FEATURED_EVENT.title} <span aria-hidden="true">→</span>
            </>
          ) : hasEcho ? (
            'To the map'
          ) : (
            'Done'
          )}
        </button>
      </div>
    </div>
  );
}

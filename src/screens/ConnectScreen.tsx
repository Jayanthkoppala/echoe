import { useEffect, useRef, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { AGENT_MCP_WHY, AGENT_TOKEN_KEY, agentOnboardPaste, dayChip } from '../state/copy';
import type { AgentNote, ScreenName, ScreenProps } from '../state/types';

interface ConnectScreenProps extends ScreenProps {
  agentNotes: AgentNote[];
  onToast: (message: string) => void;
  backTo: ScreenName;
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
export function ConnectScreen({ actions, go, agentNotes, onToast, backTo }: ConnectScreenProps) {
  const [token, setToken] = useState('');
  const pasteRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(AGENT_TOKEN_KEY);
    if (saved) {
      setToken(saved);
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
  };

  const paste = agentOnboardPaste(token);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(paste);
      onToast('Copied');
    } catch {
      selectAll(pasteRef.current);
      onToast('Copy blocked — text selected, copy it yourself');
    }
  };

  const latestDay = agentNotes[0]?.day;
  const status = latestDay ? `Your agent last wrote on ${dayChip(latestDay)}` : 'Your agent has not written yet';

  return (
    <div className="screen">
      <TopBar title="Let your agent write it" onBack={() => go(backTo)} />
      <div className="content">
        <p className="lede">{AGENT_MCP_WHY}</p>

        <div className="label">Paste this into Claude Code or Codex</div>
        <div className="copy-block">
          <pre ref={pasteRef}>{paste}</pre>
          <button className="copy-btn" onClick={copy}>
            Copy
          </button>
        </div>

        <div className="label">Your token</div>
        <div className="token-box">
          <code>{token || 'generating…'}</code>
          <button className="link-btn" onClick={rotateToken}>
            New token
          </button>
        </div>

        <p className="connect-status">{status}</p>
      </div>
      <div className="footer">
        <button className="primary" onClick={() => go(backTo)}>
          Done
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { AGENT_CONNECT_WHY, AGENT_TOKEN_KEY, agentConnectCommand, agentConnectPaste, dayChip } from '../state/copy';
import type { AgentNote, ScreenProps } from '../state/types';

interface ConnectScreenProps extends ScreenProps {
  agentNotes: AgentNote[];
  onToast: (message: string) => void;
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

export function ConnectScreen({ actions, go, agentNotes, onToast }: ConnectScreenProps) {
  const [token, setToken] = useState('');
  const commandRef = useRef<HTMLPreElement>(null);
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

  const copy = async (text: string, el: HTMLElement | null) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast('Copied');
    } catch {
      selectAll(el);
      onToast('Copy blocked — text selected, copy it yourself');
    }
  };

  const latestDay = agentNotes[0]?.day;
  const latestCount = agentNotes.filter(note => note.day === latestDay).length;
  const status = latestDay ? `Last sync ${dayChip(latestDay)} · ${latestCount} lines` : 'Not synced yet';

  return (
    <div className="screen">
      <TopBar title="Connect your coding agent" onBack={() => go('profile')} />
      <div className="content">
        <p className="lede">{AGENT_CONNECT_WHY}</p>

        <div className="label">Your token</div>
        <div className="token-box">
          <code>{token || 'generating…'}</code>
          <button className="link-btn" onClick={rotateToken}>
            New token
          </button>
        </div>

        <div className="label">Step 1 · run this</div>
        <div className="copy-block">
          <pre ref={commandRef}>{agentConnectCommand(token)}</pre>
          <button className="copy-btn" onClick={() => copy(agentConnectCommand(token), commandRef.current)}>
            Copy
          </button>
        </div>

        <div className="label">Step 2 · or paste this into Claude Code / Codex</div>
        <div className="copy-block">
          <pre ref={pasteRef}>{agentConnectPaste(token)}</pre>
          <button className="copy-btn" onClick={() => copy(agentConnectPaste(token), pasteRef.current)}>
            Copy
          </button>
        </div>

        <p className="connect-status">{status}</p>
      </div>
      <div className="footer">
        <button className="primary" onClick={() => go('profile')}>
          Done
        </button>
      </div>
    </div>
  );
}

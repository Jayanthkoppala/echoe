import { useState } from 'react';
import { shareText } from '../state/copy';

interface ShareCardProps {
  intent: string;
  shareId: string;
  mission: string;
}

/** The link is the product. Everything here exists to get it posted. */
export function ShareCard({ intent, shareId, mission }: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/i/${shareId}`;
  const text = shareText(intent, url);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard is blocked in some embedded browsers. The link is on screen.
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Echoe', text, url });
        return;
      } catch {
        // A cancelled share sheet is not a failure, fall through to copying.
      }
    }
    void copy();
  };

  const links = [
    { id: 'X', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` },
    {
      id: 'in',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    { id: 'WA', href: `https://wa.me/?text=${encodeURIComponent(text)}` },
  ];

  if (!shareId) return null;

  return (
    <div className="share-card">
      {mission ? <small className="share-mission">{mission}</small> : null}
      <p className="share-intent">
        Your Echoe is carrying: <strong>{intent}</strong>
      </p>
      <div className="share-link">
        <code>{url}</code>
        <button className="copy-btn" type="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <div className="share-row">
        <button className="share-btn share-btn--main" type="button" onClick={share}>
          Share
        </button>
        {links.map(link => (
          <a
            key={link.id}
            className="share-btn"
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {link.id}
          </a>
        ))}
      </div>
    </div>
  );
}

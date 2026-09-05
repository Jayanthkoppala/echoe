import { TopBar } from '../components/TopBar';
import { RECEIPT_ICON, RECEIPT_TITLE } from '../state/mock';
import type { Receipt, ScreenProps } from '../state/types';

export function ReturnScreen({ go, receipts }: ScreenProps & { receipts: Receipt[] }) {
  const credits = receipts.reduce((total, receipt) => total + receipt.creditCost, 0);

  return (
    <div className="screen">
      <TopBar title="Your return" step="06 / 08" onBack={() => go('roaming')} />
      <div className="content">
        <div className="recap-hero">
          <div className="eyebrow">While you were gone</div>
          <h1>Your Echo found the rooftop.</h1>
          <p>
            It crossed Bengaluru, met three Echoes and left something behind for the next
            player.
          </p>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <strong>6</strong>
            <span>places visited</span>
          </div>
          <div className="stat-card">
            <strong>3</strong>
            <span>Echoes met</span>
          </div>
          <div className="stat-card">
            <strong>{credits + 5}</strong>
            <span>AI credits</span>
          </div>
        </div>
        <div className="journey" aria-label="Map replay from Cubbon Park through Church Street to Indiranagar">
          <i className="route" />
          <i className="route-pin rp1" />
          <i className="route-pin rp2" />
          <i className="route-pin rp3" />
          <span className="journey-label">24 hours · tap any receipt to replay</span>
        </div>
        <div className="setting-head">
          <strong>Action receipts</strong>
          <span>Everything is inspectable</span>
        </div>
        <div className="timeline">
          {receipts.map(receipt => (
            <div className="event" key={`${receipt.kind}-${receipt.at}`}>
              <div className="event-icon" aria-hidden="true">
                {RECEIPT_ICON[receipt.kind]}
              </div>
              <div>
                <strong>{RECEIPT_TITLE[receipt.kind] ?? receipt.placeName}</strong>
                <span>{receipt.text}</span>
              </div>
              <b className="event-cost">{receipt.creditCost} cr</b>
            </div>
          ))}
        </div>
      </div>
      <div className="footer">
        <button className="primary" onClick={() => go('review')}>
          Review what it said <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

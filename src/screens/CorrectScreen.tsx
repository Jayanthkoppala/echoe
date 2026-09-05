import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { PROPOSED_BEHAVIOUR, SUGGESTED_CORRECTION } from '../state/mock';
import type { ScreenProps, TranscriptLine } from '../state/types';

export function CorrectScreen({ actions, go, line }: ScreenProps & { line: TranscriptLine }) {
  const [text, setText] = useState(SUGGESTED_CORRECTION);

  return (
    <div className="screen">
      <TopBar title="Correct your Echo" step="08 / 08" onBack={() => go('review')} />
      <div className="content">
        <div className="eyebrow">One correction at a time</div>
        <h2>What should it learn?</h2>
        <p className="lede">Change the behaviour, not the historical receipt.</p>
        <div className="correction-card">
          <blockquote className="quote">“{line.text}”</blockquote>
          <label className="label" htmlFor="correction">
            My Echo should have said…
          </label>
          <textarea
            className="textarea"
            id="correction"
            value={text}
            onChange={event => setText(event.target.value)}
          />
          <div className="memory-change">
            <span aria-hidden="true">✦</span>
            <span>
              <strong>Proposed behaviour change</strong>
              <br />
              {PROPOSED_BEHAVIOUR}
            </span>
          </div>
        </div>
      </div>
      <div className="footer">
        <button className="primary" onClick={() => actions.onCorrect(line.id, text)}>
          Update Echo and close the loop <span aria-hidden="true">→</span>
        </button>
        <button className="secondary" onClick={() => go('review')}>
          Keep the original behaviour
        </button>
      </div>
    </div>
  );
}

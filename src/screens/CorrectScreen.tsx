import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { behaviourFrom } from '../state/copy';
import type { ScreenProps, TranscriptLine } from '../state/types';

export function CorrectScreen({ actions, go, line }: ScreenProps & { line?: TranscriptLine }) {
  const [said, setSaid] = useState('');
  const [change, setChange] = useState('');

  if (!line) {
    return (
      <div className="screen">
        <TopBar title="Correct your Echo" step="08 / 08" onBack={() => go('review')} />
        <div className="content">
          <p className="lede">Pick one of your Echo's lines first.</p>
        </div>
        <div className="footer">
          <button className="secondary" onClick={() => go('review')}>
            Back to the conversation
          </button>
        </div>
      </div>
    );
  }

  const preview = change.trim() || behaviourFrom(said);

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
            value={said}
            onChange={event => setSaid(event.target.value)}
            placeholder="I would like to verify your side first."
            maxLength={500}
          />
          <label className="label" htmlFor="behaviour">
            The rule to carry forward (optional)
          </label>
          <textarea
            className="textarea"
            id="behaviour"
            value={change}
            onChange={event => setChange(event.target.value)}
            placeholder="Left blank, one is written from the line above."
            maxLength={500}
          />
          {preview ? (
            <div className="memory-change">
              <span aria-hidden="true">✦</span>
              <span>
                <strong>Proposed behaviour change</strong>
                <br />
                {preview}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="footer">
        <button
          className="primary"
          disabled={!said.trim()}
          onClick={() => actions.onCorrect(line.id, said.trim(), change)}
        >
          Update Echo and close the loop <span aria-hidden="true">→</span>
        </button>
        <button className="secondary" onClick={() => go('review')}>
          Keep the original behaviour
        </button>
      </div>
    </div>
  );
}

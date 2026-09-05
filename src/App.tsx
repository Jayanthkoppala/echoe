import { useEffect, useMemo, useState } from 'react';
import './styles.css';

import { CorrectScreen } from './screens/CorrectScreen';
import { CreateScreen } from './screens/CreateScreen';
import { DoneScreen } from './screens/DoneScreen';
import { JoinScreen } from './screens/JoinScreen';
import { LimitsScreen } from './screens/LimitsScreen';
import { ReturnScreen } from './screens/ReturnScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { RoamingScreen } from './screens/RoamingScreen';
import { WorldScreen } from './screens/WorldScreen';

import {
  ACTIONS,
  mockPlayer,
  mockReceipts,
  mockRun,
  mockTranscript,
  placeById,
} from './state/mock';
import type { Actions, ScreenName } from './state/types';

/**
 * Single-file state router. Every callback below is a wiring point: swap the
 * local setState for the matching SpacetimeDB reducer once the bindings land.
 */
function App() {
  const [screen, setScreen] = useState<ScreenName>('join');
  const [player, setPlayer] = useState(mockPlayer);
  const [run, setRun] = useState(mockRun);
  const [transcript, setTranscript] = useState(mockTranscript);
  const [focusedId, setFocusedId] = useState('l4');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1900);
    return () => clearTimeout(timer);
  }, [toast]);

  const actions: Actions = useMemo(
    () => ({
      // reducer: join_world(name)
      onJoin(name) {
        setPlayer(current => ({ ...current, name }));
        setScreen('create');
      },
      // reducer: create_echo(avatar, persona, intent)
      onCreateEcho(avatar, _persona, intent) {
        setPlayer(current => ({ ...current, avatar, intent }));
        setScreen('world');
      },
      // reducer: travel(place_id)
      onTravel(placeId) {
        setPlayer(current => ({ ...current, currentPlace: placeId }));
        setToast(`Travelling to ${placeById(placeId).name} · 0 AI credits`);
      },
      // reducer: act(kind)
      onAct(kind) {
        const action = ACTIONS.find(item => item.kind === kind);
        if (!action) return;
        if (action.cost > 0) {
          setPlayer(current => ({ ...current, credits: Math.max(0, current.credits - action.cost) }));
        }
        setToast(action.toast);
      },
      // reducer: start_run(limits)
      onStartRun(limits) {
        setRun(current => ({ ...current, ...limits, status: 'running' }));
        setScreen('roaming');
      },
      // reducer: set_run_status(paused | running)
      onPause() {
        setRun(current => ({
          ...current,
          status: current.status === 'running' ? 'paused' : 'running',
        }));
      },
      // reducer: rate_line(line_id, sounds_like_me)
      onRateLine(id, soundsLikeMe) {
        setFocusedId(id);
        setTranscript(current =>
          current.map(line =>
            line.id === id
              ? { ...line, feedback: soundsLikeMe ? 'sounds-like-me' : 'not-me' }
              : line,
          ),
        );
      },
      // reducer: correct_line(line_id, should_have_said)
      onCorrect() {
        setRun(current => ({ ...current, status: 'done' }));
        setScreen('done');
      },
    }),
    [],
  );

  const go = setScreen;
  const focusedLine = transcript.find(line => line.id === focusedId) ?? transcript[transcript.length - 1];

  return (
    <main className="phone">
      {screen === 'join' && <JoinScreen actions={actions} go={go} />}
      {screen === 'create' && <CreateScreen actions={actions} go={go} />}
      {screen === 'world' && (
        <WorldScreen actions={actions} go={go} player={player} toast={toast} />
      )}
      {screen === 'limits' && <LimitsScreen actions={actions} go={go} run={run} />}
      {screen === 'roaming' && <RoamingScreen actions={actions} go={go} run={run} />}
      {screen === 'return' && <ReturnScreen actions={actions} go={go} receipts={mockReceipts} />}
      {screen === 'review' && (
        <ReviewScreen
          actions={actions}
          go={go}
          transcript={transcript}
          focusedId={focusedId}
          onFocus={setFocusedId}
        />
      )}
      {screen === 'correct' && <CorrectScreen actions={actions} go={go} line={focusedLine} />}
      {screen === 'done' && <DoneScreen actions={actions} go={go} />}
    </main>
  );
}

export default App;

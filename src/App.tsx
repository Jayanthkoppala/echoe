import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { reducers, tables } from './module_bindings';
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

import { DEFAULT_ALLOWED, behaviourFrom } from './state/copy';
import {
  agentsFrom,
  hostCardFrom,
  placeIndexOf,
  rankedMatches,
  toPlayer,
  toReceipt,
  toRun,
  toTranscript,
} from './state/select';
import type { Actions, ScreenName } from './state/types';

/** Reads the share id out of /i/<shareId>. Empty when entered directly. */
const hostShareIdFromUrl = (): string =>
  window.location.pathname.match(/^\/i\/([a-z0-9]+)/i)?.[1] ?? '';

function App() {
  const { identity, isActive } = useSpacetimeDB();
  const [screen, setScreen] = useState<ScreenName>('join');
  const [toast, setToast] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lineId, setLineId] = useState<string | null>(null);
  const [hostShareId] = useState(hostShareIdFromUrl);
  // Limits is an edit of a live run now, so it returns to whoever opened it.
  const [limitsFrom, setLimitsFrom] = useState<ScreenName>('world');

  const [players, playersReady] = useTable(tables.player);
  const [echoes] = useTable(tables.echo);
  const [intents, intentsReady] = useTable(tables.intent);
  const [runs] = useTable(tables.run);
  const [receiptRows] = useTable(tables.receipt);
  const [conversations] = useTable(tables.conversation);
  const [lines] = useTable(tables.transcriptLine);
  const [travels] = useTable(tables.agentTravel);
  const [places] = useTable(tables.place);
  const [missions] = useTable(tables.mission);

  const join = useReducer(reducers.join);
  const createEcho = useReducer(reducers.createEcho);
  const travel = useReducer(reducers.travel);
  const act = useReducer(reducers.act);
  const startRun = useReducer(reducers.startRun);
  const pauseRun = useReducer(reducers.pauseRun);
  const resumeRun = useReducer(reducers.resumeRun);
  const endRun = useReducer(reducers.endRun);
  const rateLine = useReducer(reducers.rateLine);
  const correct = useReducer(reducers.correct);

  const hex = identity?.toHexString();
  const myPlayerRow = players.find(row => row.identity.toHexString() === hex);
  const myEchoRow = echoes.find(row => row.owner.toHexString() === hex);
  const myIntentRow = intents.find(row => row.owner.toHexString() === hex);
  const myRunRow = runs.find(row => row.owner.toHexString() === hex);

  const hostIntentRow = hostShareId
    ? intents.find(row => row.shareId === hostShareId)
    : undefined;
  const hostPlayerRow = hostIntentRow
    ? players.find(row => row.identity.toHexString() === hostIntentRow.owner.toHexString())
    : undefined;

  const hostName = hostPlayerRow?.name ?? '';

  /** Reducer errors are the only failure a player can act on, so surface them. */
  const run = useCallback(
    (label: string, promise: Promise<unknown>, onDone?: () => void) => {
      promise
        .then(() => onDone?.())
        .catch((error: unknown) => {
          setToast(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
        });
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // A returning player already has an Echoe, so do not make them introduce
  // themselves twice.
  useEffect(() => {
    if (screen === 'join' && myEchoRow) setScreen('world');
  }, [screen, myEchoRow]);

  // The module ends a run on its own when the budget or the goal runs out.
  useEffect(() => {
    if (screen === 'roaming' && myRunRow?.status === 'ended') setScreen('return');
  }, [screen, myRunRow?.status]);

  const actions: Actions = useMemo(
    () => ({
      onJoin(name) {
        run('Join', join({ name }), () => setScreen('create'));
      },
      onCreateEcho(avatar, persona, intent) {
        // Decision 2: no Limits stop on the first run. The run starts here with
        // the defaults so World opens with the Echoe already walking.
        run(
          'Create Echoe',
          createEcho({ avatar, persona, intent }).then(() =>
            startRun({
              goal: hostName ? `Meet ${hostName}` : intent,
              maxPeople: 3,
              repliesPerPerson: 2,
              creditCap: 8,
              allowedActions: DEFAULT_ALLOWED.join(','),
              hostShareId,
            }),
          ),
          () => setScreen('world'),
        );
      },
      onTravel(placeId) {
        run('Travel', travel({ placeId: placeIndexOf(placeId) }));
      },
      onAct(kind) {
        run('Action', act({ kind }));
      },
      onStartRun(limits) {
        run(
          'Start run',
          startRun({
            goal: limits.goal,
            maxPeople: limits.maxPeople,
            repliesPerPerson: limits.repliesPerPerson,
            creditCap: limits.creditCap,
            allowedActions: limits.allowedActions.join(','),
            hostShareId,
          }),
          // Limits now edits a live run, so land back where it was opened from.
          () => setScreen(limitsFrom),
        );
      },
      onPause() {
        const paused = myRunRow?.status === 'paused';
        run(paused ? 'Resume' : 'Pause', paused ? resumeRun() : pauseRun());
      },
      onEndRun() {
        run('End run', endRun(), () => setScreen('return'));
      },
      onRateLine(id, soundsLikeMe) {
        setLineId(id);
        run('Rating', rateLine({ lineId: BigInt(id), soundsLikeMe }));
      },
      onCorrect(id, shouldHaveSaid, behaviourChange) {
        const change = behaviourChange.trim() || behaviourFrom(shouldHaveSaid);
        run(
          'Correction',
          correct({ lineId: BigInt(id), shouldHaveSaid, behaviourChange: change }),
          () => setScreen('done'),
        );
      },
    }),
    // The reducer handles are stable; myRunRow.status decides pause versus resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, hostShareId, hostName, limitsFrom, myRunRow?.status],
  );

  const go = setScreen;
  const player = myPlayerRow ? toPlayer(myPlayerRow) : undefined;
  const runView = myRunRow ? toRun(myRunRow) : undefined;
  const myEchoId = myEchoRow?.id;
  const hostEchoId = hostIntentRow?.echoId;

  const agents = useMemo(
    () => agentsFrom(travels, echoes, players, myEchoId, hostEchoId),
    [travels, echoes, players, myEchoId, hostEchoId],
  );

  const matches = useMemo(
    () => rankedMatches(conversations, myEchoId, hostEchoId, echoes, players),
    [conversations, myEchoId, hostEchoId, echoes, players],
  );

  const transcript = useMemo(
    () => (conversationId ? toTranscript(lines, conversationId, myEchoId, echoes, players) : []),
    [lines, conversationId, myEchoId, echoes, players],
  );

  const receipts = useMemo(
    () =>
      receiptRows
        .filter(row => row.runOwner.toHexString() === hex)
        .sort((a, b) => (a.id < b.id ? 1 : -1))
        .map(toReceipt),
    [receiptRows, hex],
  );

  const hostCard =
    hostIntentRow && hostShareId
      ? hostCardFrom(hostIntentRow, hostPlayerRow, Date.now())
      : undefined;

  // Only call the link dead once the intent table has actually arrived.
  const hostLinkExpired = Boolean(hostShareId) && intentsReady && !hostIntentRow;

  const focusedLine =
    transcript.find(line => line.id === lineId) ??
    [...transcript].reverse().find(line => line.mine);

  const openReview = (id: string) => {
    setConversationId(id);
    setLineId(null);
    setScreen('review');
  };

  return (
    <main className="phone">
      {screen === 'join' && (
        <JoinScreen
          actions={actions}
          go={go}
          connected={isActive && playersReady}
          hostCard={hostCard}
          hostLinkExpired={hostLinkExpired}
        />
      )}
      {screen === 'create' && (
        <CreateScreen actions={actions} go={go} hostCard={hostCard} />
      )}
      {screen === 'world' && (
        <WorldScreen
          actions={actions}
          go={go}
          onAdjustLimits={() => { setLimitsFrom('world'); setScreen('limits'); }}
          hostCard={hostCard}
          player={player}
          agents={agents}
          intent={myIntentRow?.text ?? ''}
          shareId={myIntentRow?.shareId ?? ''}
          mission={missions[0]?.text ?? ''}
          placeCount={places.length}
          toast={toast}
        />
      )}
      {screen === 'limits' && (
        <LimitsScreen actions={actions} go={go} run={runView} backTo={limitsFrom} />
      )}
      {screen === 'roaming' && (
        <RoamingScreen
          actions={actions}
          go={go}
          onAdjustLimits={() => { setLimitsFrom('roaming'); setScreen('limits'); }}
          run={runView}
          agents={agents}
        />
      )}
      {screen === 'return' && (
        <ReturnScreen
          actions={actions}
          go={go}
          run={runView}
          matches={matches}
          receipts={receipts}
          intent={myIntentRow?.text ?? ''}
          shareId={myIntentRow?.shareId ?? ''}
          onReview={openReview}
        />
      )}
      {screen === 'review' && (
        <ReviewScreen
          actions={actions}
          go={go}
          transcript={transcript}
          match={matches.find(m => m.conversationId === conversationId)}
          focusedId={focusedLine?.id ?? null}
          onFocus={setLineId}
        />
      )}
      {screen === 'correct' && (
        <CorrectScreen actions={actions} go={go} line={focusedLine} />
      )}
      {screen === 'done' && <DoneScreen actions={actions} go={go} />}
    </main>
  );
}

export default App;

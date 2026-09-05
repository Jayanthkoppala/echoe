import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { reducers, tables } from './module_bindings';
import './styles.css';

import { Toast } from './components/Toast';
import { ProfileScreen } from './screens/ProfileScreen';
import { CorrectScreen } from './screens/CorrectScreen';
import { CreateScreen } from './screens/CreateScreen';
import { DoneScreen } from './screens/DoneScreen';
import { JoinScreen } from './screens/JoinScreen';
import { LimitsScreen } from './screens/LimitsScreen';
import { ReturnScreen } from './screens/ReturnScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { RoamingScreen } from './screens/RoamingScreen';
import { WorldScreen } from './screens/WorldScreen';

import { FREE_CONVERSATIONS, behaviourFrom } from './state/copy';
import { startOpenRouterLink, takeOpenRouterCode } from './state/openrouter';
import { logout } from './state/session';
import type { DbConnection } from './module_bindings';
import {
  agentsFrom,
  correctionsFor,
  historyFrom,
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
  const { identity, isActive, getConnection } = useSpacetimeDB();
  const [screen, setScreen] = useState<ScreenName>('join');
  const [toast, setToast] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lineId, setLineId] = useState<string | null>(null);
  const [hostShareId] = useState(hostShareIdFromUrl);
  // Limits is an edit of a live run now, so it returns to whoever opened it.
  const [limitsFrom, setLimitsFrom] = useState<ScreenName>('world');
  const [profileFrom, setProfileFrom] = useState<ScreenName>('world');

  const [players, playersReady] = useTable(tables.player);
  const [echoes] = useTable(tables.echo);
  const [intents, intentsReady] = useTable(tables.intent);
  const [runs] = useTable(tables.run);
  const [receiptRows] = useTable(tables.receipt);
  const [conversations] = useTable(tables.conversation);
  const [lines] = useTable(tables.transcriptLine);
  const [travels] = useTable(tables.agentTravel);
  const [missions] = useTable(tables.mission);
  const [companies] = useTable(tables.company);
  const [correctionRows] = useTable(tables.correction);
  const [linkedAccounts] = useTable(tables.linkedAccount);

  const join = useReducer(reducers.join);
  const unverify = useReducer(reducers.unverify);
  const unlinkGoogle = useReducer(reducers.unlinkGoogle);
  const createEcho = useReducer(reducers.createEcho);
  const travel = useReducer(reducers.travel);
  const startRun = useReducer(reducers.startRun);
  const pauseRun = useReducer(reducers.pauseRun);
  const resumeRun = useReducer(reducers.resumeRun);
  const endRun = useReducer(reducers.endRun);
  const rateLine = useReducer(reducers.rateLine);
  const correct = useReducer(reducers.correct);
  const unlinkOpenRouter = useReducer(reducers.unlinkOpenRouter);

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

  // Back from openrouter.ai/auth: hand the one-time code to the module, which
  // does the exchange and stores the key server-side. Runs once per page load.
  const linkAttempted = useRef(false);
  useEffect(() => {
    if (!isActive || linkAttempted.current) return;
    const conn = getConnection() as DbConnection | undefined;
    if (!conn) return;
    const pkce = takeOpenRouterCode();
    if (!pkce) return;
    linkAttempted.current = true;
    run('Connect OpenRouter', conn.procedures.linkOpenRouter(pkce), () => setScreen('limits'));
  }, [isActive, getConnection, run]);

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
      onJoin(name, email) {
        run('Join', join({ name, email }), () => setScreen('create'));
      },
      onRestart() {
        // Same line, same host if the player came in through a link. The run
        // row is upserted server-side, so this works after a run has ended.
        const intent = myIntentRow?.text ?? '';
        run(
          'Send out again',
          startRun({ goal: hostName ? `Meet ${hostName}` : intent, hostShareId }),
          () => setScreen('roaming'),
        );
      },
      onCreateEcho(avatar, persona, intent) {
        // Decision 2: no Limits stop on the first run. The run starts here with
        // the defaults so World opens with the Echoe already walking.
        run(
          'Create Echoe',
          createEcho({ avatar, persona, intent }).then(() =>
            startRun({
              goal: hostName ? `Meet ${hostName}` : intent,
              hostShareId,
            }),
          ),
          () => setScreen('world'),
        );
      },
      onTravel(placeId) {
        run('Travel', travel({ placeId: placeIndexOf(placeId) }));
      },
      onStartRun(limits) {
        run(
          'Start run',
          startRun({
            goal: limits.goal,
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
      onLinkOpenRouter() {
        void startOpenRouterLink();
      },
      onUnlinkOpenRouter() {
        run('Disconnect OpenRouter', unlinkOpenRouter());
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
    [run, hostShareId, hostName, limitsFrom, myRunRow?.status, myIntentRow?.text],
  );

  const onlineCount = useMemo(() => players.filter(row => row.online).length, [players]);
  const openProfile = (from: ScreenName) => { setProfileFrom(from); setScreen('profile'); };

  const go = setScreen;
  const player = myPlayerRow ? toPlayer(myPlayerRow, companies) : undefined;
  const runView = myRunRow ? toRun(myRunRow) : undefined;
  const myEchoId = myEchoRow?.id;
  const freeLeft = Math.max(0, FREE_CONVERSATIONS - (myEchoRow?.freeUsed ?? 0));
  const hostEchoId = hostIntentRow?.echoId;

  const agents = useMemo(
    () => agentsFrom(travels, echoes, players, myEchoId, hostEchoId),
    [travels, echoes, players, myEchoId, hostEchoId],
  );

  const matches = useMemo(
    () => rankedMatches(conversations, myEchoId, hostEchoId, echoes, players, companies),
    [conversations, myEchoId, hostEchoId, echoes, players, companies],
  );

  const transcript = useMemo(
    () => (conversationId ? toTranscript(lines, conversationId, myEchoId, echoes, players, companies) : []),
    [lines, conversationId, myEchoId, echoes, players, companies],
  );

  const receipts = useMemo(
    () =>
      receiptRows
        .filter(row => row.runOwner.toHexString() === hex)
        .sort((a, b) => (a.id < b.id ? 1 : -1))
        .map(toReceipt),
    [receiptRows, hex],
  );

  const corrections = useMemo(() => correctionsFor(correctionRows, hex), [correctionRows, hex]);
  const history = useMemo(() => historyFrom(receipts), [receipts]);
  const myGoogle = linkedAccounts.find(
    row => row.identity.toHexString() === hex && row.provider === 'google',
  );

  const hostCard =
    hostIntentRow && hostShareId
      ? hostCardFrom(hostIntentRow, hostPlayerRow, Date.now(), companies)
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
      <Toast message={toast} />
      <div className="aurora" aria-hidden="true"><i /></div>
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
          run={runView}
          agents={agents}
          intent={myIntentRow?.text ?? ''}
          shareId={myIntentRow?.shareId ?? ''}
          mission={missions[0]?.text ?? ''}
          onlineCount={onlineCount}
          onProfile={() => openProfile('world')}
        />
      )}
      {screen === 'limits' && (
        <LimitsScreen
          actions={actions}
          go={go}
          run={runView}
          backTo={limitsFrom}
          freeLeft={freeLeft}
          linked={player?.openrouterLinked ?? false}
        />
      )}
      {screen === 'roaming' && (
        <RoamingScreen
          actions={actions}
          go={go}
          onAdjustLimits={() => { setLimitsFrom('roaming'); setScreen('limits'); }}
          onProfile={() => openProfile('roaming')}
          onlineCount={onlineCount}
          player={player}
          run={runView}
          agents={agents}
        />
      )}
      {screen === 'return' && (
        <ReturnScreen
          actions={actions}
          go={go}
          run={runView}
          freeLeft={freeLeft}
          matches={matches}
          receipts={receipts}
          intent={myIntentRow?.text ?? ''}
          shareId={myIntentRow?.shareId ?? ''}
          badge={player?.badge}
          player={player}
          onProfile={() => openProfile('return')}
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
          player={player}
          onProfile={() => openProfile('review')}
          onFocus={setLineId}
        />
      )}
      {screen === 'correct' && (
        <CorrectScreen actions={actions} go={go} line={focusedLine} />
      )}
      {screen === 'profile' && (
        <ProfileScreen
          actions={actions}
          go={go}
          backTo={profileFrom}
          player={player}
          intent={myIntentRow?.text ?? ''}
          persona={myEchoRow?.persona ?? ''}
          behaviourNotes={myEchoRow?.behaviourNotes ?? ''}
          corrections={corrections}
          history={history}
          people={matches}
          onRename={name => run('Rename', join({ name, email: '' }))}
          google={myGoogle}
          onUnverify={() => run('Unverify', unverify())}
          onUnlinkGoogle={() => run('Unlink', unlinkGoogle())}
          onReview={openReview}
          onLogout={logout}
        />
      )}
      {screen === 'done' && <DoneScreen actions={actions} go={go} />}
    </main>
  );
}

export default App;

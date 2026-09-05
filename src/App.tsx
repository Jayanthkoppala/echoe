import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { reducers, tables } from './module_bindings';
import './styles.css';

import { Toast } from './components/Toast';
import { landmarkById } from './data/landmarks';
import { ConnectScreen } from './screens/ConnectScreen';
import { EventsScreen } from './screens/EventsScreen';
import { JoinEventScreen } from './screens/JoinEventScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { CorrectScreen } from './screens/CorrectScreen';
import { CreateScreen } from './screens/CreateScreen';
import { DoneScreen } from './screens/DoneScreen';
import { JoinScreen } from './screens/JoinScreen';
import { LimitsScreen } from './screens/LimitsScreen';
import { ReturnScreen } from './screens/ReturnScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { TalksScreen } from './screens/TalksScreen';
import { RoamingScreen } from './screens/RoamingScreen';
import { WorldScreen } from './screens/WorldScreen';

import { FREE_CONVERSATIONS, behaviourFrom, FEATURED_EVENT } from './state/copy';
import { startOpenRouterLink, takeOpenRouterCode } from './state/openrouter';
import { logout } from './state/session';
import type { DbConnection } from './module_bindings';
import {
  agentMemoryFrom,
  agentsFrom,
  correctionsFor,
  historyFrom,
  hostCardFrom,
  matchByConversation,
  placeIndexOf,
  rankedMatches,
  toPlayer,
  toReceipt,
  toRun,
  toSummary,
  toTranscript,
  eventsFrom,
  withMatch,
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
  const [connectFrom, setConnectFrom] = useState<ScreenName>('profile');
  const [reviewFrom, setReviewFrom] = useState<ScreenName>('return');
  // The event being joined, and where the Join page came from.
  const [joinTarget, setJoinTarget] = useState<{ id: string; title: string; from: ScreenName } | null>(null);
  // reveal_secret is a private table, so the Start page cannot read back what it
  // last sent. Keep it here for this session only, to pre-fill the field.
  const [reveal, setRevealText] = useState('');

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
  const [eventJoins] = useTable(tables.eventJoin);
  const [reveals] = useTable(tables.reveal);
  const [summaryRows] = useTable(tables.conversationSummary);
  const [agentMemoryRows] = useTable(tables.agentMemory);
  const [eventBuildRows] = useTable(tables.eventBuild);

  const join = useReducer(reducers.join);
  const unverify = useReducer(reducers.unverify);
  const unlinkGoogle = useReducer(reducers.unlinkGoogle);
  const createEcho = useReducer(reducers.createEcho);
  const joinEvent = useReducer(reducers.joinEvent);
  const leaveEvent = useReducer(reducers.leaveEvent);
  const travel = useReducer(reducers.travel);
  const startRun = useReducer(reducers.startRun);
  const pauseRun = useReducer(reducers.pauseRun);
  const resumeRun = useReducer(reducers.resumeRun);
  const endRun = useReducer(reducers.endRun);
  const rateLine = useReducer(reducers.rateLine);
  const correct = useReducer(reducers.correct);
  const unlinkOpenRouter = useReducer(reducers.unlinkOpenRouter);
  const setAgentLink = useReducer(reducers.setAgentLink);
  const revealTo = useReducer(reducers.revealTo);
  const setReveal = useReducer(reducers.setReveal);

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
  // themselves twice. And an Echoe that appears while the player sits on Create
  // or Connect was just written by their coding agent: move them on to the map.
  // Editing an existing persona on Create stays put, since the row was already there.
  const hadEcho = useRef(Boolean(myEchoRow));
  useEffect(() => {
    const has = Boolean(myEchoRow);
    // Connect stays put on purpose: it shows the stages landing one by one.
    const agentWroteIt = has && !hadEcho.current && screen === 'create';
    if ((screen === 'join' && has) || agentWroteIt) setScreen('world');
    hadEcho.current = has;
  }, [screen, myEchoRow]);

  // The module ends a run on its own when the clock or the budget runs out.
  // Whether the player is on the status page or still watching the map, the
  // moment their live run ends they land on Return.
  const prevRunStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const status = myRunRow?.status;
    const wasLive = prevRunStatus.current === 'running' || prevRunStatus.current === 'paused';
    if (status === 'ended' && (screen === 'roaming' || (screen === 'world' && wasLive))) {
      setScreen('return');
    }
    prevRunStatus.current = status;
  }, [screen, myRunRow?.status]);

  const actions: Actions = useMemo(
    () => ({
      onJoin(name, email) {
        run('Join', join({ name, email }), () => setScreen('create'));
      },
      onHostEvent(name) {
        // Hosting is a line plus the link that already exists: everyone who opens
        // it sends their Echoe to meet the host's. The share id survives re-creation.
        run('Host event', startRun({ goal: `Hosting ${name}`, avoid: myRunRow?.avoid ?? '', hostShareId }));
      },
      onJoinEvent(eventId, goal, linkedin, twitter, building) {
        run('Join event', joinEvent({ eventId, goal, linkedin, twitter, building }));
      },
      onLeaveEvent(eventId) {
        run('Leave event', leaveEvent({ eventId }));
      },
      onRestart() {
        // Same line, same host if the player came in through a link. The run
        // row is upserted server-side, so this works after a run has ended.
        const intent = myIntentRow?.text ?? '';
        run(
          'Send out again',
          startRun({ goal: hostName ? `Meet ${hostName}` : intent, avoid: myRunRow?.avoid ?? '', hostShareId }),
          () => setScreen('roaming'),
        );
      },
      onCreateEcho(persona) {
        // The Echoe exists but is not walking yet. Events comes first (Jay,
        // 2026-09-06): see what is on tonight, then Enter Bengaluru lands on
        // World with the Start button.
        run('Create Echoe', createEcho({ persona }), () => { setProfileFrom('world'); setScreen('events'); });
      },
      onTravel(placeId) {
        // Every "Send my Echoe" button routes here; the module refuses a walk to the current spot.
        if (placeIndexOf(placeId) === myPlayerRow?.currentPlace) {
          setToast(`Your Echoe is already at ${landmarkById(placeId)?.name ?? 'that spot'}`);
          return;
        }
        run('Travel', travel({ placeId: placeIndexOf(placeId) }));
      },
      onStartRun(limits) {
        setRevealText(limits.reveal);
        // The secret goes in first: a run can start meeting people the moment
        // startRun lands, and the reveal must already be there when it does.
        const started = setReveal({ text: limits.reveal }).then(() =>
          startRun({
            goal: limits.goal,
            avoid: limits.avoid,
            hostShareId: limits.hostShareId ?? hostShareId,
          }),
        );
        run('Start run', started, () => setScreen(limitsFrom));
      },
      onPause() {
        run('Pause', pauseRun());
      },
      onResume() {
        run('Resume', resumeRun());
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
      onSetAgentLink(token) {
        run('Connect agent', setAgentLink({ token }));
      },
      onReveal(id) {
        run('Reveal', revealTo({ conversationId: BigInt(id) }));
      },
    }),
    // The reducer handles are stable; myRunRow.status decides pause versus resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, hostShareId, hostName, limitsFrom, myRunRow?.status, myIntentRow?.text, myPlayerRow?.currentPlace],
  );

  const onlineCount = useMemo(() => players.filter(row => row.online).length, [players]);
  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of eventJoins) counts[row.eventId] = (counts[row.eventId] ?? 0) + 1;
    return counts;
  }, [eventJoins]);
  const myEvents = useMemo(
    () => new Set(eventJoins.filter(row => row.identity.toHexString() === hex).map(row => row.eventId)),
    [eventJoins, hex],
  );
  const openProfile = (from: ScreenName) => { setProfileFrom(from); setScreen('profile'); };
  const openConnect = (from: ScreenName) => { setConnectFrom(from); setScreen('connect'); };
  const openJoinEvent = (id: string, title: string, from: ScreenName) => {
    setJoinTarget({ id, title, from });
    setScreen('joinEvent');
  };

  const go = setScreen;
  const player = myPlayerRow ? toPlayer(myPlayerRow, companies) : undefined;
  const runView = myRunRow ? toRun(myRunRow) : undefined;
  const myEchoId = myEchoRow?.id;
  const freeLeft = Math.max(0, FREE_CONVERSATIONS - (myEchoRow?.freeUsed ?? 0));
  const hostEchoId = hostIntentRow?.echoId;

  const agents = useMemo(
    () => agentsFrom(travels, echoes, players, runs, myEchoId, hostEchoId),
    [travels, echoes, players, runs, myEchoId, hostEchoId],
  );

  // One conversation_summary row per side; only mine is ever rendered.
  const mySummaries = useMemo(
    () => summaryRows.filter(row => row.identity.toHexString() === hex),
    [summaryRows, hex],
  );
  const summaryMatch = useMemo(() => matchByConversation(mySummaries), [mySummaries]);
  const mySummaryRow = mySummaries.find(row => String(row.conversationId) === conversationId);
  const summary = mySummaryRow ? toSummary(mySummaryRow) : undefined;

  const matches = useMemo(
    () =>
      withMatch(rankedMatches(
        conversations,
        myEchoId,
        hostEchoId,
        echoes,
        players,
        companies,
        myPlayerRow?.currentPlace ?? 0,
        myRunRow?.startedAt,
      ), summaryMatch),
    [conversations, myEchoId, hostEchoId, echoes, players, companies, myPlayerRow?.currentPlace, myRunRow?.startedAt, summaryMatch],
  );

  const joinedEvents = useMemo(
    // eventJoins can be undefined for a beat while a republish swaps tables; never let that crash the tree.
    () =>
      eventsFrom(eventJoins ?? [], conversations ?? [], echoes, players, myEchoId, hex, companies, myPlayerRow?.currentPlace ?? 0)
        .map(event => ({ ...event, people: withMatch(event.people, summaryMatch) })),
    [eventJoins, conversations, echoes, players, myEchoId, hex, companies, myPlayerRow?.currentPlace, summaryMatch],
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
  const agentNotes = useMemo(
    () => agentMemoryFrom(agentMemoryRows, myEchoId),
    [agentMemoryRows, myEchoId],
  );
  // eventId -> my agent-written text, so JoinEventScreen can prefill it.
  const myEventBuildByEvent = useMemo(
    () =>
      new Map(
        eventBuildRows.filter(row => row.identity.toHexString() === hex).map(row => [row.eventId, row.text]),
      ),
    [eventBuildRows, hex],
  );
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

  const openReview = (id: string, from: ScreenName = 'return') => {
    setReviewFrom(from);
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
        <CreateScreen
          actions={actions}
          go={go}
          hostCard={hostCard}
          onConnect={() => openConnect('create')}
        />
      )}
      {screen === 'world' && (
        <WorldScreen
          actions={actions}
          go={go}
          onAdjustLimits={() => { setLimitsFrom('world'); setScreen('limits'); }}
          onJoinEvent={openJoinEvent}
          onTalks={() => setScreen('talks')}
          hostCard={hostCard}
          player={player}
          run={runView}
          agents={agents}
          intent={myIntentRow?.text ?? ''}
          shareId={myIntentRow?.shareId ?? ''}
          mission={missions[0]?.text ?? ''}
          onlineCount={onlineCount}
          eventCounts={eventCounts}
          myEvents={myEvents}
          onProfile={() => openProfile('world')}
        />
      )}
      {screen === 'limits' && (
        <LimitsScreen
          actions={actions}
          go={go}
          run={runView}
          backTo={limitsFrom}
          reveal={reveal}
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
          match={
            matches.find(m => m.conversationId === conversationId) ??
            joinedEvents.flatMap(e => e.people).find(m => m.conversationId === conversationId)
          }
          focusedId={focusedLine?.id ?? null}
          player={player}
          onProfile={() => openProfile('review')}
          onFocus={setLineId}
          backTo={reviewFrom}
          conversationId={conversationId}
          revealCount={reveals.filter(r => String(r.conversationId) === conversationId).length}
          open={
            conversations.find(c => String(c.id) === conversationId)?.closedAt
              .microsSinceUnixEpoch === 0n
          }
          hasSummary={Boolean(mySummaryRow)}
        />
      )}
      {screen === 'summary' && (
        <SummaryScreen
          actions={actions}
          go={go}
          summary={summary}
          match={
            matches.find(m => m.conversationId === conversationId) ??
            joinedEvents.flatMap(e => e.people).find(m => m.conversationId === conversationId)
          }
          player={player}
          onProfile={() => openProfile('summary')}
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
          agentNotes={agentNotes}
          history={history}
          people={matches}
          onRename={name => run('Rename', join({ name, email: '' }))}
          google={myGoogle}
          onUnverify={() => run('Unverify', unverify())}
          onUnlinkGoogle={() => run('Unlink', unlinkGoogle())}
          onReview={openReview}
          onLogout={logout}
          shareId={myIntentRow?.shareId ?? ''}
          onHostEvent={actions.onHostEvent}
          onConnect={() => openConnect('profile')}
        />
      )}
      {screen === 'connect' && (
        <ConnectScreen
          actions={actions}
          go={go}
          agentNotes={agentNotes}
          onToast={setToast}
          backTo={connectFrom}
          stages={{
            persona: Boolean(myEchoRow?.persona),
            building: myEventBuildByEvent.has(FEATURED_EVENT.id),
            memory: agentNotes.length > 0,
            joined: myEvents.has(FEATURED_EVENT.id),
          }}
          hasEcho={Boolean(myEchoRow)}
          onJoinEvent={() => openJoinEvent(FEATURED_EVENT.id, FEATURED_EVENT.title, 'connect')}
        />
      )}
      {screen === 'talks' && (
        <TalksScreen
          actions={actions}
          go={go}
          people={matches}
          events={joinedEvents}
          player={player}
          onProfile={() => openProfile('talks')}
          onReview={id => openReview(id, 'talks')}
        />
      )}
      {screen === 'joinEvent' && joinTarget && (
        <JoinEventScreen
          actions={actions}
          go={go}
          eventId={joinTarget.id}
          eventTitle={joinTarget.title}
          backTo={joinTarget.from}
          initialBuilding={myEventBuildByEvent.get(joinTarget.id)}
        />
      )}
      {screen === 'events' && (
        <EventsScreen
          actions={actions}
          go={go}
          backTo={profileFrom}
          onJoinEvent={openJoinEvent}
          eventCounts={eventCounts}
          myEvents={myEvents}
        />
      )}
      {screen === 'done' && <DoneScreen actions={actions} go={go} />}
    </main>
  );
}

export default App;

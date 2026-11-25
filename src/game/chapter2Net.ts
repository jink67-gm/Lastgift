// 2장 두 기기 이상: 방장이 운반 규칙(core/sewing)과 팀 시계(core/run)를 혼자 계산하고,
// 참가자는 입력만 보내며 방장이 보낸 스냅샷을 그린다(명세서 §6 방장 시뮬레이션, §8).
// 시그널링(처음 소개)은 Firebase, 게임 데이터는 WebRTC 데이터 채널로 기기끼리 직접.
import { remainingAt } from '../core/run';
import { createSewing, playerLeft, playerRejoined, step, type SewingEvent, type SewingInput, type SewingState } from '../core/sewing';
import { ELF_LOOKS } from '../data/elves';
import { attachKeyboard, KeyState } from '../input/keyboard';
import { mergeIntents } from '../input/merge';
import { DEFAULT_ICE, PeerLink } from '../net/peer';
import {
  assignSlot,
  checkMission,
  elfNickname,
  parseGuestMsg,
  parseHostMsg,
  type RunView,
  type Slot,
  type SnapMsg,
  type TeamEntry,
} from '../net/protocol';
import { FirebaseSignaling, isRoomCode, RoomError } from '../net/signaling';
import { browserStorage, CheckpointStore } from '../save/store';
import { LocalRun, RESUME_DELAY_MS } from '../session/localRun';
import { sewingIcon } from '../ui/actionIcons';
import { createControls } from '../ui/controls';
import { createHud, type Hud } from '../ui/hud';
import { createLobby } from '../ui/lobby';
import { chapter2Checkpoint, toSewingInput } from './chapter2';
import { createChapter2Screen } from './chapter2Screen';
import type { Models } from '../scene/models';

const SIM_DT = 1 / 60;
const SNAP_MS = 66; // 약 15Hz
const INPUT_MS = 33; // 약 30Hz
const INPUT_STALE_MS = 500; // 이보다 오래 소식이 없으면 그 참가자는 멈춘 것으로 본다
/** 이보다 오래 아무 소식이 없으면 나간 것으로 본다(창이 갑자기 닫히면 WebRTC 끊김 신호가 수십 초 늦을 수 있다) */
const GUEST_GONE_MS = 2500;
const HOST_LOST_MS = 3000;
const REJOIN_EVERY_MS = 4000;
const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
}

const hatOf = (slot: string) => ELF_LOOKS[Number(slot.slice(1))]!.hat;
const isTest = () => import.meta.env.DEV || new URLSearchParams(location.search).has('test');

function setTeamHud(hud: Hud, team: TeamEntry[]): void {
  hud.setTeam(team.map((m) => ({ color: hatOf(m.slot), connected: m.connected })));
}

function inviteLink(code: string, emu: boolean): string {
  const u = new URL(location.href);
  u.search = `?chapter=2&join=${code}${emu ? '&emu' : ''}`;
  u.hash = '';
  return u.toString();
}

// ── 방장 ────────────────────────────────────────────────

interface SavedHostRoom {
  code: string;
  seats: [string, Slot][];
}

export async function startHost(emu: boolean, models: Models): Promise<void> {
  const host = document.getElementById('game')!;
  const screen = createChapter2Screen(host, models);
  const lobby = createLobby(document);
  const hud = createHud(document);
  const controls = createControls(document);
  const keys = new KeyState();
  attachKeyboard(window, keys);
  const kv = browserStorage();
  const roomKey = `lastgift.hostRoom.v1${emu ? '.emu' : ''}`;

  lobby.showMessage('방을 만드는 중…');
  let sig: FirebaseSignaling;
  try {
    sig = await FirebaseSignaling.connect(emu);
  } catch (e) {
    const notSet = e instanceof RoomError && e.code === 'notConfigured';
    lobby.showMessage(notSet ? '여러 기기 연결 설정(Firebase)이 아직 없어요.' : '연결하지 못했어요. 인터넷 연결을 확인해 주세요.', true);
    return;
  }

  // 같은 기기에서 다시 열면 예전 방과 자리를 이어 쓴다(방장 자동 승계는 없다)
  let saved: SavedHostRoom | null = null;
  try {
    saved = JSON.parse(kv?.getItem(roomKey) ?? 'null') as SavedHostRoom | null;
  } catch {
    saved = null;
  }
  let code: string;
  try {
    code = saved && (await sig.resumeRoom(saved.code)) ? saved.code : await sig.createRoom();
  } catch {
    lobby.showMessage('방을 만들지 못했어요. 잠시 뒤 다시 해 주세요.', true);
    return;
  }
  const seats = new Map<string, Slot>(saved?.code === code ? saved.seats : []);
  seats.set(sig.uid, 'p0');
  const saveRoom = () => {
    try {
      kv?.setItem(roomKey, JSON.stringify({ code, seats: [...seats] } satisfies SavedHostRoom));
    } catch {
      /* 저장 못 해도 방은 계속된다 */
    }
  };
  saveRoom();

  const names = new Map<string, string>([[sig.uid, elfNickname(sig.uid)]]);
  const links = new Map<string, PeerLink>();
  const lastHeard = new Map<string, number>();
  const open = new Set<Slot>(['p0']);
  const guestIn = new Map<Slot, { n: number; move: { x: number; y: number }; held: boolean; at: number }>();
  const pendingAct = new Map<Slot, number>();
  const seen = new Map<Slot, Set<string>>();
  const events: SewingEvent[] = [];
  /** 접속 기록(시험·점검용): 누가 언제 나가고 들어왔는지 */
  const netLog: { t: 'joined' | 'left'; slot: Slot }[] = [];
  const iceServers = emu ? [] : DEFAULT_ICE;
  const sid = newId().slice(0, 8);
  let linkSeq = 0;
  let started = false;
  let sewing: SewingState | null = null;

  const run = new LocalRun(new CheckpointStore(kv), hud, `net-${code}`, 'p0', chapter2Checkpoint(`net-${code}`));
  run.attachVisibility(document);
  run.onEffect((e) => {
    if (e.type === 'retry' && sewing) sewing = createSewing(sewing.players.map((p) => p.id));
  });

  const team = (): TeamEntry[] =>
    [...seats]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([uid, slot]) => ({ slot, name: names.get(uid) ?? '요정', connected: open.has(slot) }));

  /** 이 참가자의 연결이 끊겼다: 들고 있던 손잡이를 놓고(재봉틀은 그 자리) 자리를 비운다 */
  function dropLink(uid: string, link: PeerLink): void {
    if (links.get(uid) !== link) return;
    links.delete(uid);
    const slot = seats.get(uid);
    if (!slot || !open.has(slot)) return;
    open.delete(slot);
    guestIn.delete(slot);
    pendingAct.delete(slot);
    netLog.push({ t: 'left', slot });
    if (started && sewing) sewing = playerLeft(sewing, slot).state;
  }

  sig.onSignal((m) => {
    const l = links.get(m.from);
    if (l && l.link === m.link) void l.handle(m.kind, m.data).catch(() => l.close());
  });

  // 참가자가 들어오거나(처음) 다시 접속을 요청하면 새 연결을 연다. 같은 uid는 같은 자리로.
  sig.onMember((uid, info) => {
    if (uid === sig.uid) return;
    names.set(uid, typeof info?.name === 'string' ? info.name.slice(0, 12) : '요정');
    const old = links.get(uid);
    if (old) {
      dropLink(uid, old);
      old.close();
    }
    const id = `${sid}-${++linkSeq}`;
    const link = new PeerLink(id, (kind, data) => void sig.send(uid, kind, id, data).catch(() => {}), iceServers);
    links.set(uid, link);
    link.onOpen = () => {
      const slot = assignSlot(seats, uid, started);
      if (slot === 'full' || slot === 'started') {
        link.send('mission', { t: 'refuse', reason: slot });
        setTimeout(() => link.close(), 500);
        return;
      }
      seats.set(uid, slot);
      saveRoom();
      open.add(slot);
      lastHeard.set(uid, performance.now());
      netLog.push({ t: 'joined', slot });
      link.send('mission', { t: 'welcome', slot, runId: run.state.runId });
      if (started && sewing && sewing.players.some((p) => p.id === slot)) sewing = playerRejoined(sewing, slot);
    };
    link.onClose = () => dropLink(uid, link);
    link.onMessage = (ch, data) => {
      const slot = seats.get(uid);
      if (!slot || !open.has(slot) || links.get(uid) !== link) return; // 이 연결에 배정한 자리만 믿는다
      lastHeard.set(uid, performance.now());
      const m = parseGuestMsg(data);
      if (!m) return;
      if (m.t === 'in') {
        if (ch !== 'state') return;
        const prev = guestIn.get(slot);
        if (prev && m.n <= prev.n) return; // 늦게 도착한 옛 입력
        guestIn.set(slot, { n: m.n, move: { x: m.mx, y: m.my }, held: m.held, at: performance.now() });
        return;
      }
      if (ch !== 'mission') return;
      const ss = seen.get(slot) ?? new Set<string>();
      seen.set(slot, ss);
      const verdict = checkMission(m, { slot, runId: run.state.runId, epoch: run.state.epoch, seen: ss });
      if (verdict === 'ok' || verdict === 'staleEpoch') ss.add(m.eventId);
      if (verdict !== 'ok') return;
      if (m.t === 'act') pendingAct.set(slot, (pendingAct.get(slot) ?? 0) + 1);
      else run.dispatch({ type: 'retry', at: performance.now(), runId: m.runId, epoch: m.epoch, playerId: slot, eventId: m.eventId });
    };
    void link.offer().catch(() => link.close());
  });

  // 창을 닫으면 연결을 바로 끊어 참가자 화면이 곧 알게 한다
  window.addEventListener('pagehide', () => {
    for (const l of links.values()) l.close();
  });

  const link = inviteLink(code, emu);
  const startGame = () => {
    if (started || open.size < 2) return;
    started = true;
    sewing = createSewing([...open].sort());
    run.dispatch({ type: 'start', at: performance.now() });
    lobby.hide();
  };

  let snapN = 0;
  let lastSnap = 0;
  let currentTeam: TeamEntry[] = [];
  function sendSnap(now: number): void {
    lastSnap = now;
    const st = run.state;
    const view: RunView = {
      runId: st.runId,
      epoch: st.epoch,
      phase: st.phase,
      chapterId: st.chapterId,
      remaining: remainingAt(st, now),
      memories: st.memories,
      completedChapters: st.completedChapters,
      paused: st.pauseReasons.length > 0,
      hostAway: st.pauseReasons.includes('hostHidden'),
      resumeIn: st.resumeAt !== null ? Math.max(0, st.resumeAt - now) : null,
      started,
    };
    const msg: SnapMsg = { t: 'snap', n: ++snapN, sewing, run: view, team: currentTeam };
    for (const l of links.values()) l.send('state', msg);
  }
  // 방장 탭이 숨으면(브라우저가 화면 갱신을 멈춘다) 일시중지를 바로 알리고,
  // 돌아오면 그동안 못 들은 참가자 소식을 끊김으로 오해하지 않게 시계를 새로 잰다.
  document.addEventListener('visibilitychange', () => {
    const now = performance.now();
    if (document.visibilityState === 'hidden') sendSnap(now);
    else for (const uid of lastHeard.keys()) lastHeard.set(uid, now);
  });

  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    const frame = Math.min((now - last) / 1000, 0.25);
    last = now;
    acc += frame;
    run.frame(now);
    // 소식이 끊긴 참가자는 나간 것으로 본다(손잡이를 놓고, 혼자 남으면 일시중지)
    for (const [uid, l] of links) {
      const slot = seats.get(uid);
      if (slot && open.has(slot) && now - (lastHeard.get(uid) ?? now) > GUEST_GONE_MS) l.close();
    }
    const t = team();
    currentTeam = t;
    setTeamHud(hud, t);

    if (!started) {
      lobby.showHost({ code, link, team: t, canStart: open.size >= 2, onStart: startGame });
    } else {
      // 한 명만 남으면 팀 일시중지, 다시 둘 이상이 되면 같은 재개 시각을 알린다
      const alone = run.state.pauseReasons.includes('alone');
      if (open.size < 2 && !alone) run.dispatch({ type: 'pause', at: now, reason: 'alone' });
      if (open.size >= 2 && alone) run.dispatch({ type: 'resume', at: now, reason: 'alone', resumeAt: now + RESUME_DELAY_MS });
    }

    const live = started && run.canPlay && sewing !== null && !sewing.delivered;
    const local = mergeIntents(keys.sample(), controls.touch.sample());
    let inputs: Record<string, SewingInput> = {};
    if (sewing) {
      for (const p of sewing.players) {
        if (!live) {
          inputs[p.id] = idle;
          continue;
        }
        if (p.id === 'p0') {
          inputs[p.id] = toSewingInput(local);
          continue;
        }
        const gi = guestIn.get(p.id as Slot);
        const fresh = gi && now - gi.at < INPUT_STALE_MS;
        const acts = pendingAct.get(p.id as Slot) ?? 0;
        if (acts > 0) pendingAct.set(p.id as Slot, acts - 1);
        inputs[p.id] = { move: fresh ? gi.move : { x: 0, y: 0 }, actionDown: acts > 0, actionHeld: !!(fresh && gi.held) };
      }
    }
    while (acc >= SIM_DT) {
      if (sewing) {
        const r = step(sewing, inputs, SIM_DT);
        sewing = r.state;
        for (const e of r.events) {
          events.push(e);
          if (e.type === 'delivered') run.dispatch({ type: 'completeChapter', at: now, chapterId: 2 });
        }
      }
      inputs = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, actionDown: false }]));
      acc -= SIM_DT;
      elapsed += SIM_DT;
    }

    // 스냅샷 보내기
    if (now - lastSnap >= SNAP_MS) sendSnap(now);

    const shown = sewing ?? createSewing([...open].sort());
    const mine = screen.draw(shown, { frame, elapsed, previewFor: ['p0'], canPlay: live });
    controls.update(sewingIcon(mine.kind));
  });

  if (isTest()) {
    (window as unknown as Record<string, unknown>).__lastgift = {
      role: () => 'host',
      roomCode: () => code,
      uid: () => sig.uid,
      started: () => started,
      start: () => startGame(),
      slots: () => [...seats],
      openSlots: () => [...open].sort(),
      netLog: () => netLog.map((e) => ({ ...e })),
      sewing: () => (sewing ? (JSON.parse(JSON.stringify(sewing)) as SewingState) : null),
      sewingEvents: () => events.map((e) => ({ ...e })),
      run: () => ({ ...run.state, remaining: remainingAt(run.state, performance.now()) }),
      runEffects: () => run.log.map((e) => e.type),
      savedCheckpoint: () => kv?.getItem(`lastgift.cp.v1.net-${code}`) ?? null,
      toScreen: (x: number, z: number) => screen.toScreen(x, z),
    };
  }
}

// ── 참가자 ──────────────────────────────────────────────

export async function startGuest(code: string, emu: boolean, models: Models): Promise<void> {
  const host = document.getElementById('game')!;
  const screen = createChapter2Screen(host, models);
  const lobby = createLobby(document);
  const hud = createHud(document);
  const controls = createControls(document);
  const keys = new KeyState();
  attachKeyboard(window, keys);

  if (!isRoomCode(code)) {
    lobby.showMessage('방 코드를 다시 확인해 주세요.', true);
    return;
  }
  lobby.showGuest({ name: '', team: [], message: '연결하는 중…' });
  let sig: FirebaseSignaling;
  try {
    sig = await FirebaseSignaling.connect(emu);
  } catch (e) {
    const notSet = e instanceof RoomError && e.code === 'notConfigured';
    lobby.showGuest({ name: '', team: [], message: notSet ? '여러 기기 연결 설정(Firebase)이 아직 없어요.' : '연결하지 못했어요. 인터넷 연결을 확인해 주세요.', error: true });
    return;
  }
  const name = elfNickname(sig.uid);
  const iceServers = emu ? [] : DEFAULT_ICE;

  let hostUid = '';
  let link: PeerLink | null = null;
  let mySlot: Slot | null = null;
  let snap: SnapMsg | null = null;
  let snapAt = 0;
  let lastN = -1;
  let refused: string | null = null;
  let fatal: string | null = null;
  let lastJoin = 0;
  let inN = 0;
  let lastInput = 0;

  const join = async () => {
    lastJoin = performance.now();
    try {
      hostUid = await sig.joinRoom(code, name);
    } catch (e) {
      if (e instanceof RoomError && (e.code === 'notFound' || e.code === 'expired')) fatal = e.code === 'notFound' ? '방을 찾을 수 없어요. 코드를 확인해 주세요.' : '끝난 방이에요.';
    }
  };

  const makeLink = (id: string): PeerLink => {
    const l = new PeerLink(id, (kind, data) => void sig.send(hostUid, kind, id, data).catch(() => {}), iceServers);
    lastN = -1; // 방장이 새로 열었으면 스냅샷 번호도 처음부터
    l.onMessage = (_ch, data) => {
      const m = parseHostMsg(data);
      if (!m) return;
      if (m.t === 'welcome') mySlot = m.slot;
      else if (m.t === 'refuse') refused = m.reason === 'full' ? '방이 가득 찼어요.' : '이미 시작한 방이에요.';
      else if (m.t === 'snap' && m.n > lastN) {
        lastN = m.n;
        snap = m;
        snapAt = performance.now();
      }
    };
    l.onClose = () => {
      if (link === l) link = null;
    };
    return l;
  };

  // 방에 먼저 들어가야(방 경로가 정해져야) 받은 편지함을 구독할 수 있다
  await join();
  if (!fatal) {
    sig.onSignal((m) => {
      if (m.from !== hostUid) return;
      if (m.kind === 'offer' && link?.link !== m.link) {
        link?.close();
        link = makeLink(m.link);
      }
      const l = link;
      if (l && l.link === m.link) void l.handle(m.kind, m.data).catch(() => l.close());
    });
  }

  // 창을 닫으면 연결을 바로 끊어 방장이 곧 알게 한다
  window.addEventListener('pagehide', () => link?.close());

  const meta = () => ({ runId: snap!.run.runId, epoch: snap!.run.epoch, playerId: mySlot!, eventId: newId() });
  hud.onRetry(() => {
    if (link?.isOpen && snap && mySlot) link.send('mission', { t: 'retry', ...meta() });
  });

  let last = performance.now();
  let elapsed = 0;
  let lobbyKey = '';
  const showLobby = (message: string, error = false) => {
    const t = snap?.team ?? [];
    const key = `${message}|${t.map((m) => `${m.slot}${m.connected}`).join()}`;
    if (key === lobbyKey) return;
    lobbyKey = key;
    lobby.showGuest({ name, team: t, message, error });
  };

  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    const frame = Math.min((now - last) / 1000, 0.25);
    last = now;
    elapsed += frame;
    const intent = mergeIntents(keys.sample(), controls.touch.sample());
    const connected = !!link?.isOpen && (now - snapAt < HOST_LOST_MS || !!snap?.run.hostAway);

    // 방장과 끊겼으면 다시 접속을 요청한다(방장 기기가 같은 방을 다시 열면 이어진다)
    if (!fatal && !refused && !connected && now - lastJoin > REJOIN_EVERY_MS) {
      if (link && now - snapAt >= HOST_LOST_MS && snapAt > 0) link.close();
      void join();
    }

    if (link?.isOpen && mySlot && snap) {
      if (now - lastInput >= INPUT_MS) {
        lastInput = now;
        link.send('state', { t: 'in', n: ++inN, mx: intent.move.x, my: intent.move.y, held: intent.action.held });
      }
      if (intent.action.down) link.send('mission', { t: 'act', ...meta() });
    }

    if (fatal) showLobby(fatal, true);
    else if (refused) showLobby(refused, true);
    else if (!snap || !snap.run.started) showLobby(connected ? '방장이 시작하기를 기다리는 중' : '연결하는 중…');
    else if (!connected) showLobby('방장과 연결이 끊겼어요. 다시 연결하는 중…', true);
    else if (lobbyKey) {
      lobby.hide();
      lobbyKey = '';
    }

    if (snap) {
      const r = snap.run;
      setTeamHud(hud, snap.team);
      const running = r.phase === 'play' && !r.paused && r.resumeIn === null;
      hud.setTime(running ? Math.max(0, r.remaining - (now - snapAt)) : r.remaining);
      if (r.phase === 'timeout') hud.setOverlay({ kind: 'timeout' });
      else if (r.paused) hud.setOverlay({ kind: 'paused' });
      else if (r.resumeIn !== null) hud.setOverlay({ kind: 'countdown', secondsLeft: Math.max(1, Math.ceil((r.resumeIn - (now - snapAt)) / 1000)) });
      else hud.setOverlay({ kind: 'none' });
    }
    const s = snap?.sewing ?? createSewing(['p0']);
    const canPlay = connected && !!snap && snap.run.phase === 'play' && !snap.run.paused && snap.run.resumeIn === null;
    const mine = screen.draw(s, { frame, elapsed, previewFor: mySlot ? [mySlot] : [], canPlay, smooth: true });
    controls.update(sewingIcon(mine.kind));
  });

  if (isTest()) {
    (window as unknown as Record<string, unknown>).__lastgift = {
      role: () => 'guest',
      uid: () => sig.uid,
      slot: () => mySlot,
      connected: () => !!link?.isOpen && (performance.now() - snapAt < HOST_LOST_MS || !!snap?.run.hostAway),
      snap: () => (snap ? (JSON.parse(JSON.stringify(snap)) as SnapMsg) : null),
      sewing: () => (snap?.sewing ? JSON.parse(JSON.stringify(snap.sewing)) : null),
      toScreen: (x: number, z: number) => screen.toScreen(x, z),
      /** 시험용: 미션 이벤트를 그대로 보낸다(재전송·사칭 시험) */
      sendMission: (msg: unknown) => link?.send('mission', msg),
      meta: () => (snap && mySlot ? meta() : null),
    };
  }
}

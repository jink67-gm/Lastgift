// 여러 기기 공통 층(0~6장 모두): 방 만들기·참가·재접속·자리·입력 모으기·스냅샷·사건 전달.
//
//   방장  : 장 규칙과 팀 시계를 혼자 계산한다. 참가자 입력(state 채널)과 행동·다시 하기(mission 채널)를 받아
//           자기 입력과 함께 그 장의 step에 넣고, 장 상태 + 팀 시도 상태를 15Hz로, 장 사건은 신뢰 채널로 보낸다.
//   참가자: 입력만 보내고, 받은 장 상태를 같은 장 화면 코드로 그린다. 장 사건으로 소리·연출을 시작한다.
//
// 장이 바뀌면 방장 페이지가 다시 읽힌다(이야기 모드). 방 코드·자리·시작 여부는 방장 기기에 저장돼 있어
// 다시 열면 같은 방을 이어 쓰고, 참가자는 끊김을 알아채 다시 접속을 요청한 뒤 새 장으로 페이지를 다시 연다.
// 처음 소개(시그널링)는 Firebase, 게임 데이터는 WebRTC로 기기끼리 직접(net/peer, net/signaling).
import { remainingAt, type ClientMeta, type RunState } from '../core/run';
import type { SewingInput } from '../core/sewing';
import { ELF_LOOKS } from '../data/elves';
import { IDLE_INTENT, type Intent } from '../input/intent';
import { browserStorage, loadSettings } from '../save/store';
import { attachSfx, playSfx, setSfxMuted } from '../audio/sfx';
import { MirrorRun, type MirrorLink, type TeamRun } from '../session/mirrorRun';
import { RESUME_DELAY_MS, type LocalRun } from '../session/localRun';
import type { Hud } from '../ui/hud';
import { createLobby, type Lobby } from '../ui/lobby';
import { DEFAULT_ICE, PeerLink } from './peer';
import {
  assignSlot,
  checkMission,
  elfNickname,
  parseGuestMsg,
  parseHostMsg,
  type EventsMsg,
  type RunView,
  type Slot,
  type TeamEntry,
  type TeamSnapMsg,
} from './protocol';
import { FirebaseSignaling, isRoomCode, RoomError } from './signaling';

const SNAP_MS = 66; // 약 15Hz
const INPUT_MS = 33; // 약 30Hz
/** 방장: 참가자 입력을 이보다 오래 못 들으면 멈춘 것으로(느린 기기도 고려, 바뀐 입력은 신뢰 채널로도 온다) */
const INPUT_STALE_MS = 1500;
/** 이보다 오래 아무 소식이 없으면 나간 것으로 본다(창이 갑자기 닫히면 WebRTC 끊김 신호가 늦다) */
const GUEST_GONE_MS = 2500;
/** 들어온 직후·장을 연 직후: 참가자 기기가 장 장면을 만드느라 몇 초 멈춰도 끊긴 것으로 보지 않는다 */
const GUEST_LOADING_MS = 30000; // 느린 학교 기기(CPU 2배 느림)는 3장 장면을 만드는 데 15초를 넘겼다
const HOST_LOST_MS = 3000;
/** 이보다 긴 화면 하나 = 이 기기가 멈췄다 돌아왔다(장 장면 만들기·탭 전환). 1초로 두면 초당 1화면 기기는 늘 '멈춤'이라 끊김을 영영 못 알아챘다 */
const LONG_FRAME_MS = 2500;
const REJOIN_EVERY_MS = 4000;
/** 연결을 맺는 데 이만큼까지는 기다린다(소프트웨어로 그리는 기기 넷이 한꺼번에 장을 읽을 때) */
const LINK_SETUP_MS = 20000;
const IDLE: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };

export type TeamRole = 'host' | 'guest';

/** 장 코드가 쓰는 여러 기기 연결 */
export interface TeamNet {
  readonly role: TeamRole;
  readonly code: string;
  /** 이 기기가 움직이는 요정 */
  readonly me: Slot;
  /** 이 시도의 요정들(시작할 때 정해지고 바뀌지 않는다, 2~4명) */
  readonly slots: Slot[];
  /** 장 저장 칸(방마다 따로 → 다른 방과 섞이지 않는다) */
  readonly roomId: string;
  /** 방장: LocalRun을 붙여 팀 시계·일시중지·다시 하기를 연결한다. 참가자: 방장 상태를 비추는 run */
  bindRun(hud: Hud, makeLocal: () => LocalRun): TeamRun;
  /** 방장: 이번 프레임 모두의 입력(내 것 + 참가자 것). 참가자는 빈 값 */
  inputs(local: Intent, live: boolean): Record<string, SewingInput>;
  /** 참가자: 내 입력을 보낸다(이동 30Hz, 행동은 누른 순간) */
  sendIntent(local: Intent): void;
  /** 방장: 지금 장 상태(보내기는 15Hz로 알아서) */
  publish(page: number, state: unknown): void;
  /** 방장: 이번 프레임 장 사건 */
  emit(events: readonly unknown[]): void;
  /** 참가자: 방장이 보낸 최신 장 상태 */
  remote<T>(): T | null;
  /** 참가자: 방장 사건 받기 */
  onEvents(fn: (events: unknown[]) => void): void;
  /** 방장: 요정이 나가고(false) 들어올(true) 때. 등록하는 순간 지금 없는 요정도 알려 준다 */
  onPresence(fn: (slot: Slot, on: boolean) => void): void;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
}

const hatOf = (slot: string) => ELF_LOOKS[Number(slot.slice(1))]!.hat;
const isTest = () => import.meta.env.DEV || new URLSearchParams(location.search).has('test');
const setTeamHud = (hud: Hud | null, team: TeamEntry[]) => hud?.setTeam(team.map((m) => ({ color: hatOf(m.slot), connected: m.connected })));
const toInput = (i: Intent): SewingInput => ({ move: i.move, actionDown: i.action.down, actionHeld: i.action.held, crouch: !!i.crouch });

function exposeNet(v: Record<string, unknown>): void {
  if (isTest()) (window as unknown as Record<string, unknown>).__lastgiftNet = v;
}

export interface TeamOptions {
  emu: boolean;
  /** 방 저장 이름(이야기 모드 'story', 장별 개발 'chN') */
  mode: string;
  /** 초대 링크에 붙일 주소 */
  inviteSearch: (code: string) => string;
  /** 지난 방을 잇지 않고 새 방(수업마다: `?host&new`). 장이 넘어가며 페이지를 다시 읽어도 또 새 방이 되지 않게 주소에서 지운다 */
  fresh?: boolean;
}

/** 첫 화면 이후 장을 열 때 필요한 것: 어느 장(page)을, 어떤 연결로 */
export interface TeamStart {
  net: TeamNet;
  /** 참가자: 방장이 지금 연 장. 방장: null(자기 저장에서 읽는다) */
  page: number | null;
}

// ── 방장 ────────────────────────────────────────────────

interface SavedRoom {
  code: string;
  seats: [string, Slot][];
  started: boolean;
  slots: Slot[];
}

class TeamHost implements TeamNet, MirrorLink {
  readonly role = 'host' as const;
  readonly me: Slot = 'p0';
  slots: Slot[] = [];
  started = false;
  private readonly names = new Map<string, string>();
  private readonly links = new Map<string, PeerLink>();
  readonly lastHeard = new Map<string, number>();
  private readonly open = new Set<Slot>(['p0']);
  readonly guestIn = new Map<Slot, { n: number; move: { x: number; y: number }; held: boolean; crouch?: boolean; at: number }>();
  private readonly pendingAct = new Map<Slot, number>();
  private readonly seen = new Map<Slot, Set<string>>();
  private readonly presence: ((slot: Slot, on: boolean) => void)[] = [];
  readonly netLog: { t: 'joined' | 'left'; slot: Slot; why?: string; at: number }[] = [];
  private readonly sid = newId().slice(0, 8);
  private linkSeq = 0;
  private run: LocalRun | null = null;
  private hud: Hud | null = null;
  private page = -1;
  private state: unknown = null;
  private snapN = 0;
  private lastSnap = 0;
  private evN = 0;
  private lastTick = 0;
  /** 이 시각까지는 GUEST_LOADING_MS만큼 조용해도 기다린다(uid별) */
  private readonly graceUntil = new Map<string, number>();

  constructor(
    private readonly sig: FirebaseSignaling,
    readonly code: string,
    private readonly seats: Map<string, Slot>,
    private readonly save: (r: SavedRoom) => void,
    private readonly iceServers: RTCIceServer[],
  ) {
    this.names.set(sig.uid, elfNickname(sig.uid));
  }

  get roomId(): string {
    return `net-${this.code}`;
  }
  get slot(): string {
    return this.me;
  }
  get connected(): boolean {
    return true;
  }
  get snap(): TeamSnapMsg | null {
    return null;
  }
  get snapAt(): number {
    return 0;
  }
  sendRetry(): void {}

  get openSlots(): Slot[] {
    return [...this.open].sort();
  }

  persist(): void {
    this.save({ code: this.code, seats: [...this.seats], started: this.started, slots: this.slots });
  }

  team(): TeamEntry[] {
    // 별명은 기기 uid로 정해져 겹칠 수 있다 → 앞 자리 요정과 겹치면 겹치지 않는 별명으로(각자 화면에도 이 이름이 뜬다)
    const used = new Set<string>();
    return [...this.seats]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([uid, slot]) => {
        let name = this.names.get(uid) ?? '요정';
        for (let k = 1; used.has(name) && k < 40; k++) name = elfNickname(`${uid}#${k}`);
        used.add(name);
        return { slot, name, connected: this.open.has(slot) };
      });
  }

  private setPresence(slot: Slot, on: boolean): void {
    if (!this.started || !this.slots.includes(slot)) return;
    for (const fn of this.presence) fn(slot, on);
  }

  private dropLink(uid: string, link: PeerLink, why: string): void {
    if (this.links.get(uid) !== link) return;
    this.links.delete(uid);
    const slot = this.seats.get(uid);
    if (!slot || !this.open.has(slot)) return;
    this.open.delete(slot);
    this.guestIn.delete(slot);
    this.pendingAct.delete(slot);
    this.netLog.push({ t: 'left', slot, why, at: Math.round(performance.now()) });
    this.setPresence(slot, false);
  }

  listen(): void {
    const sig = this.sig;
    sig.onSignal((m) => {
      const l = this.links.get(m.from);
      if (l && l.link === m.link) void l.handle(m.kind, m.data).catch(() => l.close());
    });
    // 참가자가 들어오거나(처음) 다시 접속을 요청하면 새 연결을 연다. 같은 uid는 같은 자리로.
    sig.onMember((uid, info) => {
      if (uid === sig.uid) return;
      this.names.set(uid, typeof info?.name === 'string' ? info.name.slice(0, 12) : '요정');
      const old = this.links.get(uid);
      if (old) {
        this.dropLink(uid, old, 'rejoin');
        old.close();
      }
      const id = `${this.sid}-${++this.linkSeq}`;
      const link = new PeerLink(id, (kind, data) => void sig.send(uid, kind, id, data).catch(() => {}), this.iceServers);
      this.links.set(uid, link);
      link.onOpen = () => {
        const slot = assignSlot(this.seats, uid, this.started);
        if (slot === 'full' || slot === 'started') {
          link.send('mission', { t: 'refuse', reason: slot });
          setTimeout(() => link.close(), 500);
          return;
        }
        this.seats.set(uid, slot);
        this.persist();
        this.open.add(slot);
        this.lastHeard.set(uid, performance.now());
        this.graceUntil.set(uid, performance.now() + GUEST_LOADING_MS);
        this.netLog.push({ t: 'joined', slot, at: Math.round(performance.now()) });
        playSfx('join'); // 대기실·놀이 중 누가 들어오면 방장 기기에서 작은 종소리
        link.send('mission', { t: 'welcome', slot, runId: this.run?.state.runId ?? '-' });
        this.setPresence(slot, true);
        this.sendSnap(performance.now());
      };
      link.onClose = () => this.dropLink(uid, link, link.closeWhy);
      link.onMessage = (ch, data) => this.onGuest(uid, link, ch, data);
      void link.offer().catch(() => link.close());
    });
    window.addEventListener('pagehide', () => {
      for (const l of this.links.values()) l.close();
    });
    // 방장 탭이 숨으면 일시중지를 바로 알리고, 돌아오면 못 들은 소식을 끊김으로 오해하지 않게 시계를 새로 잰다
    document.addEventListener('visibilitychange', () => {
      const now = performance.now();
      if (document.visibilityState === 'hidden') this.sendSnap(now);
      else for (const uid of this.lastHeard.keys()) this.lastHeard.set(uid, now);
    });
  }

  private onGuest(uid: string, link: PeerLink, ch: string, data: string): void {
    const slot = this.seats.get(uid);
    if (!slot || !this.open.has(slot) || this.links.get(uid) !== link) return; // 이 연결에 배정한 자리만 믿는다
    this.lastHeard.set(uid, performance.now());
    const m = parseGuestMsg(data);
    if (!m) return;
    if (m.t === 'in') {
      // 이동 입력은 state(빠름, 잃을 수 있음)와 mission(느려도 꼭 도착) 둘로 온다 → 번호가 새것만
      const prev = this.guestIn.get(slot);
      if (prev && m.n <= prev.n) return;
      this.guestIn.set(slot, { n: m.n, move: { x: m.mx, y: m.my }, held: m.held, crouch: !!m.crouch, at: performance.now() });
      return;
    }
    if (ch !== 'mission' || !this.run) return;
    const ss = this.seen.get(slot) ?? new Set<string>();
    this.seen.set(slot, ss);
    const st = this.run.state;
    const verdict = checkMission(m, { slot, runId: st.runId, epoch: st.epoch, seen: ss });
    if (verdict === 'ok' || verdict === 'staleEpoch') ss.add(m.eventId);
    if (verdict !== 'ok') return;
    if (m.t === 'act') this.pendingAct.set(slot, (this.pendingAct.get(slot) ?? 0) + 1);
    else this.run.dispatch({ type: 'retry', at: performance.now(), runId: m.runId, epoch: m.epoch, playerId: slot, eventId: m.eventId });
  }

  /** 대기실에서 「시작」: 지금 들어와 있는 요정들로 자리를 확정 */
  start(): boolean {
    if (this.started || this.open.size < 2) return false;
    for (const [uid, slot] of [...this.seats]) if (!this.open.has(slot)) this.seats.delete(uid);
    this.slots = [...this.open].sort();
    this.started = true;
    this.persist();
    return true;
  }

  // ── 장 코드 쪽 ──
  bindRun(hud: Hud, makeLocal: () => LocalRun): TeamRun {
    this.hud = hud;
    // 장이 열리면 참가자들도 장 장면을 만든다
    for (const uid of this.links.keys()) this.graceUntil.set(uid, performance.now() + GUEST_LOADING_MS);
    const run = makeLocal();
    run.ensureSaved();
    this.run = run;
    return run;
  }

  inputs(local: Intent, live: boolean): Record<string, SewingInput> {
    const now = performance.now();
    const out: Record<string, SewingInput> = {};
    for (const slot of this.slots) {
      if (!live) {
        out[slot] = IDLE;
        continue;
      }
      if (slot === this.me) {
        out[slot] = toInput(local);
        continue;
      }
      const gi = this.guestIn.get(slot);
      const fresh = gi && now - gi.at < INPUT_STALE_MS;
      const acts = this.pendingAct.get(slot) ?? 0;
      if (acts > 0) this.pendingAct.set(slot, acts - 1);
      out[slot] = { move: fresh ? gi.move : { x: 0, y: 0 }, actionDown: acts > 0, actionHeld: !!(fresh && gi.held), crouch: !!(fresh && gi.crouch) };
    }
    return out;
  }

  sendIntent(): void {}

  publish(page: number, state: unknown): void {
    this.page = page;
    this.state = state;
  }

  emit(events: readonly unknown[]): void {
    if (!events.length || !this.run) return;
    const msg: EventsMsg = { t: 'ev', n: ++this.evN, runId: this.run.state.runId, events: [...events] };
    for (const l of this.links.values()) l.send('mission', msg);
  }

  remote<T>(): T | null {
    return null;
  }
  onEvents(): void {}

  onPresence(fn: (slot: Slot, on: boolean) => void): void {
    this.presence.push(fn);
    for (const s of this.slots) if (!this.open.has(s)) fn(s, false);
  }

  sendSnap(now: number): void {
    this.lastSnap = now;
    const run = this.run;
    let view: TeamSnapMsg['run'];
    if (run) {
      const st = run.state;
      const { seen: _seen, ...full } = st;
      const v: RunView = {
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
        started: this.started,
      };
      view = { ...v, full };
    } else {
      view = {
        runId: '-', epoch: 0, phase: 'lobby', chapterId: 0, remaining: 0, memories: [], completedChapters: [], paused: false, hostAway: false, resumeIn: null, started: this.started,
        full: null as unknown as TeamSnapMsg['run']['full'],
      };
    }
    const msg = { t: 'tsnap', n: ++this.snapN, page: run ? this.page : -1, state: run ? this.state : null, run: view, team: this.team() };
    for (const l of this.links.values()) l.send('state', msg);
  }

  /** 매 화면: 끊긴 참가자 정리, 혼자 남으면 일시중지, 스냅샷 보내기 */
  tick(now: number): void {
    // 이 기기가 오래 멈췄다 돌아왔다(장 장면 만들기·탭 전환): 그동안 못 들은 소식을 끊김으로 오해하지 않는다
    if (now - this.lastTick > LONG_FRAME_MS) for (const uid of this.lastHeard.keys()) this.lastHeard.set(uid, now);
    this.lastTick = now;
    for (const [uid, l] of this.links) {
      const slot = this.seats.get(uid);
      const limit = now < (this.graceUntil.get(uid) ?? 0) ? GUEST_LOADING_MS : GUEST_GONE_MS;
      if (slot && this.open.has(slot) && now - (this.lastHeard.get(uid) ?? now) > limit) l.close('silent');
    }
    setTeamHud(this.hud, this.team());
    const run = this.run;
    if (this.started && run) {
      const alone = run.state.pauseReasons.includes('alone');
      if (this.open.size < 2 && !alone) run.dispatch({ type: 'pause', at: now, reason: 'alone' });
      if (this.open.size >= 2 && alone) run.dispatch({ type: 'resume', at: now, reason: 'alone', resumeAt: now + RESUME_DELAY_MS });
    }
    if (now - this.lastSnap >= SNAP_MS) this.sendSnap(now);
  }
}

// ── 참가자 ──────────────────────────────────────────────

class TeamGuest implements TeamNet, MirrorLink {
  readonly role = 'guest' as const;
  mySlot: Slot | null = null;
  snap: TeamSnapMsg | null = null;
  snapAt = 0;
  refused: string | null = null;
  fatal: string | null = null;
  /** 이 페이지가 연 장(바뀌면 페이지를 다시 읽는다) */
  page = -1;
  private runId = '';
  private hostUid = '';
  private link: PeerLink | null = null;
  private lastN = -1;
  private lastEv = 0;
  private lastJoin = 0;
  inN = 0;
  private sureKey = '';
  private sureAt = 0;
  private lastInput = 0;
  /** 장을 열기 전(대기실)에도 빈 입력을 보내 방장이 끊긴 것으로 보지 않게 한다 */
  pendingIntent: Intent = IDLE_INTENT;
  /** 장 코드가 마지막으로 입력을 넘긴 시각: 오래되면(연출 중 등) 빈 입력을 보낸다(눌린 채 남지 않게) */
  private intentTick = -9;
  private ticks = 0;
  /** 방장이 새 연결을 제안한 때. 연결을 맺는 중에는 다시 접속을 요청하지 않는다(요청마다 방장이 처음부터 다시 맺어, 무거운 4기기에서 영영 못 붙었다) */
  private linkMadeAt = -Infinity;
  private lastTick = 0;
  private lobbyKey = '';
  private hud: Hud | null = null;
  private readonly evFns: ((e: unknown[]) => void)[] = [];
  readonly name: string;

  constructor(
    private readonly sig: FirebaseSignaling,
    readonly code: string,
    private readonly iceServers: RTCIceServer[],
  ) {
    this.name = elfNickname(sig.uid);
  }

  get me(): Slot {
    return this.mySlot ?? 'p0';
  }
  /** 방장이 이 자리에 붙인 이름(겹치지 않게 고친 것). 아직 모르면 내 별명 */
  get shownName(): string {
    return this.snap?.team.find((m) => m.slot === this.mySlot)?.name ?? this.name;
  }
  get slot(): string {
    return this.me;
  }
  get slots(): Slot[] {
    return (this.snap?.team ?? []).map((t) => t.slot).sort();
  }
  get roomId(): string {
    return `net-${this.code}`;
  }
  get connected(): boolean {
    return !!this.link?.isOpen && (performance.now() - this.snapAt < HOST_LOST_MS || !!this.snap?.run.hostAway);
  }

  async join(): Promise<void> {
    this.lastJoin = performance.now();
    try {
      this.hostUid = await this.sig.joinRoom(this.code, this.name);
    } catch (e) {
      if (e instanceof RoomError && (e.code === 'notFound' || e.code === 'expired')) this.fatal = e.code === 'notFound' ? '방을 찾을 수 없어요. 코드를 확인해 주세요.' : '끝난 방이에요.';
    }
  }

  private makeLink(id: string): PeerLink {
    this.linkMadeAt = performance.now();
    const l = new PeerLink(id, (kind, data) => void this.sig.send(this.hostUid, kind, id, data).catch(() => {}), this.iceServers);
    this.lastN = -1;
    this.lastEv = 0;
    l.onMessage = (_ch, data) => {
      const m = parseHostMsg(data);
      if (!m) return;
      if (m.t === 'welcome') this.mySlot = m.slot;
      else if (m.t === 'refuse') this.refused = m.reason === 'full' ? '방이 가득 찼어요.' : '이미 시작한 방이에요.';
      else if (m.t === 'tsnap' && m.n > this.lastN) {
        this.lastN = m.n;
        this.snap = m;
        this.snapAt = performance.now();
      } else if (m.t === 'ev' && m.n > this.lastEv) {
        this.lastEv = m.n;
        if (this.page >= 0 && m.runId === this.runId) for (const fn of this.evFns) fn(m.events);
      }
    };
    l.onClose = () => {
      if (this.link === l) this.link = null;
    };
    return l;
  }

  listen(): void {
    this.sig.onSignal((m) => {
      if (m.from !== this.hostUid) return;
      if (m.kind === 'offer' && this.link?.link !== m.link) {
        this.link?.close();
        this.link = this.makeLink(m.link);
      }
      const l = this.link;
      if (l && l.link === m.link) void l.handle(m.kind, m.data).catch(() => l.close());
    });
    window.addEventListener('pagehide', () => this.link?.close());
  }

  sendRetry(meta: ClientMeta): void {
    if (this.link?.isOpen) this.link.send('mission', { t: 'retry', ...meta });
  }

  /** 장을 열 준비가 됐는가(방장이 시작했고 장을 열었다) */
  get ready(): boolean {
    return !!this.snap && this.snap.run.started && this.snap.page >= 0 && !!this.mySlot && this.slots.includes(this.mySlot);
  }

  enter(): number {
    this.page = this.snap!.page;
    this.runId = this.snap!.run.runId;
    return this.page;
  }

  // ── 장 코드 쪽 ──
  bindRun(hud: Hud): TeamRun {
    this.hud = hud;
    return new MirrorRun(this, hud, { ...(this.snap!.run.full as RunState), seen: [] });
  }
  inputs(): Record<string, SewingInput> {
    return {};
  }
  sendIntent(local: Intent): void {
    this.pendingIntent = local;
    this.intentTick = this.ticks;
    if (local.action.down && this.link?.isOpen && this.snap && this.mySlot) {
      const r = this.snap.run;
      this.link.send('mission', { t: 'act', runId: r.runId, epoch: r.epoch, playerId: this.mySlot, eventId: newId() });
    }
  }
  publish(): void {}
  emit(): void {}
  remote<T>(): T | null {
    return this.snap && this.snap.page === this.page ? (this.snap.state as T) : null;
  }
  onEvents(fn: (events: unknown[]) => void): void {
    this.evFns.push(fn);
  }
  onPresence(): void {}

  /** 매 화면: 다시 접속, 입력 보내기, 장이 바뀌었으면 다시 읽기 */
  tick(now: number, lobby: Lobby): void {
    // 이 기기가 오래 멈췄다 돌아왔다(장 장면 만들기): 밀린 스냅샷이 들어올 때까지 다시 접속 요청을 미룬다
    if (now - this.lastTick > LONG_FRAME_MS) {
      this.lastJoin = now;
      this.snapAt = Math.max(this.snapAt, now - 1000);
    }
    this.lastTick = now;
    const connected = this.connected;
    const handshaking = !!this.link && !this.link.isOpen && now - this.linkMadeAt < LINK_SETUP_MS;
    if (!this.fatal && !this.refused && !connected && !handshaking && now - this.lastJoin > REJOIN_EVERY_MS) {
      if (this.link && now - this.snapAt >= HOST_LOST_MS && this.snapAt > 0) this.link.close();
      void this.join();
    }
    // 장 코드가 최근 화면(2번 안)에 입력을 넘기지 않았으면(연출 중 등) 빈 입력. 시간으로 재지 않는다:
    // 느린 기기(초당 몇 화면)에서는 화면 사이가 길어 멀쩡한 입력을 버리게 된다
    this.ticks++;
    const intent = this.ticks - this.intentTick <= 2 ? this.pendingIntent : IDLE_INTENT;
    if (this.link?.isOpen && this.mySlot && now - this.lastInput >= INPUT_MS) {
      this.lastInput = now;
      const msg = { t: 'in', n: ++this.inN, mx: intent.move.x, my: intent.move.y, held: intent.action.held, crouch: !!intent.crouch };
      this.link.send('state', msg);
      // 학교망처럼 state 채널 꾸러미를 많이 잃는 길에서도 움직임이 끊기지 않게: 바뀌었을 때와 0.25초마다 신뢰 채널로도
      const key = `${msg.mx.toFixed(2)},${msg.my.toFixed(2)},${msg.held}`;
      if (key !== this.sureKey || now - this.sureAt >= 250) {
        this.sureKey = key;
        this.sureAt = now;
        this.link.send('mission', msg);
      }
    }
    if (this.snap) setTeamHud(this.hud, this.snap.team);
    // 방장이 다음 장을 열었거나(이야기 모드) 처음부터 다시 시작했다 → 같은 장 화면으로 다시 연다
    if (this.page >= 0 && this.snap && this.snap.page >= 0 && (this.snap.page !== this.page || this.snap.run.runId !== this.runId)) {
      this.page = -2;
      location.reload();
      return;
    }
    if (this.page >= 0) {
      // 놀이 중: 끊겼을 때만 안내(같은 내용이면 다시 그리지 않는다)
      const msg = this.fatal ?? this.refused ?? (connected ? '' : '방장과 연결이 끊겼어요. 다시 연결하는 중…');
      const key = `${msg}|${(this.snap?.team ?? []).map((m) => `${m.slot}${m.connected}`).join()}`;
      if (key !== this.lobbyKey) {
        this.lobbyKey = key;
        if (msg) lobby.showGuest({ name: this.shownName, team: this.snap?.team ?? [], message: msg, error: true });
        else lobby.hide();
      }
    }
  }
}

// ── 시작 ────────────────────────────────────────────────

/** 방 만들기(방장): 대기실에서 둘 이상 모이면 「시작」. 예전 방이 이미 시작했으면 바로 이어 간다 */
export async function hostTeam(o: TeamOptions): Promise<TeamStart | null> {
  attachSfx(document);
  setSfxMuted(loadSettings(browserStorage()).muted);
  const lobby = createLobby(document);
  lobby.showMessage('방을 만드는 중…');
  let sig: FirebaseSignaling;
  try {
    sig = await FirebaseSignaling.connect(o.emu);
  } catch (e) {
    const notSet = e instanceof RoomError && e.code === 'notConfigured';
    lobby.showMessage(notSet ? '여러 기기 연결 설정(Firebase)이 아직 없어요.' : '연결하지 못했어요. 인터넷 연결을 확인해 주세요.', true);
    return null;
  }
  const kv = browserStorage();
  const key = `lastgift.teamRoom.v1.${o.mode}${o.emu ? '.emu' : ''}`;
  let saved: SavedRoom | null = null;
  try {
    saved = JSON.parse(kv?.getItem(key) ?? 'null') as SavedRoom | null;
  } catch {
    saved = null;
  }
  let code: string;
  try {
    code = saved && !o.fresh && (await sig.resumeRoom(saved.code)) ? saved.code : await sig.createRoom();
  } catch {
    lobby.showMessage('방을 만들지 못했어요. 잠시 뒤 다시 해 주세요.', true);
    return null;
  }
  if (o.fresh) {
    const u = new URL(location.href);
    u.searchParams.delete('new');
    history.replaceState(history.state, '', u);
  }
  const same = saved?.code === code;
  const seats = new Map<string, Slot>(same ? saved!.seats : []);
  seats.set(sig.uid, 'p0');
  const host = new TeamHost(
    sig,
    code,
    seats,
    (r) => {
      try {
        kv?.setItem(key, JSON.stringify(r));
      } catch {
        /* 저장 못 해도 방은 계속된다 */
      }
    },
    o.emu ? [] : DEFAULT_ICE,
  );
  if (same && saved!.started && saved!.slots.length >= 2) {
    host.started = true;
    host.slots = saved!.slots;
  }
  host.persist();
  host.listen();
  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    host.tick(now);
  });
  exposeNet({
    role: () => 'host',
    roomCode: () => code,
    uid: () => sig.uid,
    started: () => host.started,
    start: () => host.start(),
    slots: () => [...seats],
    team: () => host.slots,
    openSlots: () => host.openSlots,
    netLog: () => host.netLog.map((e) => ({ ...e })),
    /** 점검: 참가자별 마지막 소식 뒤 ms, 마지막 입력 */
    heard: () => [...host.lastHeard].map(([uid, t]) => ({ uid: uid.slice(0, 6), ago: Math.round(performance.now() - t) })),
    inputs: () => [...host.guestIn].map(([slot, v]) => ({ slot, n: v.n, move: v.move, ago: Math.round(performance.now() - v.at) })),
  });
  if (host.started) {
    lobby.hide();
    return { net: host, page: null };
  }
  const link = (() => {
    const u = new URL(location.href);
    u.search = o.inviteSearch(code);
    u.hash = '';
    return u.toString();
  })();
  return new Promise((resolve) => {
    const go = () => {
      if (!host.start()) return;
      lobby.hide();
      resolve({ net: host, page: null });
    };
    const show = () => {
      if (host.started) return;
      lobby.showHost({ code, link, team: host.team(), canStart: host.openSlots.length >= 2, onStart: go });
      setTimeout(show, 250);
    };
    show();
    // 시험: 대기실 단추 대신
    if (isTest()) (window as unknown as { __lastgiftNet: Record<string, unknown> }).__lastgiftNet.start = () => (go(), host.started);
  });
}

/** 참가하기: 방장이 시작해 장을 열 때까지 대기실에서 기다린다 */
export async function joinTeam(code: string, emu: boolean): Promise<TeamStart | null> {
  const lobby = createLobby(document);
  if (!isRoomCode(code)) {
    lobby.showMessage('방 코드를 다시 확인해 주세요.', true);
    return null;
  }
  lobby.showGuest({ name: '', team: [], message: '연결하는 중…' });
  let sig: FirebaseSignaling;
  try {
    sig = await FirebaseSignaling.connect(emu);
  } catch (e) {
    const notSet = e instanceof RoomError && e.code === 'notConfigured';
    lobby.showGuest({ name: '', team: [], message: notSet ? '여러 기기 연결 설정(Firebase)이 아직 없어요.' : '연결하지 못했어요. 인터넷 연결을 확인해 주세요.', error: true });
    return null;
  }
  const g = new TeamGuest(sig, code, emu ? [] : DEFAULT_ICE);
  await g.join();
  if (!g.fatal) g.listen();
  exposeNet({
    role: () => 'guest',
    uid: () => sig.uid,
    slot: () => g.mySlot,
    sent: () => g.inN,
    intent: () => ({ move: g.pendingIntent.move, run: g.snap ? { phase: g.snap.run.phase, paused: g.snap.run.paused, resumeIn: g.snap.run.resumeIn } : null, connected: g.connected }),
    connected: () => g.connected,
    page: () => g.page,
    snap: () => (g.snap ? JSON.parse(JSON.stringify(g.snap)) : null),
    /** 시험용: 미션 이벤트를 그대로 보낸다(재전송·사칭 시험) */
    sendMission: (msg: unknown) => (g as unknown as { link: PeerLink | null }).link?.send('mission', msg),
  });
  return new Promise((resolve) => {
    let key = '';
    requestAnimationFrame(function loop(now) {
      requestAnimationFrame(loop);
      g.tick(now, lobby);
      if (g.page !== -1) return;
      if (g.ready) {
        lobby.hide();
        resolve({ net: g, page: g.enter() });
        return;
      }
      const msg = g.fatal ?? g.refused ?? (g.connected ? '방장이 시작하기를 기다리는 중' : '연결하는 중…');
      const k = `${msg}|${g.shownName}|${(g.snap?.team ?? []).map((m) => `${m.slot}${m.connected}`).join()}`;
      if (k !== key) {
        key = k;
        lobby.showGuest({ name: g.shownName, team: g.snap?.team ?? [], message: msg, error: !!(g.fatal || g.refused) });
      }
    });
  });
}

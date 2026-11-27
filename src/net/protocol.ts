// 방장 ↔ 참가자 메시지. 받은 쪽은 반드시 parse*로 모양을 검사한 뒤 쓴다(모르는 값은 버린다).
// 미션 이벤트에는 runId·epoch·playerId·eventId를 싣는다(명세서 §8). 방장은 playerId를 믿지 않고
// "이 연결에 배정한 자리"로 다시 확인한다.
import type { RunState } from '../core/run';
import type { SewingState } from '../core/sewing';

export type Slot = 'p0' | 'p1' | 'p2' | 'p3';
export const SLOTS: readonly Slot[] = ['p0', 'p1', 'p2', 'p3'];
export const MAX_PLAYERS = 4;

// ── 참가자 → 방장 ───────────────────────────────────────

/** state 채널: 최신 이동 입력(늦게 온 것은 n으로 거른다) */
export interface InputMsg {
  t: 'in';
  n: number;
  mx: number;
  my: number;
  held: boolean;
}

/** mission 채널: 행동 버튼·E 한 번 */
export interface ActMsg {
  t: 'act';
  runId: string;
  epoch: number;
  playerId: string;
  eventId: string;
}

/** mission 채널: 시간 초과 화면의 「다시 하기」 */
export interface RetryMsg {
  t: 'retry';
  runId: string;
  epoch: number;
  playerId: string;
  eventId: string;
}

export type GuestMsg = InputMsg | ActMsg | RetryMsg;

// ── 방장 → 참가자 ───────────────────────────────────────

export interface TeamEntry {
  slot: Slot;
  name: string;
  connected: boolean;
}

export interface WelcomeMsg {
  t: 'welcome';
  slot: Slot;
  runId: string;
}

export interface RefuseMsg {
  t: 'refuse';
  reason: 'full' | 'started';
}

export interface RunView {
  runId: string;
  epoch: number;
  phase: string;
  chapterId: number;
  remaining: number;
  memories: number[];
  completedChapters: number[];
  paused: boolean;
  /** 방장 탭이 숨어 있어 팀 전체가 멈춤(이 동안 방장이 조용해도 끊긴 것이 아니다) */
  hostAway: boolean;
  /** 재개 카운트다운이 끝나기까지 ms. 없으면 null */
  resumeIn: number | null;
  started: boolean;
}

/** state 채널: 방장 화면 상태(10~15Hz) */
export interface SnapMsg {
  t: 'snap';
  n: number;
  sewing: SewingState | null;
  run: RunView;
  team: TeamEntry[];
}

/** state 채널(모든 장 공통): 방장의 장 상태 + 팀 시도 상태(10~15Hz). 참가자는 이것만 그린다 */
export interface TeamSnapMsg {
  t: 'tsnap';
  n: number;
  /** 방장 화면이 지금 연 장(5·6장은 한 화면) */
  page: number;
  state: unknown;
  run: RunView & { full: Omit<RunState, 'seen'> };
  team: TeamEntry[];
}

/** mission 채널(순서·신뢰 보장): 방장 판정에서 나온 장 사건(소리·연출 시작용). n은 1부터 빠짐없이 */
export interface EventsMsg {
  t: 'ev';
  n: number;
  runId: string;
  events: unknown[];
}

export type HostMsg = WelcomeMsg | RefuseMsg | SnapMsg | TeamSnapMsg | EventsMsg;

// ── 검사 ────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, max = 64) => typeof v === 'string' && v.length > 0 && v.length <= max;

function json(data: string): unknown {
  if (data.length > 200_000) return null;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

export function parseGuestMsg(data: string): GuestMsg | null {
  const v = json(data);
  if (!isObj(v)) return null;
  if (v.t === 'in') {
    if (!num(v.n) || !num(v.mx) || !num(v.my) || typeof v.held !== 'boolean') return null;
    const len = Math.hypot(v.mx as number, v.my as number);
    const k = len > 1 ? 1 / len : 1; // 속도를 부풀리지 못하게
    return { t: 'in', n: v.n as number, mx: (v.mx as number) * k, my: (v.my as number) * k, held: v.held };
  }
  if (v.t === 'act' || v.t === 'retry') {
    if (!str(v.runId) || !num(v.epoch) || !str(v.playerId, 8) || !str(v.eventId)) return null;
    return { t: v.t, runId: v.runId as string, epoch: v.epoch as number, playerId: v.playerId as string, eventId: v.eventId as string };
  }
  return null;
}

export function parseHostMsg(data: string): HostMsg | null {
  const v = json(data);
  if (!isObj(v)) return null;
  if (v.t === 'welcome' && SLOTS.includes(v.slot as Slot) && str(v.runId)) return v as unknown as WelcomeMsg;
  if (v.t === 'refuse' && (v.reason === 'full' || v.reason === 'started')) return v as unknown as RefuseMsg;
  if (v.t === 'snap' && num(v.n) && isObj(v.run) && Array.isArray(v.team)) return v as unknown as SnapMsg;
  if (v.t === 'tsnap' && num(v.n) && num(v.page) && isObj(v.run) && isObj(v.run.full) && Array.isArray(v.team)) return v as unknown as TeamSnapMsg;
  if (v.t === 'ev' && num(v.n) && str(v.runId) && Array.isArray(v.events)) return v as unknown as EventsMsg;
  return null;
}

/** 참가자 이벤트 검사: 이 연결의 자리·이 시도·지금 epoch·처음 보는 eventId인가 */
export function checkMission(
  m: ActMsg | RetryMsg,
  ctx: { slot: Slot; runId: string; epoch: number; seen: Set<string> },
): 'ok' | 'wrongSlot' | 'otherRun' | 'staleEpoch' | 'duplicate' {
  if (m.playerId !== ctx.slot) return 'wrongSlot';
  if (m.runId !== ctx.runId) return 'otherRun';
  if (ctx.seen.has(m.eventId)) return 'duplicate';
  if (m.epoch !== ctx.epoch) return 'staleEpoch';
  return 'ok';
}

/** 자동 요정 별명(실명 대신) */
const NICK = ['눈송이', '방울', '솔방울', '별사탕', '호두', '단추', '종소리', '털실', '귤껍질', '목도리'];
export function elfNickname(uid: string): string {
  let h = 0;
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${NICK[h % NICK.length]} 요정`;
}

/** 새 참가자에게 줄 빈자리. 같은 uid가 다시 오면 예전 자리 그대로 */
export function assignSlot(seats: ReadonlyMap<string, Slot>, uid: string, started: boolean): Slot | 'full' | 'started' {
  const mine = seats.get(uid);
  if (mine) return mine;
  if (started) return 'started';
  const taken = new Set(seats.values());
  return SLOTS.find((s) => !taken.has(s)) ?? 'full';
}

// 1장 규칙(명세서 §5 1장). 방장만 계산한다. three.js·DOM 없음.
//
// - 0장에서 나눠 담은 물고기 자루(스케치북·색연필 통이 들어 있다)를 1P가 메고 시작한다(2026-11-28 사용자 결정).
//   자루는 혼자 메고 내려놓고 다시 멜 수 있다(core/carry, 화면에서는 등에 멘다). 현관 발판에서 행동 → 두 선물을 꺼내
//   현관에 놓는다(빈 자루는 그대로 멘다). 자루를 멘 요정은 손이 차서 지도를 펴지 못한다.
// - 지우의 그림 지도: 빈손이고 집을 것이 가까이 없을 때 행동 버튼 → 지도를 편다(편 동안은 서서 읽는다). 한 번 더 → 접는다.
//   선물을 든 요정은 손이 차서 지도를 펴지 못한다 → 한 명은 지도를 읽고 한 명은 찾아 걷게 된다.
// - 갈림길 동네(data/chapter1): 낮은 담 + 나무 대문 집이 넷. 대문 앞에서 행동 → 유나네 대문은 빗장이 풀려 열린다(계속 열림),
//   가짜 집 대문은 덜컹거릴 뿐(잠김). 자루를 멘 요정도 연다(손은 비었다). 대문 앞에서는 지도·내려놓기보다 대문이 먼저.
// - 유나네 앞마당(낮은 담 안)에 처음 들어서면 "찾았다"(한 번만).
// - 무궁화 꽃이 피었습니다(2026-11-28 사용자 결정): 유나는 창가에서 [그림 그리기 → 일어나 돌아서기(예고 1초) → 창밖 보기 → 다시 앉기]를
//   되풀이한다(시드로 정한 순서). 창밖을 보는 동안 앞마당 안에서 움직인 요정은 들킨다. 멈춰 있거나, 엄폐물 뒤(창 → 요정 선이 막힘)에서
//   **앉아 있거나**(앉기 키·단추, 앉으면 느리게 걷는다: 엄폐물 뒤에서 앉은 채 살금살금은 괜찮다), 창 바로 아래면 괜찮다. 돌아본 첫 LOOK_GRACE초는 봐준다(멈출 틈).
//   들키면 화면이 잠깐 까맣게 바뀌고(CAUGHT_PAUSE초, 모두 멈춤) 들킨 요정은 대문 앞으로 돌아가 있다. 유나는 다시 그림을 그린다.
//   든 것은 그대로, 팀 시계도 그대로. 예전 망보는 자리·손 신호·눈 표시·작은 엿보기 화면은 없앴다.
// - 초인종(2026-11-28 사용자 결정): 유나네 앞마당에서 빈손(자루를 멘 요정도) 행동 → 눈을 뭉쳐 눈뭉치를 쥔다. 쥔 채 누르고 있으면 힘이 모이고
//   떼면 바라보는 쪽(초인종 쪽 가까우면 초인종 쪽)으로 던진다. 현관문 옆 초인종을 맞히면 띵동 → 유나가 창가를 떠나(DOOR_TRIP)
//   현관으로 걸어와(창이 빈다) → 문을 열고 두리번거린다(이때는 앞마당에서 엄폐물 뒤에 앉아 있지 않으면 멈춰 있어도 들킨다)
//   → 문을 닫고 창가로 돌아간다(창이 빈다). 빗나가면 퍽(다시 던지면 된다).
// - 두 선물은 자루째 현관에서 한 번에 꺼내 놓는다(하나만 놓인 채 들킬 일이 없다). 선물을 다 놓은 뒤 초인종을 울리면
//   유나가 문을 열고 선물을 발견한다 → 1장 완료(예전 "모두 앞마당 밖으로 물러나면 완료"는 없앴다).
// - 현관 발판에 선물을 내려놓으면 그 자리에 고정. 둘 다 놓고 모두 앞마당 밖으로 물러나면 1장 완료(한 번만).
import { applyAction, chooseTarget, planAction as planCarry, PICK_RANGE, type Item } from './carry';
import { stepPlayer, type PlayerState, type World } from './player';
import type { SewingInput } from './sewing';
import {
  BLIND,
  CH1_BOUNDS,
  CH1_START,
  COVERS,
  gateNear,
  DOORBELL,
  DOOR_EYE,
  DOOR_TRIP,
  THROW,
  OUTSIDE_GATE,
  PORCH,
  W,
  YUNA_EYE,
  ch1Colliders,
  inPorch,
  inYunasYard,
  toLane,
} from '../data/chapter1';

export const CAMERA_YAW = Math.PI / 4;
/** 물고기 자루(아이템 id) */
export const SACK = 'sack';
/** 자루에서 꺼낸 선물이 놓이는 자리(현관 발판 위, 왼쪽·오른쪽) */
const UNPACK_OFF = [-0.55, 0.55];

export interface Ch1Player extends PlayerState {
  id: string;
  connected: boolean;
  /** 지우의 지도를 펴 들고 있다(움직이지 않는다) */
  mapOpen: boolean;
  /** 앉아 있다(엄폐물 뒤에서 숨는다, 걸음이 느리다) */
  crouching?: boolean;
  /** 눈뭉치를 쥐고 있다 */
  snowball?: boolean;
  /** 던질 힘을 모으는 중(초). 없으면 모으지 않는다 */
  charge?: number;

}

export interface Ch1State {
  players: Ch1Player[];
  items: Item[];
  /** 유나네 앞마당에 들어섰다 */
  found: boolean;
  /** 장 안 시각(초): 유나 시선 주기 */
  time: number;
  seed: number;
  /** 현관에 놓은 선물 */
  placed: string[];
  /** 스케치북·색연필 통이 아직 자루 속에 있다 */
  packed: boolean;
  /** 둘 다 놓고 물러났다 */
  complete: boolean;
  /** 유나네 나무 대문을 열었다 */
  gateOpen: boolean;
  /** 유나 시선 시계 = time - gazeShift (종·들킴 암전 동안 멈추고, 돌아오면 그림 그리기부터) */
  gazeShift: number;
  /** 종 소리에 유나가 창가를 떠나 있는 남은 초(0 = 창가에 있다) */
  yunaAway: number;
  /** 들킴 암전 남은 초(0 = 없음). 그동안 모두 멈춘다 */
  caughtPause: number;
  /** 암전 한가운데서 대문 앞으로 옮길 요정 */
  caughtIds: string[];
  /** 날아가는 눈뭉치 */
  balls: Snowball[];
}

/** 날아가는 눈뭉치: 출발(x0,z0) → 떨어질 곳(x1,z1), t/dur 지남 */
export interface Snowball {
  from: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  t: number;
  dur: number;
  /** 초인종에 맞는다(떨어지는 곳이 초인종 아래): 그림은 초인종 높이에서 끝난다 */
  hit: boolean;
}

/** 이 요정이 힘 power(0~1)로 던지면 떨어질 곳(바라보는 쪽, 초인종 쪽에 가까우면 초인종 쪽으로 맞춰 준다) */
export function throwTarget(p: { x: number; z: number; facing: number }, power: number): { x: number; z: number; dist: number } {
  const dist = THROW.min + (THROW.max - THROW.min) * Math.min(1, Math.max(0, power));
  const c = W(DOORBELL.s, DOORBELL.t);
  const toC = Math.atan2(c.x - p.x, c.z - p.z);
  let d = toC - p.facing;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const yaw = Math.abs(d) < THROW.assist ? toC : p.facing;
  return { x: p.x + Math.sin(yaw) * dist, z: p.z + Math.cos(yaw) * dist, dist };
}

// ── 유나 시선 ────────────────────────────────────────────
/** away: 등지고 그림, turn: 일어나 돌아서기(예고), look: 창밖 보기, back: 다시 앉기,
 *  gone: 초인종에 현관으로 가거나 돌아가는 중(창이 빈다), door: 현관문을 열고 두리번(문간에서 마당을 본다) */
export type GazePhase = 'away' | 'turn' | 'look' | 'back' | 'gone' | 'door';
/** 초인종에 창가를 비우는 모두의 초(현관까지 + 문간 + 돌아가기) */
export const YUNA_AWAY = DOOR_TRIP.toDoor + DOOR_TRIP.atDoor + DOOR_TRIP.back;
/** 문간에서 두리번거리기 시작한 뒤 봐주는 시간(초) */
export const DOOR_GRACE = 0.4;
/** 들킴 암전: 어두워짐 → 깜깜(이때 대문 앞으로) → 밝아짐 */
export const CAUGHT_PAUSE = 1.6;
const CAUGHT_SWAP = 0.8; // 남은 시간이 이만큼이면(가장 깜깜할 때) 옮긴다
export const GAZE = { awayMin: 4.2, awayRand: 2.2, turn: 1.0, lookMin: 2.6, lookRand: 1.0, back: 0.6 };

/** 시각 t의 유나 시선(시드마다 같은 순서). k: 그 단계에서 지난 비율 */
export function gazeAt(t: number, seed: number): { phase: GazePhase; k: number; left: number } {
  // 시드를 고루 섞어(가까운 시드끼리도 순서가 달라지게) 시작
  let r = ((Math.imul(seed | 0, 2654435761) >>> 0) % 2147483646) + 1;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 3; i++) rnd();
  let at = 0;
  for (let i = 0; i < 10000; i++) {
    const away = GAZE.awayMin + GAZE.awayRand * rnd();
    const look = GAZE.lookMin + GAZE.lookRand * rnd();
    const parts: [GazePhase, number][] = [['away', away], ['turn', GAZE.turn], ['look', look], ['back', GAZE.back]];
    for (const [phase, d] of parts) {
      if (t < at + d) return { phase, k: (t - at) / d, left: at + d - t };
      at += d;
    }
  }
  return { phase: 'away', k: 0, left: 1 };
}

/** 지금 유나 시선(종 소리에 떠나 있으면 gone) */
export function gazeOf(s: Pick<Ch1State, 'time' | 'seed' | 'gazeShift' | 'yunaAway'>): { phase: GazePhase; k: number; left: number } {
  if (s.yunaAway > 0) {
    const u = YUNA_AWAY - s.yunaAway; // 초인종 뒤 지난 초
    if (u >= DOOR_TRIP.toDoor && u < DOOR_TRIP.toDoor + DOOR_TRIP.atDoor) {
      const k = (u - DOOR_TRIP.toDoor) / DOOR_TRIP.atDoor;
      return { phase: 'door', k, left: DOOR_TRIP.toDoor + DOOR_TRIP.atDoor - u };
    }
    return { phase: 'gone', k: 1 - s.yunaAway / YUNA_AWAY, left: s.yunaAway };
  }
  return gazeAt(s.time - (s.gazeShift ?? 0), s.seed);
}

/** 유나 시선 시계를 다음 "그림 그리기(away)" 시작으로 맞춘다(이미 그리는 중이면 그대로) */
function toNextAway(s: Ch1State): number {
  let gt = s.time - s.gazeShift;
  for (let i = 0; i < 8; i++) {
    const g = gazeAt(gt, s.seed);
    if (g.phase === 'away') break;
    gt += g.left + 1e-6;
  }
  return s.time - gt;
}

/** 떨어질 곳이 초인종 아래(맞힘 반지름 안)인가 */
export function isDoorbellHit(p: { x: number; z: number }): boolean {
  const c = W(DOORBELL.s, DOORBELL.t);
  return Math.hypot(p.x - c.x, p.z - c.z) <= DOORBELL.r;
}

/** 앉아 걷는 빠르기(서서 걷기의 배) */
export const CROUCH_SPEED = 0.5;

/** 창에서 이 요정이 보이지 않는가(엄폐물 뒤에서 앉아 있음, 창 바로 아래, 앞마당 밖) */
export function hiddenFromWindow(p: { x: number; z: number; crouching?: boolean }): boolean {
  if (!inYunasYard(p)) return true;
  const { s, t } = toLane(p);
  if (s >= BLIND.s0 && t >= BLIND.t0 && t <= BLIND.t1) return true;
  return behindCover(s, t, YUNA_EYE, !!p.crouching);
}

/** 현관문간(두리번거리는 유나)에서 이 요정이 보이지 않는가(엄폐물 뒤에서 앉아 있음, 앞마당 밖) */
export function hiddenFromDoor(p: { x: number; z: number; crouching?: boolean }): boolean {
  if (!inYunasYard(p)) return true;
  const { s, t } = toLane(p);
  return behindCover(s, t, DOOR_EYE, !!p.crouching);
}

/** 눈(eye) → 요정 선이 엄폐물을 지나고, 요정이 그 엄폐물 바로 뒤에 앉아 있다 */
function behindCover(s: number, t: number, eye: { s: number; t: number }, crouching: boolean): boolean {
  // 서 있으면 머리가 보인다
  if (!crouching) return false;
  const ds = s - eye.s, dt = t - eye.t;
  const len2 = ds * ds + dt * dt;
  for (const c of COVERS) {
    const u = ((c.s - eye.s) * ds + (c.t - eye.t) * dt) / len2;
    if (u <= 0 || u >= 1) continue;
    const px = eye.s + ds * u - c.s, pt = eye.t + dt * u - c.t;
    const behind = Math.hypot(s - c.s, t - c.t);
    if (Math.hypot(px, pt) < c.r && behind < c.r + 1.9) return true;
  }
  return false;
}

/** 창밖을 보기 시작한 뒤 봐주는 시간(초): 돌아서는 걸 보고 멈출 틈 */
export const LOOK_GRACE = 0.3;
export type Ch1Event =
  | { type: 'pick'; playerId: string; itemId: string }
  | { type: 'drop'; playerId: string; itemId: string }
  | { type: 'blocked'; playerId: string; itemId: string }
  | { type: 'map'; playerId: string; open: boolean }
  | { type: 'found'; playerId: string }
  | { type: 'caught'; playerId: string }
  | { type: 'placed'; itemId: string }
  | { type: 'unpack'; playerId: string }
  | { type: 'gateOpened'; playerId: string }
  | { type: 'gateLocked'; playerId: string; gateId: string }
  | { type: 'snowball'; playerId: string }
  | { type: 'throw'; playerId: string; power: number }
  | { type: 'doorbell'; playerId: string }
  | { type: 'doorOpen'; found: boolean }
  | { type: 'splat'; x: number; z: number }
  | { type: 'complete' };

export type Ch1Action =
  | { kind: 'pick'; itemId: string }
  | { kind: 'drop'; itemId: string }
  | { kind: 'blocked'; itemId: string }
  | { kind: 'map'; open: boolean }
  | { kind: 'place'; itemId: string }
  | { kind: 'gate'; gateId: string }
  | { kind: 'snowball' }
  | { kind: 'throw' }
  | { kind: 'none' };

const COLLIDERS_SHUT = ch1Colliders(false);
const COLLIDERS_OPEN = ch1Colliders(true);
const collidersOf = (s: Ch1State) => (s.gateOpen ? COLLIDERS_OPEN : COLLIDERS_SHUT);
const WORLD_SHUT: World = { colliders: COLLIDERS_SHUT, bounds: CH1_BOUNDS, cameraYaw: CAMERA_YAW };
const WORLD_OPEN: World = { colliders: COLLIDERS_OPEN, bounds: CH1_BOUNDS, cameraYaw: CAMERA_YAW };

export function createChapter1(playerIds: readonly string[], seed = 1): Ch1State {
  return {
    players: playerIds.map((id, i) => {
      const sp = CH1_START.spawns[i % CH1_START.spawns.length]!;
      // 시작은 골목 쪽(화면 위)을 본다
      return { id, x: sp.x, z: sp.z, facing: Math.PI + Math.PI / 4, moving: false, connected: true, mapOpen: false };
    }),
    items: [
      // 자루(1P가 멘다) + 자루 속 선물 둘(꺼내기 전에는 숨어 있고 집을 수 없다)
      { id: SACK, x: CH1_START.spawns[0]!.x, z: CH1_START.spawns[0]!.z, light: true, carriedBy: playerIds[0] ?? null },
      ...CH1_START.items.map((it) => ({ id: it.id, x: it.x, z: it.z, light: true, carriedBy: null })),
    ],
    packed: true,
    found: false,
    time: 0,
    seed,
    placed: [],
    complete: false,
    gateOpen: false,
    gazeShift: 0,
    yunaAway: 0,
    caughtPause: 0,
    caughtIds: [],
    balls: [],
  };
}

/** 지금 행동하면 무엇을 하는지(미리보기와 실제 판정이 같이 쓴다) */
export function planAction(s: Ch1State, playerId: string): Ch1Action {
  const p = s.players.find((q) => q.id === playerId);
  if (!p || !p.connected || s.complete || s.caughtPause > 0) return { kind: 'none' };
  if (p.mapOpen) return { kind: 'map', open: false };
  // 대문 앞: 유나네는 열기(닫혀 있을 때만), 가짜 집은 덜컹
  const gate = gateNear(p);
  if (gate && !(gate.id === 'yuna' && s.gateOpen)) return { kind: 'gate', gateId: gate.id };
  // 눈뭉치: 쥐고 있으면 던지기(누르고 있으면 힘이 모인다)
  if (p.snowball) return { kind: 'throw' };
  const yard = inYunasYard(p);
  const held = s.items.find((i) => i.carriedBy === playerId);
  if (held) {
    const a = planCarry(playerId, p, s.items, collidersOf(s), CH1_BOUNDS);
    if (a.kind === 'drop' && inPorch(a)) return { kind: 'place', itemId: a.itemId };
    // 등에 멘 자루는 손이 비어 있다: 앞마당에서는 눈을 뭉친다(현관에서는 꺼내기)
    if (held.id === SACK && yard) return { kind: 'snowball' };
    if (a.kind === 'drop') return { kind: 'drop', itemId: a.itemId };
    return { kind: 'blocked', itemId: held.id };
  }
  const t = chooseTarget(p, s.items.filter((i) => !s.placed.includes(i.id) && !(s.packed && i.id !== SACK)));
  if (t && Math.hypot(t.x - p.x, t.z - p.z) <= PICK_RANGE) return { kind: 'pick', itemId: t.id };
  // 유나네 앞마당: 빈손이면 눈을 뭉친다(지도는 앞마당 밖에서)
  if (yard) return { kind: 'snowball' };
  // 빈손이고 집을 것이 없다 → 지도를 편다
  return { kind: 'map', open: true };
}

export function step(state: Ch1State, inputs: Record<string, SewingInput>, dt: number): { state: Ch1State; events: Ch1Event[] } {
  const fx: Ch1Event[] = [];
  let s = state;
  // 0) 들킴 암전: 모두 멈춘다. 가장 깜깜할 때 들킨 요정을 대문 앞으로(든 것과 함께), 유나 시선 시계도 멈춘다
  if (s.caughtPause > 0) {
    const before = s.caughtPause;
    const left = Math.max(0, before - dt);
    s = { ...s, caughtPause: left, time: s.time + dt, gazeShift: s.gazeShift + dt };
    if (before > CAUGHT_SWAP && left <= CAUGHT_SWAP) {
      const ids = s.caughtIds;
      s = {
        ...s,
        players: s.players.map((p) => {
          const k = ids.indexOf(p.id);
          if (k < 0) return p;
          const to = W(OUTSIDE_GATE.s - 0.3 * k, OUTSIDE_GATE.t + (k % 2 ? 1 : -1) * 0.7 * Math.ceil(k / 2));
          return { ...p, x: to.x, z: to.z, moving: false, mapOpen: false, facing: Math.PI + Math.PI / 4 };
        }),
      };
      s = { ...s, items: s.items.map((i) => (i.carriedBy ? { ...i, ...pos(s, i.carriedBy) } : i)) };
    }
    if (left === 0) s = { ...s, caughtIds: [] };
    return { state: { ...s, players: s.players.map((p) => (p.moving ? { ...p, moving: false } : p)) }, events: fx };
  }
  // 1) 행동
  for (const p of s.players) {
    const inp = inputs[p.id];
    if (!inp?.actionDown) continue;
    const a = planAction(s, p.id);
    if (a.kind === 'pick') {
      s = { ...s, items: applyAction(p.id, s.items, { kind: 'pick', itemId: a.itemId }) as Item[] };
      fx.push({ type: 'pick', playerId: p.id, itemId: a.itemId });
    } else if (a.kind === 'drop' || a.kind === 'place') {
      const me = s.players.find((q) => q.id === p.id)!;
      const plan = planCarry(p.id, me, s.items, collidersOf(s), CH1_BOUNDS);
      if (a.kind === 'place' && a.itemId === SACK && plan.kind === 'drop') {
        // 현관 발판: 자루에서 두 선물을 꺼내 발판 위에 나란히 놓는다(빈 자루는 그대로 멘다)
        if (s.packed) {
          const gifts = CH1_START.items.map((it) => it.id);
          const at = (k: number) => W(PORCH.s, PORCH.t + UNPACK_OFF[k]!);
          s = {
            ...s,
            packed: false,
            items: s.items.map((i) => {
              const k = gifts.indexOf(i.id as (typeof gifts)[number]);
              return k >= 0 ? { ...i, ...at(k), carriedBy: null } : i;
            }),
            placed: [...new Set([...s.placed, ...gifts])],
          };
          fx.push({ type: 'unpack', playerId: p.id });
          for (const id of gifts) fx.push({ type: 'placed', itemId: id });
        }
        continue;
      }
      if (plan.kind === 'drop') {
        s = { ...s, items: applyAction(p.id, s.items, plan) as Item[] };
        fx.push({ type: 'drop', playerId: p.id, itemId: a.itemId });
        if (inPorch(plan) && !s.placed.includes(a.itemId)) {
          s = { ...s, placed: [...s.placed, a.itemId] };
          fx.push({ type: 'placed', itemId: a.itemId });
        }
      }
    } else if (a.kind === 'gate') {
      if (a.gateId === 'yuna') {
        s = { ...s, gateOpen: true };
        fx.push({ type: 'gateOpened', playerId: p.id });
      } else fx.push({ type: 'gateLocked', playerId: p.id, gateId: a.gateId });
    } else if (a.kind === 'snowball') {
      s = { ...s, players: s.players.map((q) => (q.id === p.id ? { ...q, snowball: true, mapOpen: false } : q)) };
      fx.push({ type: 'snowball', playerId: p.id });
    } else if (a.kind === 'throw') {
      // 힘 모으기 시작(떼는 순간 던진다)
      if (p.charge === undefined) s = { ...s, players: s.players.map((q) => (q.id === p.id ? { ...q, charge: 0 } : q)) };
    } else if (a.kind === 'blocked') {
      fx.push({ type: 'blocked', playerId: p.id, itemId: a.itemId });
    } else if (a.kind === 'map') {
      s = { ...s, players: s.players.map((q) => (q.id === p.id ? { ...q, mapOpen: a.open, moving: false } : q)) };
      fx.push({ type: 'map', playerId: p.id, open: a.open });
    }
  }
  // 2) 이동(지도를 편 요정은 서서 읽는다)
  const WORLD = s.gateOpen ? WORLD_OPEN : WORLD_SHUT;
  s = {
    ...s,
    players: s.players.map((p) => {
      const inp = inputs[p.id];
      if (!p.connected || p.mapOpen || !inp) return p.moving ? { ...p, moving: false } : p;
      const crouching = !!inp.crouch;
      const move = crouching ? { x: inp.move.x * CROUCH_SPEED, y: inp.move.y * CROUCH_SPEED } : inp.move;
      return { ...p, ...stepPlayer(p, move, dt, WORLD), crouching };
    }),
  };
  // 2-1) 눈뭉치: 누르고 있는 동안 힘을 모으고, 떼면 던진다
  for (const p of s.players) {
    if (p.charge === undefined) continue;
    const inp = inputs[p.id];
    if (inp?.actionHeld && p.connected) {
      s = { ...s, players: s.players.map((q) => (q.id === p.id ? { ...q, charge: Math.min(THROW.chargeSec, (q.charge ?? 0) + dt) } : q)) };
      continue;
    }
    const power = Math.min(1, (p.charge ?? 0) / THROW.chargeSec);
    const tg = throwTarget(p, power);
    s = {
      ...s,
      players: s.players.map((q) => (q.id === p.id ? { ...q, charge: undefined, snowball: false } : q)),
      balls: [...(s.balls ?? []), { from: p.id, x0: p.x, z0: p.z, x1: tg.x, z1: tg.z, t: 0, dur: 0.45 + tg.dist * 0.045, hit: isDoorbellHit(tg) }],
    };
    fx.push({ type: 'throw', playerId: p.id, power });
  }
  // 2-2) 날아가는 눈뭉치: 떨어지면 종을 맞혔나 본다
  if (s.balls?.length) {
    const flying: Snowball[] = [];
    for (const b of s.balls) {
      const n = { ...b, t: b.t + dt };
      if (n.t < n.dur) {
        flying.push(n);
        continue;
      }
      if (n.hit) {
        // 띵동: 유나가 창가를 떠나 현관으로 온다. 이미 나와 있으면 초인종만 울린다. 돌아가면 그림 그리기부터
        if (!s.yunaAway) {
          s = { ...s, yunaAway: YUNA_AWAY };
          s = { ...s, gazeShift: toNextAway(s) };
        }
        fx.push({ type: 'doorbell', playerId: n.from });
      } else fx.push({ type: 'splat', x: n.x1, z: n.z1 });
    }
    s = { ...s, balls: flying };
  }
  // 3) 든 선물은 든 요정을 따라간다
  s = {
    ...s,
    items: s.items.map((i) => {
      if (!i.carriedBy) return i;
      const p = s.players.find((q) => q.id === i.carriedBy);
      return p ? { ...i, x: p.x, z: p.z } : i;
    }),
  };
  // 4) 유나네 앞마당에 처음 들어섰다
  if (!s.found) {
    const who = s.players.find((p) => p.connected && inYunasYard(p));
    if (who) {
      s = { ...s, found: true };
      fx.push({ type: 'found', playerId: who.id });
    }
  }
  // 5) 유나 시선(무궁화 꽃이 피었습니다): 창밖을 보는 동안 앞마당에서 움직인 요정은 들킨다(멈춰 있거나 엄폐물 뒤면 괜찮다)
  s = { ...s, time: s.time + dt };
  if (s.yunaAway > 0) {
    // 초인종에 창가를 떠나 있다: 시선 시계는 멈춘 채(돌아오면 그림 그리기부터)
    const before = gazeOf(s);
    s = { ...s, yunaAway: Math.max(0, s.yunaAway - dt), gazeShift: s.gazeShift + dt };
    const now = gazeOf(s);
    if (now.phase === 'door' && before.phase !== 'door' && !s.complete) {
      // 문을 열었다: 선물이 다 놓여 있으면 발견 → 1장 완료
      const found = s.placed.length === CH1_START.items.length;
      fx.push({ type: 'doorOpen', found });
      if (found) {
        s = { ...s, complete: true };
        fx.push({ type: 'complete' });
      }
    }
    if (now.phase === 'door' && !s.complete && now.k * DOOR_TRIP.atDoor >= DOOR_GRACE) {
      // 문간에서 두리번: 앞마당에서 엄폐물 뒤에 앉아 있지 않으면(멈춰 있어도) 들킨다
      const caught = s.players.filter((p) => p.connected && !hiddenFromDoor(p)).map((p) => p.id);
      if (caught.length) {
        for (const id of caught) fx.push({ type: 'caught', playerId: id });
        // 유나는 문을 닫고 들어간다(다시 밝아지면 창가에서 그림부터)
        s = { ...s, caughtPause: CAUGHT_PAUSE, caughtIds: caught, yunaAway: 0 };
        s = { ...s, gazeShift: toNextAway(s) };
      }
    }
  } else if (!s.complete) {
    const gaze = gazeOf(s);
    if (gaze.phase === 'look') {
      // 창밖을 본 지 몇 초(첫 LOOK_GRACE초는 봐준다)
      const since = (gaze.k / Math.max(1e-6, 1 - gaze.k)) * gaze.left;
      if (since >= LOOK_GRACE) {
        const caught = s.players.filter((p) => p.connected && p.moving && !hiddenFromWindow(p)).map((p) => p.id);
        if (caught.length) {
          for (const id of caught) fx.push({ type: 'caught', playerId: id });
          s = { ...s, caughtPause: CAUGHT_PAUSE, caughtIds: caught };
          // 다시 밝아지면 유나는 그림부터
          s = { ...s, gazeShift: toNextAway(s) };
        }
      }
    }
  }
  return { state: s, events: fx };
}

function pos(s: Ch1State, id: string): { x: number; z: number } {
  const p = s.players.find((q) => q.id === id)!;
  return { x: p.x, z: p.z };
}

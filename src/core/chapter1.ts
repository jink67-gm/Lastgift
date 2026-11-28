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
//   되풀이한다(시드로 정한 순서). 창밖을 보는 동안 앞마당 안에서 움직인 요정은 들킨다. 멈춰 있거나, 엄폐물 뒤(창 → 요정 선이 막힘)나
//   창 바로 아래면 괜찮다. 돌아본 첫 LOOK_GRACE초는 봐준다(멈출 틈).
//   들키면 화면이 잠깐 까맣게 바뀌고(CAUGHT_PAUSE초, 모두 멈춤) 들킨 요정은 대문 앞으로 돌아가 있다. 유나는 다시 그림을 그린다.
//   든 것은 그대로, 팀 시계도 그대로. 예전 망보는 자리·손 신호·눈 표시·작은 엿보기 화면은 없앴다.
// - 종(BELL, 담 밖): 행동 → 유나가 창가를 떠나 YUNA_AWAY초 동안 창이 빈다(그동안은 아무도 들키지 않는다). 돌아오면 다시 그림부터.
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
  BELL,
  BELL_REACH,
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
}

// ── 유나 시선 ────────────────────────────────────────────
/** away: 등지고 그림, turn: 일어나 돌아서기(예고), look: 창밖 보기, back: 다시 앉기, gone: 종 소리에 창가를 떠남 */
export type GazePhase = 'away' | 'turn' | 'look' | 'back' | 'gone';
/** 종 소리에 창가를 비우는 초 */
export const YUNA_AWAY = 8;
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
  if (s.yunaAway > 0) return { phase: 'gone', k: 1 - s.yunaAway / YUNA_AWAY, left: s.yunaAway };
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

/** 이 요정이 종 앞에 있는가 */
export function atBell(p: { x: number; z: number }): boolean {
  const { s, t } = toLane(p);
  return Math.hypot(s - BELL.s, t - BELL.t) <= BELL_REACH;
}

/** 창에서 이 요정이 보이지 않는가(엄폐물 뒤, 창 바로 아래, 앞마당 밖) */
export function hiddenFromWindow(p: { x: number; z: number }): boolean {
  if (!inYunasYard(p)) return true;
  const { s, t } = toLane(p);
  if (s >= BLIND.s0 && t >= BLIND.t0 && t <= BLIND.t1) return true;
  // 창 → 요정 선이 엄폐물을 지나고, 요정이 그 엄폐물 바로 뒤에 있다
  for (const c of COVERS) {
    const ds = s - YUNA_EYE.s, dt = t - YUNA_EYE.t;
    const len2 = ds * ds + dt * dt;
    const u = ((c.s - YUNA_EYE.s) * ds + (c.t - YUNA_EYE.t) * dt) / len2;
    if (u <= 0 || u >= 1) continue;
    const px = YUNA_EYE.s + ds * u - c.s, pt = YUNA_EYE.t + dt * u - c.t;
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
  | { type: 'bell'; playerId: string }
  | { type: 'complete' };

export type Ch1Action =
  | { kind: 'pick'; itemId: string }
  | { kind: 'drop'; itemId: string }
  | { kind: 'blocked'; itemId: string }
  | { kind: 'map'; open: boolean }
  | { kind: 'place'; itemId: string }
  | { kind: 'gate'; gateId: string }
  | { kind: 'bell' }
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
  // 종: 유나가 창가에 있을 때만(떠나 있는 동안은 울려도 소용없다)
  if (atBell(p) && !s.yunaAway) return { kind: 'bell' };
  const held = s.items.find((i) => i.carriedBy === playerId);
  if (held) {
    const a = planCarry(playerId, p, s.items, collidersOf(s), CH1_BOUNDS);
    if (a.kind === 'drop') return inPorch(a) ? { kind: 'place', itemId: a.itemId } : { kind: 'drop', itemId: a.itemId };
    return { kind: 'blocked', itemId: held.id };
  }
  const t = chooseTarget(p, s.items.filter((i) => !s.placed.includes(i.id) && !(s.packed && i.id !== SACK)));
  if (t && Math.hypot(t.x - p.x, t.z - p.z) <= PICK_RANGE) return { kind: 'pick', itemId: t.id };
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
    } else if (a.kind === 'bell') {
      // 유나가 소리 나는 쪽으로 간다: 창이 빈다. 돌아오면 그림 그리기부터
      s = { ...s, yunaAway: YUNA_AWAY };
      s = { ...s, gazeShift: toNextAway(s) };
      fx.push({ type: 'bell', playerId: p.id });
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
      return { ...p, ...stepPlayer(p, inp.move, dt, WORLD) };
    }),
  };
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
    // 종 소리에 창가를 떠나 있다: 시선 시계는 멈춘 채(돌아오면 그림 그리기부터)
    s = { ...s, yunaAway: Math.max(0, s.yunaAway - dt), gazeShift: s.gazeShift + dt };
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
  // 6) 두 선물을 현관에 놓고 모두 앞마당 밖으로 물러나면 완료
  if (!s.complete && s.placed.length === CH1_START.items.length && !s.players.some((p) => p.connected && inYunasYard(p))) {
    s = { ...s, complete: true };
    fx.push({ type: 'complete' });
  }
  return { state: s, events: fx };
}

function pos(s: Ch1State, id: string): { x: number; z: number } {
  const p = s.players.find((q) => q.id === id)!;
  return { x: p.x, z: p.z };
}

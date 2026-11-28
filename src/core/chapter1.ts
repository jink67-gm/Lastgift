// 1장 규칙(명세서 §5 1장). 방장만 계산한다. three.js·DOM 없음.
//
// - 0장에서 나눠 담은 물고기 자루(스케치북·색연필 통이 들어 있다)를 1P가 메고 시작한다(2026-11-28 사용자 결정).
//   자루는 혼자 메고 내려놓고 다시 멜 수 있다(core/carry, 화면에서는 등에 멘다). 현관 발판에서 행동 → 두 선물을 꺼내
//   현관에 놓는다(빈 자루는 그대로 멘다). 자루를 멘 요정은 손이 차서 지도를 펴지 못한다.
// - 지우의 그림 지도: 빈손이고 집을 것이 가까이 없을 때 행동 버튼 → 지도를 편다(편 동안은 서서 읽는다). 한 번 더 → 접는다.
//   선물을 든 요정은 손이 차서 지도를 펴지 못한다 → 한 명은 지도를 읽고 한 명은 찾아 걷게 된다.
// - 유나네 앞마당(낮은 담 안)에 처음 들어서면 "찾았다"(한 번만).
// - 망보기(04-4b): 유나는 창가에서 [그림 그리기 → 몸 돌리기(예고) → 창밖 보기 → 다시 그리기]를 되풀이한다(시드로 정한 순서).
//   창밖을 보는 동안 앞마당 안에서 엄폐물 뒤(창 → 요정 선이 엄폐물에 막힘)나 창 바로 아래가 아닌 요정은 들킨다
//   → 마지막으로 숨었던 엄폐물 뒤(없으면 대문 밖)로 돌아간다. 든 선물은 그대로, 팀 시계도 그대로.
// - 망보는 자리에 선 빈손 요정은 행동 버튼으로 손을 든다/내린다("지금 가" 신호). 창을 들여다보는 작은 화면은 화면 쪽에서.
// - 현관 발판에 선물을 내려놓으면 그 자리에 고정. 둘 다 놓고 모두 앞마당 밖으로 물러나면 1장 완료(한 번만).
import { applyAction, chooseTarget, planAction as planCarry, PICK_RANGE, type Item } from './carry';
import { stepPlayer, type PlayerState, type World } from './player';
import type { SewingInput } from './sewing';
import {
  BLIND,
  CH1_BOUNDS,
  CH1_START,
  COVERS,
  LOOKOUT_R,
  LOOKOUTS,
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
  /** 망보는 자리에서 손을 들었다("지금 가") */
  handUp: boolean;
  /** 마지막으로 숨었던 엄폐물 뒤 자리(들키면 여기로). null이면 대문 밖 */
  lastCover: { x: number; z: number } | null;
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
}

// ── 유나 시선 ────────────────────────────────────────────
export type GazePhase = 'away' | 'turn' | 'look' | 'back';
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

/** 이 요정이 서 있는 망보는 자리(없으면 null) */
export function lookoutAt(p: { x: number; z: number }): (typeof LOOKOUTS)[number] | null {
  const { s, t } = toLane(p);
  return LOOKOUTS.find((l) => Math.hypot(l.s - s, l.t - t) <= LOOKOUT_R) ?? null;
}

export type Ch1Event =
  | { type: 'pick'; playerId: string; itemId: string }
  | { type: 'drop'; playerId: string; itemId: string }
  | { type: 'blocked'; playerId: string; itemId: string }
  | { type: 'map'; playerId: string; open: boolean }
  | { type: 'found'; playerId: string }
  | { type: 'signal'; playerId: string; up: boolean }
  | { type: 'caught'; playerId: string }
  | { type: 'placed'; itemId: string }
  | { type: 'unpack'; playerId: string }
  | { type: 'complete' };

export type Ch1Action =
  | { kind: 'pick'; itemId: string }
  | { kind: 'drop'; itemId: string }
  | { kind: 'blocked'; itemId: string }
  | { kind: 'map'; open: boolean }
  | { kind: 'signal'; up: boolean }
  | { kind: 'place'; itemId: string }
  | { kind: 'none' };

const COLLIDERS = ch1Colliders();
const WORLD: World = { colliders: COLLIDERS, bounds: CH1_BOUNDS, cameraYaw: CAMERA_YAW };

export function createChapter1(playerIds: readonly string[], seed = 1): Ch1State {
  return {
    players: playerIds.map((id, i) => {
      const sp = CH1_START.spawns[i % CH1_START.spawns.length]!;
      // 시작은 골목 쪽(화면 위)을 본다
      return { id, x: sp.x, z: sp.z, facing: Math.PI + Math.PI / 4, moving: false, connected: true, mapOpen: false, handUp: false, lastCover: null };
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
  };
}

/** 지금 행동하면 무엇을 하는지(미리보기와 실제 판정이 같이 쓴다) */
export function planAction(s: Ch1State, playerId: string): Ch1Action {
  const p = s.players.find((q) => q.id === playerId);
  if (!p || !p.connected || s.complete) return { kind: 'none' };
  if (p.mapOpen) return { kind: 'map', open: false };
  const held = s.items.find((i) => i.carriedBy === playerId);
  if (held) {
    const a = planCarry(playerId, p, s.items, COLLIDERS, CH1_BOUNDS);
    if (a.kind === 'drop') return inPorch(a) ? { kind: 'place', itemId: a.itemId } : { kind: 'drop', itemId: a.itemId };
    return { kind: 'blocked', itemId: held.id };
  }
  const t = chooseTarget(p, s.items.filter((i) => !s.placed.includes(i.id) && !(s.packed && i.id !== SACK)));
  if (t && Math.hypot(t.x - p.x, t.z - p.z) <= PICK_RANGE) return { kind: 'pick', itemId: t.id };
  // 망보는 자리: 손 들기/내리기
  if (lookoutAt(p)) return { kind: 'signal', up: !p.handUp };
  // 빈손이고 집을 것이 없다 → 지도를 편다
  return { kind: 'map', open: true };
}

export function step(state: Ch1State, inputs: Record<string, SewingInput>, dt: number): { state: Ch1State; events: Ch1Event[] } {
  const fx: Ch1Event[] = [];
  let s = state;
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
      const plan = planCarry(p.id, me, s.items, COLLIDERS, CH1_BOUNDS);
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
    } else if (a.kind === 'signal') {
      s = { ...s, players: s.players.map((q) => (q.id === p.id ? { ...q, handUp: a.up } : q)) };
      fx.push({ type: 'signal', playerId: p.id, up: a.up });
    } else if (a.kind === 'blocked') {
      fx.push({ type: 'blocked', playerId: p.id, itemId: a.itemId });
    } else if (a.kind === 'map') {
      s = { ...s, players: s.players.map((q) => (q.id === p.id ? { ...q, mapOpen: a.open, moving: false } : q)) };
      fx.push({ type: 'map', playerId: p.id, open: a.open });
    }
  }
  // 2) 이동(지도를 편 요정은 서서 읽는다)
  s = {
    ...s,
    players: s.players.map((p) => {
      const inp = inputs[p.id];
      if (!p.connected || p.mapOpen || !inp) return p.moving ? { ...p, moving: false } : p;
      const n = { ...p, ...stepPlayer(p, inp.move, dt, WORLD) };
      // 망보는 자리를 떠나면 손을 내린다
      if (n.handUp && !lookoutAt(n)) n.handUp = false;
      return n;
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
  // 5) 유나 시선: 창밖을 보는 동안 드러난 요정은 마지막 엄폐물 뒤(없으면 대문 밖)로
  s = { ...s, time: s.time + dt };
  if (!s.complete) {
    const gaze = gazeAt(s.time, s.seed);
    const back = W(OUTSIDE_GATE.s, OUTSIDE_GATE.t);
    s = {
      ...s,
      players: s.players.map((p) => {
        if (!p.connected) return p;
        const hidden = hiddenFromWindow(p);
        if (gaze.phase === 'look' && !hidden) {
          fx.push({ type: 'caught', playerId: p.id });
          const to = p.lastCover ?? back;
          return { ...p, x: to.x, z: to.z, moving: false, mapOpen: false, handUp: false };
        }
        // 숨은 자리 기억: 앞마당 안 엄폐물 뒤면 그 자리, 앞마당 밖이면 대문 밖
        if (hidden) {
          if (inYunasYard(p)) return { ...p, lastCover: { x: p.x, z: p.z } };
          if (p.lastCover) return { ...p, lastCover: null };
        }
        return p;
      }),
    };
    // 들킨 요정이 든 선물도 같이 옮긴다
    s = { ...s, items: s.items.map((i) => (i.carriedBy ? { ...i, ...pos(s, i.carriedBy) } : i)) };
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

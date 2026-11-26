// 3장 규칙(명세서 §5 3장). 방장만 계산한다. three.js·DOM 없음.
//
// - 공은 하나. 빈손 요정이 공 가까이에서 행동 버튼 → 든다.
// - 받을 요정: 빈손으로 행동 버튼 → 손을 든다(움직이면 내린다). 공을 든 요정이 행동 버튼을 누를 때
//   보이는 거리(PASS.min~max) 안에 손을 든 동료가 있으면 → 그 손으로 짧은 포물선으로 던진다(울타리 너머로도).
//   손 든 동료가 없으면 앞에 내려놓는다. 민재네 대문 안쪽 자리에 내려놓으면 3장 완료(한 번만).
// - 받기: 공이 떨어질 때 받을 요정이 그 자리(CATCH_R) 안에 있으면 받는다. 자리를 떠났으면 공은 그 구역의 안전 지점으로.
// - 쪽문은 두 손으로 밀어야 열린다 → 공을 든 요정은 쪽문을 지나지 못한다(data/chapter3).
// - 콩이: 공이 가까이 오면 깨어 공(리본)을 향해 달린다(울타리 밑으로 빠진다). 공을 든 요정에게 닿으면 리본을 문다 →
//   그동안 그 요정은 멈춘다(움직이지도 던지지도 못한다) → 놓아주고 옆으로 비켜 앉았다가 다시 쫓는다.
//   공이 날아가면 떨어질 곳으로, 땅에 있으면 그 둘레를 맴돈다. 완료 뒤에도 공 주위를 빙빙 돈다.
import { moveCircle } from './collision';
import { dropPoint, PICK_RANGE } from './carry';
import { ELF_RADIUS, stepPlayer, type PlayerState, type World } from './player';
import type { SewingInput } from './sewing';
import { overlaps } from './collision';
import {
  CARRIER_COLLIDERS,
  CH3_BOUNDS,
  CH3_START,
  ELF_COLLIDERS,
  KONGI_COLLIDERS,
  KONGI_DEN,
  SAFE,
  inBallSpot,
  regionOf,
} from '../data/chapter3';

export const CAMERA_YAW = Math.PI / 4;

/** 던지기: 보이는 거리(m), 비행 시간 = base + per × 거리(초), 받는 자리 반경 */
export const PASS = { min: 1.0, max: 10.5, base: 0.55, per: 0.035, catchR: 1.3 };
/** 콩이: 쫓는 속도(요정 3.6보다 느리다), 깨는 거리, 무는 거리·시간, 놓아준 뒤 비켜 앉는 시간·거리, 맴도는 반경 */
export const KONGI = { speed: 2.9, runAway: 3.4, wake: 10, bite: 0.75, biteSec: 1.6, restSec: 2.4, away: 2.8, circleR: 1.1, radius: 0.32 };

export interface Ch3Player extends PlayerState {
  id: string;
  connected: boolean;
  /** 받으려고 손을 들었다 */
  handUp: boolean;
}

export interface Flight {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** 지난 시간 / 전체 시간(초) */
  t: number;
  dur: number;
  from: string;
  to: string;
}

export interface Ball {
  x: number;
  z: number;
  carriedBy: string | null;
  flight: Flight | null;
}

export type KongiMode = 'sleep' | 'chase' | 'bite' | 'rest' | 'circle';

export interface Kongi {
  x: number;
  z: number;
  facing: number;
  mode: KongiMode;
  /** 지금 모드에 남은 시간(bite·rest) */
  left: number;
  /** 물고 있는 요정 */
  biting: string | null;
  /** 비켜 앉을 자리(rest) */
  ax: number;
  az: number;
  /** 맴도는 각(circle) */
  spin: number;
  moving: boolean;
}

export interface Ch3State {
  players: Ch3Player[];
  ball: Ball;
  kongi: Kongi;
  time: number;
  seed: number;
  /** 대문 안쪽에 공을 내려놓았다 */
  complete: boolean;
  /** 던진 횟수(시험·기록) */
  passes: number;
}

export type Ch3Event =
  | { type: 'pick'; playerId: string }
  | { type: 'drop'; playerId: string }
  | { type: 'throw'; playerId: string; to: string }
  | { type: 'catch'; playerId: string }
  | { type: 'miss'; to: string }
  | { type: 'signal'; playerId: string; up: boolean }
  | { type: 'wake' }
  | { type: 'bite'; playerId: string }
  | { type: 'release'; playerId: string }
  | { type: 'blocked'; playerId: string }
  | { type: 'complete' };

export type Ch3Action =
  | { kind: 'pick' }
  | { kind: 'drop' }
  | { kind: 'place' }
  | { kind: 'throw'; to: string }
  | { kind: 'signal'; up: boolean }
  | { kind: 'held' }
  | { kind: 'blocked' }
  | { kind: 'none' };

const ELF_WORLD: World = { colliders: ELF_COLLIDERS, bounds: CH3_BOUNDS, cameraYaw: CAMERA_YAW };
const CARRIER_WORLD: World = { colliders: CARRIER_COLLIDERS, bounds: CH3_BOUNDS, cameraYaw: CAMERA_YAW };

export function createChapter3(playerIds: readonly string[], seed = 1): Ch3State {
  return {
    players: playerIds.map((id, i) => {
      const sp = CH3_START.spawns[i % CH3_START.spawns.length]!;
      return { id, x: sp.x, z: sp.z, facing: Math.PI + Math.PI / 4, moving: false, connected: true, handUp: false };
    }),
    ball: { x: CH3_START.ball.x, z: CH3_START.ball.z, carriedBy: null, flight: null },
    kongi: { x: KONGI_DEN.x, z: KONGI_DEN.z, facing: Math.PI / 4, mode: 'sleep', left: 0, biting: null, ax: 0, az: 0, spin: 0, moving: false },
    time: 0,
    seed,
    complete: false,
    passes: 0,
  };
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** 공을 든 요정이 지금 던질 수 있는 동료(가장 가까운 손 든 동료) */
export function passTarget(s: Ch3State, from: Ch3Player): Ch3Player | null {
  let best: Ch3Player | null = null;
  let bd = Infinity;
  for (const q of s.players) {
    if (q.id === from.id || !q.connected || !q.handUp) continue;
    const d = dist(q, from);
    if (d < PASS.min || d > PASS.max) continue;
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

/** 내려놓을 자리가 비어 있는가(울타리·장애물 안이 아니다) */
function freeSpot(p: { x: number; z: number }): boolean {
  return !CARRIER_COLLIDERS.some((c) => overlaps(p, 0.22, c));
}

/** 지금 행동하면 무엇을 하는지(미리보기와 실제 판정이 같이 쓴다) */
export function planAction(s: Ch3State, playerId: string): Ch3Action {
  const p = s.players.find((q) => q.id === playerId);
  if (!p || !p.connected || s.complete) return { kind: 'none' };
  const b = s.ball;
  if (b.carriedBy === playerId) {
    if (s.kongi.biting === playerId) return { kind: 'held' };
    const to = passTarget(s, p);
    if (to) return { kind: 'throw', to: to.id };
    const d = dropPoint(p);
    if (!freeSpot(d)) return { kind: 'blocked' };
    return inBallSpot(d) ? { kind: 'place' } : { kind: 'drop' };
  }
  if (!b.carriedBy && !b.flight && dist(p, b) <= PICK_RANGE) return { kind: 'pick' };
  return { kind: 'signal', up: !p.handUp };
}

export function step(state: Ch3State, inputs: Record<string, SewingInput>, dt: number): { state: Ch3State; events: Ch3Event[] } {
  const fx: Ch3Event[] = [];
  let s: Ch3State = { ...state, time: state.time + dt };

  // 1) 행동
  for (const p of s.players) {
    if (!inputs[p.id]?.actionDown) continue;
    const a = planAction(s, p.id);
    const me = s.players.find((q) => q.id === p.id)!;
    if (a.kind === 'pick') {
      s = { ...s, ball: { ...s.ball, carriedBy: p.id }, players: setHand(s, p.id, false) };
      // 콩이 바로 앞에서 집으면 잠깐 숨 돌릴 틈(곧장 물지 않게)
      if (s.kongi.mode === 'circle') s = { ...s, kongi: { ...s.kongi, mode: 'rest', left: 0.8, ax: s.kongi.x, az: s.kongi.z } };
      fx.push({ type: 'pick', playerId: p.id });
    } else if (a.kind === 'drop' || a.kind === 'place') {
      const d = dropPoint(me);
      s = { ...s, ball: { x: d.x, z: d.z, carriedBy: null, flight: null } };
      fx.push({ type: 'drop', playerId: p.id });
      if (a.kind === 'place' && !s.complete) {
        s = { ...s, complete: true, kongi: { ...s.kongi, mode: 'circle', biting: null, left: 0 } };
        fx.push({ type: 'complete' });
      }
    } else if (a.kind === 'throw') {
      const to = s.players.find((q) => q.id === a.to)!;
      const d = dist(me, to);
      s = {
        ...s,
        passes: s.passes + 1,
        ball: { x: me.x, z: me.z, carriedBy: null, flight: { x0: me.x, z0: me.z, x1: to.x, z1: to.z, t: 0, dur: PASS.base + PASS.per * d, from: p.id, to: to.id } },
      };
      fx.push({ type: 'throw', playerId: p.id, to: to.id });
    } else if (a.kind === 'signal') {
      s = { ...s, players: setHand(s, p.id, a.up) };
      fx.push({ type: 'signal', playerId: p.id, up: a.up });
    } else if (a.kind === 'blocked' || a.kind === 'held') {
      fx.push({ type: 'blocked', playerId: p.id });
    }
  }

  // 2) 이동: 콩이에게 리본을 물린 요정은 멈춘다. 공을 든 요정은 쪽문도 막힌다. 움직이면 든 손을 내린다
  s = {
    ...s,
    players: s.players.map((p) => {
      const inp = inputs[p.id];
      if (!p.connected || !inp || s.kongi.biting === p.id) return p.moving ? { ...p, moving: false } : p;
      const carrying = s.ball.carriedBy === p.id;
      const n = { ...p, ...stepPlayer(p, inp.move, dt, carrying ? CARRIER_WORLD : ELF_WORLD) };
      if (n.handUp && n.moving) n.handUp = false;
      return n;
    }),
  };

  // 3) 공: 든 요정을 따라간다 / 날아간다 → 받기 또는 안전 지점
  const b = s.ball;
  if (b.carriedBy) {
    const p = s.players.find((q) => q.id === b.carriedBy)!;
    s = { ...s, ball: { ...b, x: p.x, z: p.z } };
  } else if (b.flight) {
    const f = { ...b.flight, t: b.flight.t + dt };
    if (f.t < f.dur) {
      const k = f.t / f.dur;
      s = { ...s, ball: { ...b, x: f.x0 + (f.x1 - f.x0) * k, z: f.z0 + (f.z1 - f.z0) * k, flight: f } };
    } else {
      const to = s.players.find((q) => q.id === f.to);
      const land = { x: f.x1, z: f.z1 };
      if (to && to.connected && dist(to, land) <= PASS.catchR && s.ball.carriedBy === null) {
        s = { ...s, ball: { x: to.x, z: to.z, carriedBy: to.id, flight: null }, players: setHand(s, to.id, false) };
        fx.push({ type: 'catch', playerId: to.id });
      } else {
        const safe = SAFE[regionOf(land)];
        s = { ...s, ball: { x: safe.x, z: safe.z, carriedBy: null, flight: null } };
        fx.push({ type: 'miss', to: f.to });
      }
    }
  }

  // 4) 콩이
  s = stepKongi(s, dt, fx);
  return { state: s, events: fx };
}

function setHand(s: Ch3State, id: string, up: boolean): Ch3Player[] {
  return s.players.map((q) => (q.id === id ? { ...q, handUp: up } : q));
}

/** 공이 있는(또는 떨어질) 자리 */
function ballGoal(s: Ch3State): { x: number; z: number } {
  const f = s.ball.flight;
  return f ? { x: f.x1, z: f.z1 } : { x: s.ball.x, z: s.ball.z };
}

function moveKongi(k: Kongi, to: { x: number; z: number }, speed: number, dt: number, stopAt = 0): Kongi {
  const dx = to.x - k.x, dz = to.z - k.z;
  const d = Math.hypot(dx, dz);
  if (d <= stopAt + 1e-3) return { ...k, moving: false };
  const step = Math.min(speed * dt, d - stopAt);
  const n = moveCircle({ x: k.x, z: k.z }, { x: (dx / d) * step, z: (dz / d) * step }, KONGI.radius, KONGI_COLLIDERS, CH3_BOUNDS);
  return { ...k, x: n.x, z: n.z, facing: Math.atan2(dx, dz), moving: true };
}

function stepKongi(s: Ch3State, dt: number, fx: Ch3Event[]): Ch3State {
  let k = s.kongi;
  const goal = ballGoal(s);
  switch (k.mode) {
    case 'sleep':
      if (dist(k, goal) <= KONGI.wake) {
        k = { ...k, mode: 'chase' };
        fx.push({ type: 'wake' });
      }
      break;
    case 'chase': {
      const carrier = s.ball.carriedBy ? s.players.find((q) => q.id === s.ball.carriedBy)! : null;
      if (carrier && dist(k, carrier) <= KONGI.bite) {
        k = { ...k, mode: 'bite', left: KONGI.biteSec, biting: carrier.id, moving: false, facing: Math.atan2(carrier.x - k.x, carrier.z - k.z) };
        fx.push({ type: 'bite', playerId: carrier.id });
        break;
      }
      if (!carrier && !s.ball.flight && dist(k, goal) <= KONGI.circleR + 0.2) {
        k = { ...k, mode: 'circle', spin: Math.atan2(k.x - goal.x, k.z - goal.z) };
        break;
      }
      k = moveKongi(k, goal, KONGI.speed, dt, carrier ? KONGI.bite * 0.6 : KONGI.circleR);
      break;
    }
    case 'bite': {
      const carrier = s.players.find((q) => q.id === k.biting);
      k = { ...k, left: k.left - dt };
      if (!carrier || s.ball.carriedBy !== carrier.id || k.left <= 0) {
        // 놓아주고, 요정에게서 비켜 옆으로 가 앉는다(우회): 요정 → 콩이 방향을 90° 돌린 쪽
        const who = k.biting!;
        const c = carrier ?? k;
        let ox = k.x - c.x, oz = k.z - c.z;
        const od = Math.hypot(ox, oz) || 1;
        ox /= od;
        oz /= od;
        const side = (Math.floor(s.time * 7) + s.seed) % 2 === 0 ? 1 : -1;
        const ax = c.x + (ox * 0.6 - oz * side) * KONGI.away, az = c.z + (oz * 0.6 + ox * side) * KONGI.away;
        k = { ...k, mode: 'rest', left: KONGI.restSec, biting: null, ax, az };
        fx.push({ type: 'release', playerId: who });
      }
      break;
    }
    case 'rest': {
      k = { ...moveKongi(k, { x: k.ax, z: k.az }, KONGI.runAway, dt), left: k.left - dt };
      if (k.left <= 0) k = { ...k, mode: s.complete ? 'circle' : 'chase', moving: false };
      break;
    }
    case 'circle': {
      // 공 둘레를 빙빙(완료 뒤에도). 공을 누가 들거나 날아가면 다시 쫓는다
      if (!s.complete && (s.ball.carriedBy || s.ball.flight)) {
        k = { ...k, mode: 'chase' };
        break;
      }
      const spin = k.spin + (KONGI.speed * 0.6 * dt) / KONGI.circleR;
      const want = { x: goal.x + Math.sin(spin) * KONGI.circleR, z: goal.z + Math.cos(spin) * KONGI.circleR };
      const n = moveKongi(k, want, KONGI.speed, dt);
      k = { ...n, spin, facing: Math.atan2(Math.cos(spin), -Math.sin(spin)) };
      break;
    }
  }
  return { ...s, kongi: k };
}

/** 시험용: 요정 반지름 */
export const CH3_ELF_RADIUS = ELF_RADIUS;

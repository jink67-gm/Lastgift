// 5장·6장 놀이 규칙(명세서 §5 5·6장). 방장만 계산한다. three.js·DOM 없음.
//
// 5장: 산타 얼굴이 수놓인 빨간 양말 앞에서 행동 → 입구를 살짝 벌려 들여다본다(텅 비었다).
//   둘 이상이면 서로 다른 두 요정이, 혼자면 한 번 들여다보면 "빈 양말을 확인했다".
//   그 뒤 배달 가방 앞에서 행동 → 가방을 연다(한 번만) → 'opened'(팀 시계 openBag: 네 빛 → 스노글로브 하나, 연 요정이 든다).
// 6장: 스노글로브를 든 요정이 산타 앞에서 행동 → 'deliver'(팀 시계 deliver: 자동 전달 없음, 그 순간 시계 정지).
//   아무도 안 들고 있으면(나간 요정이 들고 있었으면) 안전 지점에 있다 → 가까이에서 행동으로 든다('take').
import { stepPlayer, type PlayerState, type World } from './player';
import type { SewingInput } from './sewing';
import { BAG, FINALE_BOUNDS, FINALE_COLLIDERS, FINALE_REACH, GLOBE_SAFE, SANTA_SPOT, STOCKING } from '../data/finale';

export const CAMERA_YAW = Math.PI / 4;

export interface FinalePlayer extends PlayerState {
  id: string;
  connected: boolean;
}

export interface FinaleState {
  chapter: 5 | 6;
  players: FinalePlayer[];
  /** 빈 양말을 들여다본 요정(차례대로) */
  peeked: string[];
  /** 가방을 열었다(5장 끝) */
  opened: boolean;
  /** 스노글로브(6장): 든 요정, 바닥이면 자리 */
  globe: { holder: string | null; x: number; z: number } | null;
  delivered: boolean;
}

export type FinaleEvent =
  | { type: 'peek'; playerId: string; first: boolean }
  | { type: 'stockingChecked' }
  | { type: 'opened'; playerId: string }
  | { type: 'take'; playerId: string }
  | { type: 'deliver'; playerId: string }
  | { type: 'notYet'; playerId: string };

export type FinaleAction =
  | { kind: 'peek' }
  | { kind: 'openBag' }
  | { kind: 'take' }
  | { kind: 'deliver' }
  | { kind: 'notYet' }
  | { kind: 'none' };

const WORLD: World = { colliders: FINALE_COLLIDERS, bounds: FINALE_BOUNDS, cameraYaw: CAMERA_YAW };
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export function createFinale(
  chapter: 5 | 6,
  players: readonly { id: string; x: number; z: number; facing: number }[],
  globeHolder: string | null = null,
): FinaleState {
  return {
    chapter,
    players: players.map((p) => ({ ...p, moving: false, connected: true })),
    peeked: [],
    opened: false,
    globe: chapter === 6 ? { holder: globeHolder, x: GLOBE_SAFE.x, z: GLOBE_SAFE.z } : null,
    delivered: false,
  };
}

/** 빈 양말을 확인했는가: 둘 이상이면 서로 다른 두 요정, 혼자면 한 번 */
export function stockingChecked(s: FinaleState): boolean {
  const n = s.players.filter((p) => p.connected).length;
  return s.peeked.length >= Math.min(2, Math.max(1, n));
}

export function planAction(s: FinaleState, playerId: string): FinaleAction {
  const p = s.players.find((q) => q.id === playerId);
  if (!p || !p.connected || s.delivered) return { kind: 'none' };
  if (s.chapter === 5) {
    if (s.opened) return { kind: 'none' };
    if (dist(p, STOCKING) <= FINALE_REACH.stocking + STOCKING.r && !s.peeked.includes(playerId)) return { kind: 'peek' };
    if (dist(p, BAG) <= FINALE_REACH.bag + BAG.r) return stockingChecked(s) ? { kind: 'openBag' } : { kind: 'notYet' };
    return { kind: 'none' };
  }
  const g = s.globe;
  if (!g) return { kind: 'none' };
  if (g.holder === playerId) return dist(p, SANTA_SPOT) <= FINALE_REACH.santa ? { kind: 'deliver' } : { kind: 'none' };
  if (g.holder === null && dist(p, g) <= FINALE_REACH.globe) return { kind: 'take' };
  return { kind: 'none' };
}

export function step(state: FinaleState, inputs: Record<string, SewingInput>, dt: number): { state: FinaleState; events: FinaleEvent[] } {
  const fx: FinaleEvent[] = [];
  let s = state;
  for (const p of s.players) {
    if (!inputs[p.id]?.actionDown) continue;
    const a = planAction(s, p.id);
    if (a.kind === 'peek') {
      const was = stockingChecked(s);
      s = { ...s, peeked: [...s.peeked, p.id] };
      fx.push({ type: 'peek', playerId: p.id, first: s.peeked.length === 1 });
      if (!was && stockingChecked(s)) fx.push({ type: 'stockingChecked' });
    } else if (a.kind === 'openBag') {
      s = { ...s, opened: true };
      fx.push({ type: 'opened', playerId: p.id });
    } else if (a.kind === 'take') {
      s = { ...s, globe: { ...s.globe!, holder: p.id } };
      fx.push({ type: 'take', playerId: p.id });
    } else if (a.kind === 'deliver') {
      s = { ...s, delivered: true };
      fx.push({ type: 'deliver', playerId: p.id });
    } else if (a.kind === 'notYet') {
      fx.push({ type: 'notYet', playerId: p.id });
    }
  }
  // 이동(가방을 열었거나 건넨 뒤엔 연출이 이어지므로 멈춘다)
  const frozen = (s.chapter === 5 && s.opened) || s.delivered;
  s = {
    ...s,
    players: s.players.map((p) => {
      const inp = inputs[p.id];
      if (frozen || !p.connected || !inp) return p.moving ? { ...p, moving: false } : p;
      return { ...p, ...stepPlayer(p, inp.move, dt, WORLD) };
    }),
  };
  // 든 스노글로브는 든 요정을 따라간다
  if (s.globe?.holder) {
    const h = s.players.find((q) => q.id === s.globe!.holder);
    if (h) s = { ...s, globe: { ...s.globe, x: h.x, z: h.z } };
  }
  return { state: s, events: fx };
}

/** 요정이 나갔다: 들고 있던 스노글로브는 안전 지점에 남는다(팀 시계 playerLeft와 같은 규칙) */
export function leave(s: FinaleState, playerId: string): FinaleState {
  const players = s.players.map((p) => (p.id === playerId ? { ...p, connected: false, moving: false } : p));
  const globe = s.globe?.holder === playerId ? { holder: null, x: GLOBE_SAFE.x, z: GLOBE_SAFE.z } : s.globe;
  return { ...s, players, globe };
}

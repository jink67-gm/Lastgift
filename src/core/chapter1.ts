// 1장 규칙(명세서 §5 1장) — 04-4a: 우편함 골목에서 유나네 찾기. 방장만 계산한다. three.js·DOM 없음.
//
// - 가벼운 선물 둘(스케치북·색연필 통)은 혼자 들고 놓는다(core/carry).
// - 지우의 그림 지도: 빈손이고 집을 것이 가까이 없을 때 행동 버튼 → 지도를 편다(편 동안은 서서 읽는다). 한 번 더 → 접는다.
//   선물을 든 요정은 손이 차서 지도를 펴지 못한다 → 한 명은 지도를 읽고 한 명은 찾아 걷게 된다.
// - 유나네 앞마당(낮은 담 안)에 처음 들어서면 "찾았다"(한 번만). 망보기·현관 배달은 04-4b에서 잇는다.
import { applyAction, chooseTarget, planAction as planCarry, PICK_RANGE, type Item } from './carry';
import { stepPlayer, type PlayerState, type World } from './player';
import type { SewingInput } from './sewing';
import { CH1_BOUNDS, CH1_START, CH1_WALLS, inYunasYard } from '../data/chapter1';

export const CAMERA_YAW = Math.PI / 4;

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
}

export type Ch1Event =
  | { type: 'pick'; playerId: string; itemId: string }
  | { type: 'drop'; playerId: string; itemId: string }
  | { type: 'blocked'; playerId: string; itemId: string }
  | { type: 'map'; playerId: string; open: boolean }
  | { type: 'found'; playerId: string };

export type Ch1Action =
  | { kind: 'pick'; itemId: string }
  | { kind: 'drop'; itemId: string }
  | { kind: 'blocked'; itemId: string }
  | { kind: 'map'; open: boolean }
  | { kind: 'none' };

const WORLD: World = { colliders: CH1_WALLS, bounds: CH1_BOUNDS, cameraYaw: CAMERA_YAW };

export function createChapter1(playerIds: readonly string[]): Ch1State {
  return {
    players: playerIds.map((id, i) => {
      const sp = CH1_START.spawns[i % CH1_START.spawns.length]!;
      // 시작은 골목 쪽(화면 위)을 본다
      return { id, x: sp.x, z: sp.z, facing: Math.PI + Math.PI / 4, moving: false, connected: true, mapOpen: false };
    }),
    items: CH1_START.items.map((it) => ({ id: it.id, x: it.x, z: it.z, light: true, carriedBy: null })),
    found: false,
  };
}

/** 지금 행동하면 무엇을 하는지(미리보기와 실제 판정이 같이 쓴다) */
export function planAction(s: Ch1State, playerId: string): Ch1Action {
  const p = s.players.find((q) => q.id === playerId);
  if (!p || !p.connected) return { kind: 'none' };
  if (p.mapOpen) return { kind: 'map', open: false };
  const held = s.items.find((i) => i.carriedBy === playerId);
  if (held) {
    const a = planCarry(playerId, p, s.items, CH1_WALLS, CH1_BOUNDS);
    return a.kind === 'drop' ? { kind: 'drop', itemId: a.itemId } : { kind: 'blocked', itemId: held.id };
  }
  const t = chooseTarget(p, s.items);
  if (t && Math.hypot(t.x - p.x, t.z - p.z) <= PICK_RANGE) return { kind: 'pick', itemId: t.id };
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
    } else if (a.kind === 'drop') {
      const me = s.players.find((q) => q.id === p.id)!;
      const plan = planCarry(p.id, me, s.items, CH1_WALLS, CH1_BOUNDS);
      if (plan.kind === 'drop') {
        s = { ...s, items: applyAction(p.id, s.items, plan) as Item[] };
        fx.push({ type: 'drop', playerId: p.id, itemId: a.itemId });
      }
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
  return { state: s, events: fx };
}

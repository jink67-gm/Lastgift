// 0장 선물 분류 규칙(명세서 §5 0장). 방장만 계산한다. three.js·DOM에 의존하지 않는다.
//
// - 가벼운 선물 네 개는 혼자 들고 놓는다(core/carry). 재봉틀은 두 요정이 양끝을 함께 든다(core/sewing, 'ch0' 배치).
// - 그림 표식 자리에 놓으면: 목적지가 맞으면 그 자리에 고정, 틀리면 원래 자리로 돌아가 다시 집을 수 있다.
// - 재봉틀을 수선집 표식에 내려놓으면 고정, 다른 표식에 내려놓으면 원래 자리로 돌아간다.
// - 네 선물과 재봉틀(양끝 함께 들기를 해야만 옮길 수 있다)이 모두 제자리면 0장 완료(한 번만).
import { applyAction, chooseTarget, planAction as planCarry, PICK_RANGE, type Item } from './carry';
import type { Collider } from './collision';
import { createSewing, crateObb, gripPos, layoutOf, planAction as planSewing, step as sewingStep, type SewingEvent, type SewingInput, type SewingState } from './sewing';
import { MARKERS, SORT_GIFTS, type Dest } from '../data/chapter0';

export interface SortItem extends Item {
  dest: Dest;
  homeX: number;
  homeZ: number;
  sorted: boolean;
}

export interface SortState {
  sewing: SewingState;
  items: SortItem[];
  crateSorted: boolean;
  complete: boolean;
}

export type SortEvent =
  | { type: 'pick'; playerId: string; itemId: string }
  | { type: 'drop'; playerId: string; itemId: string }
  | { type: 'sorted'; itemId: string; dest: Dest }
  | { type: 'wrong'; itemId: string; dest: Dest }
  | { type: 'blocked'; playerId: string; itemId: string }
  | { type: 'complete' }
  | { type: 'sewing'; event: SewingEvent };

/** 지금 행동하면 무엇을 하는지(미리보기와 실제 판정이 같이 쓴다) */
export type SortAction =
  | { kind: 'pick'; itemId: string }
  | { kind: 'drop'; itemId: string }
  | { kind: 'blocked'; itemId: string }
  | { kind: 'sewing'; sub: ReturnType<typeof planSewing> }
  | { kind: 'none' };

export function createSorting(playerIds: readonly string[]): SortState {
  return {
    sewing: createSewing(playerIds, 'ch0'),
    items: SORT_GIFTS.map((g) => ({ id: g.id, x: g.x, z: g.z, light: g.light, carriedBy: null, dest: g.dest, homeX: g.x, homeZ: g.z, sorted: false })),
    crateSorted: false,
    complete: false,
  };
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** 이 점이 들어 있는 표식(없으면 null) */
export function markerAt(p: { x: number; z: number }) {
  return MARKERS.find((m) => dist(p, m) <= m.r) ?? null;
}

function dropColliders(s: SortState): Collider[] {
  return [...layoutOf(s.sewing).walls, crateObb(s.sewing.crate)];
}

export function planAction(s: SortState, playerId: string): SortAction {
  const p = s.sewing.players.find((q) => q.id === playerId);
  if (!p || !p.connected || s.complete) return { kind: 'none' };
  const held = s.items.find((i) => i.carriedBy === playerId);
  if (held || p.holding !== null) {
    if (p.holding !== null) return { kind: 'sewing', sub: planSewing(s.sewing, playerId) };
    const a = planCarry(playerId, p, s.items, dropColliders(s), layoutOf(s.sewing).bounds);
    return a.kind === 'drop' ? { kind: 'drop', itemId: a.itemId } : { kind: 'blocked', itemId: held!.id };
  }
  // 맨손: 가까운 선물과 재봉틀 손잡이 중 더 가까운 쪽
  const pickable = s.items.filter((i) => !i.sorted);
  const item = chooseTarget(p, pickable);
  const sew = s.crateSorted ? ({ kind: 'none' } as const) : planSewing(s.sewing, playerId);
  const itemD = item ? dist(p, item) : Infinity;
  const sewD = sew.kind === 'grab' || sew.kind === 'handover' ? dist(p, gripPos(s.sewing.crate, sew.handle)) : Infinity;
  if (item && itemD <= PICK_RANGE && itemD <= sewD) return { kind: 'pick', itemId: item.id };
  if (sewD < Infinity) return { kind: 'sewing', sub: sew };
  return { kind: 'none' };
}

/** 선물 하나를 놓은 뒤: 표식 판정 */
function settleItem(s: SortState, itemId: string, fx: SortEvent[]): SortState {
  const it = s.items.find((i) => i.id === itemId)!;
  const m = markerAt(it);
  if (!m) return s;
  if (m.dest === it.dest) {
    // 놓는 자리 안에서 선물끼리 겹치지 않게 칸을 나눠 고정한다
    const n = s.items.filter((i) => i.sorted && i.dest === m.dest).length;
    const slot = { x: m.x + (n === 0 ? -0.45 : 0.45), z: m.z };
    fx.push({ type: 'sorted', itemId, dest: m.dest });
    return { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, ...slot, sorted: true } : i)) };
  }
  fx.push({ type: 'wrong', itemId, dest: m.dest });
  return { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, x: i.homeX, z: i.homeZ } : i)) };
}

function checkComplete(s: SortState, fx: SortEvent[]): SortState {
  if (s.complete || !s.crateSorted || !s.items.every((i) => i.sorted)) return s;
  fx.push({ type: 'complete' });
  return { ...s, complete: true };
}

export function step(state: SortState, inputs: Record<string, SewingInput>, dt: number): { state: SortState; events: SortEvent[] } {
  const fx: SortEvent[] = [];
  let s = state;
  const sewInputs: Record<string, SewingInput> = {};

  // 1) 행동 나누기: 가벼운 선물 쪽이면 여기서 처리하고, 재봉틀 쪽이면 운반 규칙으로 넘긴다
  for (const p of s.sewing.players) {
    const inp = inputs[p.id];
    sewInputs[p.id] = inp ? { ...inp, actionDown: false } : { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
    if (!inp?.actionDown) continue;
    const a = planAction(s, p.id);
    if (a.kind === 'pick') {
      s = { ...s, items: applyAction(p.id, s.items, { kind: 'pick', itemId: a.itemId }) as SortItem[] };
      fx.push({ type: 'pick', playerId: p.id, itemId: a.itemId });
    } else if (a.kind === 'drop') {
      const plan = planCarry(p.id, p, s.items, dropColliders(s), layoutOf(s.sewing).bounds);
      if (plan.kind === 'drop') {
        s = { ...s, items: applyAction(p.id, s.items, plan) as SortItem[] };
        fx.push({ type: 'drop', playerId: p.id, itemId: a.itemId });
        s = settleItem(s, a.itemId, fx);
      }
    } else if (a.kind === 'blocked') {
      fx.push({ type: 'blocked', playerId: p.id, itemId: a.itemId });
    } else if (a.kind === 'sewing') {
      sewInputs[p.id] = { ...sewInputs[p.id]!, actionDown: true };
    }
  }

  // 2) 재봉틀 운반과 모든 요정의 이동(가벼운 선물을 든 요정도 맨몸 요정처럼 걷는다)
  const r = sewingStep(s.sewing, sewInputs, dt);
  s = { ...s, sewing: r.state };
  for (const e of r.events) {
    fx.push({ type: 'sewing', event: e });
    if (e.type === 'delivered' && !s.crateSorted) {
      s = { ...s, crateSorted: true };
      fx.push({ type: 'sorted', itemId: 'sewing', dest: 'tailor' });
    }
    if (e.type === 'release' && e.place === 'ground') {
      // 재봉틀을 다른 표식에 내려놓았다 → 원래 자리로
      const m = markerAt(s.sewing.crate);
      if (m && m.dest !== 'tailor') {
        const L = layoutOf(s.sewing);
        fx.push({ type: 'wrong', itemId: 'sewing', dest: m.dest });
        s = {
          ...s,
          sewing: {
            ...s.sewing,
            crate: { ...L.crateStart, lifted: false, place: 'ground' },
            handles: [null, null],
            players: s.sewing.players.map((q) => (q.holding !== null ? { ...q, holding: null } : q)),
          },
        };
      }
    }
  }

  // 3) 들고 있는 선물은 든 요정을 따라다닌다(놓을 때 앞쪽으로 내려놓는다)
  s = {
    ...s,
    items: s.items.map((i) => {
      if (!i.carriedBy) return i;
      const p = s.sewing.players.find((q) => q.id === i.carriedBy);
      return p ? { ...i, x: p.x, z: p.z } : i;
    }),
  };
  return { state: checkComplete(s, fx), events: fx };
}

/** 연결이 끊긴 요정: 들고 있던 선물은 원래 자리로 */
export function dropAllOf(s: SortState, playerId: string): SortState {
  return { ...s, items: s.items.map((i) => (i.carriedBy === playerId ? { ...i, carriedBy: null, x: i.homeX, z: i.homeZ } : i)) };
}

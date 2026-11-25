// 가벼운 물건 들기·놓기. 가까운 대상 하나를 고르는 규칙은 미리보기와 실제 행동이 같은 함수를 쓴다.
import { overlaps, type Bounds, type Collider } from './collision';
import type { PlayerState } from './player';

export interface Item {
  id: string;
  x: number;
  z: number;
  light: boolean;
  /** 들고 있는 플레이어 ID. 바닥에 있으면 null */
  carriedBy: string | null;
  /** 길쭉한 물건의 중심에서 끝까지 길이(m). 이만큼 멀리서도 손이 닿는다 */
  reach?: number;
}

export const PICK_RANGE = 1.2; // m, 요정 중심에서 물건 중심까지
export const PICK_CLOSE = 0.75; // m, 이 안이면 방향과 상관없이 고를 수 있다
export const PICK_CONE = (75 * Math.PI) / 180; // 바라보는 방향 ±75°
export const DROP_AHEAD = 0.75; // m, 내려놓는 위치(요정 앞)
const ITEM_RADIUS = 0.25;

export type Action =
  | { kind: 'pick'; itemId: string }
  | { kind: 'drop'; itemId: string; x: number; z: number }
  | { kind: 'tooHeavy'; itemId: string }
  | { kind: 'blocked'; itemId: string }
  | { kind: 'none' };

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

/** 바라보는 방향과 거리로 가까운 대상 하나를 고른다. 없으면 null */
export function chooseTarget(p: PlayerState, items: readonly Item[]): Item | null {
  let best: Item | null = null;
  let bestScore = Infinity;
  for (const it of items) {
    if (it.carriedBy !== null) continue;
    const dx = it.x - p.x;
    const dz = it.z - p.z;
    const center = Math.hypot(dx, dz);
    const d = Math.max(0, center - (it.reach ?? 0));
    if (d > PICK_RANGE) continue;
    const ang = center < 1e-6 ? 0 : angleDiff(Math.atan2(dx, dz), p.facing);
    if (ang > PICK_CONE && d > PICK_CLOSE) continue;
    // 거리 1 m와 각도 90°를 비슷한 무게로 본다
    const score = d + ang * 0.6;
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

export function dropPoint(p: PlayerState): { x: number; z: number } {
  return { x: p.x + Math.sin(p.facing) * DROP_AHEAD, z: p.z + Math.cos(p.facing) * DROP_AHEAD };
}

/** 지금 행동 버튼을 누르면 일어날 일(미리보기와 실제 판정에 같이 쓴다) */
export function planAction(
  playerId: string,
  p: PlayerState,
  items: readonly Item[],
  colliders: readonly Collider[],
  bounds: Bounds,
): Action {
  const held = items.find((i) => i.carriedBy === playerId);
  if (held) {
    const at = dropPoint(p);
    const inside =
      at.x - ITEM_RADIUS >= bounds.minX && at.x + ITEM_RADIUS <= bounds.maxX &&
      at.z - ITEM_RADIUS >= bounds.minZ && at.z + ITEM_RADIUS <= bounds.maxZ;
    if (!inside || colliders.some((c) => overlaps(at, ITEM_RADIUS, c))) return { kind: 'blocked', itemId: held.id };
    return { kind: 'drop', itemId: held.id, ...at };
  }
  const target = chooseTarget(p, items);
  if (!target) return { kind: 'none' };
  if (!target.light) return { kind: 'tooHeavy', itemId: target.id };
  return { kind: 'pick', itemId: target.id };
}

/** 행동을 적용한 새 물건 목록. 바뀐 것이 없으면 같은 배열을 돌려준다. */
export function applyAction(playerId: string, items: readonly Item[], a: Action): readonly Item[] {
  if (a.kind === 'pick') {
    // 한 사람은 하나만 들고, 이미 누가 든 물건은 집을 수 없다
    if (items.some((i) => i.carriedBy === playerId)) return items;
    const t = items.find((i) => i.id === a.itemId);
    if (!t || t.carriedBy !== null || !t.light) return items;
    return items.map((i) => (i.id === a.itemId ? { ...i, carriedBy: playerId } : i));
  }
  if (a.kind === 'drop') {
    const t = items.find((i) => i.id === a.itemId);
    if (!t || t.carriedBy !== playerId) return items;
    return items.map((i) => (i.id === a.itemId ? { ...i, carriedBy: null, x: a.x, z: a.z } : i));
  }
  return items;
}

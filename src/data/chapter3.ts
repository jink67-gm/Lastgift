// 3장 · 축구공 주위를 맴도는 콩이 — 공간(명세서 §3.2 "작업실 옆문 → 울타리 샛길 → 민재네 마당", §5 3장).
// 길 좌표(data/lane.ts): s = 화면 위쪽으로 길을 따라, t = 화면 오른쪽.
//
//   작업실 뒤뜰(시작, 공은 요정 발치) ─ 울타리①(쪽문 오른쪽) ─ 샛길(장작 더미·콩이의 상자)
//   ─ 울타리②(쪽문 왼쪽) ─ 가운데 울타리로 나뉜 두 줄(왼쪽 줄 → 가운데 쪽문 → 오른쪽 줄)
//   ─ 민재네 마당 울타리(오른쪽 줄 앞에 열린 대문) ─ 민재네 마당(대문 안쪽에 공을 내려놓는다)
//
// - 낮은 울타리는 사람 허리 높이(요정 키보다 높다): 요정은 넘지 못하지만 공은 위로 던질 수 있다.
// - 쪽문은 두 손으로 밀어야 열린다 → 공을 든 요정은 지나가지 못한다. 빈손 요정만 돌아 들어간다(요정의 우회로).
//   그래서 공은 울타리 너머로 던져 받으며 간다. 울타리 하나를 양쪽에서 보는 구간은 모두 같은 플레이 공간이다.
// - 콩이는 울타리 밑으로 빠져 공(리본)을 향해 곧장 달린다(콩이의 경로).
import type { Bounds, Collider } from '../core/collision';
import { HOUSE_HALF, HOUSE_SCALE } from './chapter1';
import { W, laneCircle, laneWall, toLane } from './lane';

export { W, toLane };

/** 샛길 반폭(양옆 높은 판자 울타리까지) */
export const PATH_HALF = 5.2;
/** 쪽문 폭 */
export const GATE_W = 1.6;

/** 가로지르는 울타리(s)와 쪽문 자리(t 구간) */
export const FENCES = {
  /** 작업실 뒤뜰 ↔ 샛길: 쪽문은 오른쪽 */
  first: { s: 9, gate: [2.8, 2.8 + GATE_W] as const },
  /** 샛길 ↔ 두 줄: 쪽문은 왼쪽 */
  second: { s: 21, gate: [-2.8 - GATE_W, -2.8] as const },
  /** 두 줄 사이 가운데 울타리(t = 0, s 구간)와 그 쪽문(s 구간) */
  middle: { t: 0, s: [21, 33] as const, gate: [29.2, 29.2 + GATE_W] as const },
  /** 민재네 마당 울타리: 오른쪽 줄 앞이 열린 대문(누구나 지나간다) */
  yard: { s: 33, gate: [1.0, 4.2] as const },
} as const;

/** 뒤뜰 아래 끝(s)과 왼쪽 옆 공방의 옆문 자리(s) */
export const WORKSHOP = { s: -6, door: -1.5 };
/** 민재네 집(가운데, 앞면이 사진기 쪽) */
export const MINJAE_HOUSE = { s: 44 + HOUSE_HALF.d, t: -0.6, scale: HOUSE_SCALE };
/** 민재네 마당 뒤(집 앞면) */
export const YARD_BACK = MINJAE_HOUSE.s - HOUSE_HALF.d;

/** 공을 내려놓는 곳: 열린 대문 안쪽(민재와 콩이가 만나는 자리) */
export const BALL_SPOT = { s: 36.6, t: 2.6, r: 1.5 };

/** 샛길의 장애물(요정·콩이 모두 돌아간다, 공은 위로 넘어간다) */
export const OBSTACLES = [
  { id: 'logs', s: 13.2, t: 1.6, r: 1.1 },
  { id: 'box', s: 16.4, t: -4.3, r: 0.75 }, // 콩이가 지내는 종이 상자
  { id: 'sled', s: 26.0, t: -2.4, r: 0.8 }, // 왼쪽 줄의 기대 놓은 썰매
  { id: 'drift', s: 25.0, t: 3.4, r: 0.9 }, // 오른쪽 줄 눈더미
] as const;

/** 콩이가 처음 있는 자리(상자 옆에 웅크림) */
export const KONGI_DEN = W(17.4, -3.6);

/** 구역(안전 지점을 고르는 단위) */
export type Region = 'yard0' | 'alley' | 'left' | 'right' | 'yard';

export function regionOf(p: { x: number; z: number }): Region {
  const { s, t } = toLane(p);
  if (s < FENCES.first.s) return 'yard0';
  if (s < FENCES.second.s) return 'alley';
  if (s < FENCES.yard.s) return t < FENCES.middle.t ? 'left' : 'right';
  return 'yard';
}

/** 구역마다 공이 돌아가는 안전 지점(받을 요정이 자리를 떠나면 공이 여기로) */
export const SAFE: Record<Region, { x: number; z: number }> = {
  yard0: W(4, 0),
  alley: W(17.5, 2.6),
  left: W(28, -2.8),
  right: W(24.6, 1.6),
  yard: W(36.4, -1.2),
};

/** 시작: 작업실 옆문 앞. 공은 요정 발치 */
export const CH3_START = {
  spawns: [W(-1.5, -3.6), W(-0.2, -2.4), W(-3, -3), W(-1.8, -1.2)],
  ball: W(-0.4, -3.9),
};

const HALF = PATH_HALF;
const T = 0.3;

/** 낮은 울타리(요정은 못 넘고, 공은 넘어간다). 쪽문 자리는 비워 둔다 */
function lowFences(): Collider[] {
  const c: Collider[] = [];
  const cross = (s: number, gap: readonly [number, number]) => {
    c.push(laneWall({ s, t: -HALF }, { s, t: gap[0] }, T));
    c.push(laneWall({ s, t: gap[1] }, { s, t: HALF }, T));
  };
  cross(FENCES.first.s, FENCES.first.gate);
  cross(FENCES.second.s, FENCES.second.gate);
  cross(FENCES.yard.s, FENCES.yard.gate);
  const m = FENCES.middle;
  c.push(laneWall({ s: m.s[0], t: m.t }, { s: m.gate[0], t: m.t }, T));
  c.push(laneWall({ s: m.gate[1], t: m.t }, { s: m.s[1], t: m.t }, T));
  return c;
}

/** 쪽문(공을 든 요정만 막는다) */
export const GATES = [
  { id: 'first', a: { s: FENCES.first.s, t: FENCES.first.gate[0] }, b: { s: FENCES.first.s, t: FENCES.first.gate[1] } },
  { id: 'second', a: { s: FENCES.second.s, t: FENCES.second.gate[0] }, b: { s: FENCES.second.s, t: FENCES.second.gate[1] } },
  { id: 'middle', a: { s: FENCES.middle.gate[0], t: FENCES.middle.t }, b: { s: FENCES.middle.gate[1], t: FENCES.middle.t } },
] as const;
export const GATE_COLLIDERS: readonly Collider[] = GATES.map((g) => laneWall(g.a, g.b, T));

/** 바깥 테두리(작업실 벽·양옆 높은 판자 울타리·민재네 집)와 장애물: 모두(콩이 포함) 막는다 */
function outer(): Collider[] {
  const c: Collider[] = [];
  c.push(laneWall({ s: WORKSHOP.s, t: -HALF - 1 }, { s: WORKSHOP.s, t: HALF + 1 }, 0.6));
  c.push(laneWall({ s: WORKSHOP.s, t: -HALF }, { s: YARD_BACK + 1, t: -HALF }, 0.4));
  c.push(laneWall({ s: WORKSHOP.s, t: HALF }, { s: YARD_BACK + 1, t: HALF }, 0.4));
  // 민재네 집 몸통
  const h = W(MINJAE_HOUSE.s, MINJAE_HOUSE.t);
  c.push({ kind: 'obb', x: h.x, z: h.z, yaw: Math.PI / 4, ha: HOUSE_HALF.d + 0.2, hb: HOUSE_HALF.w + 0.2 });
  c.push(laneWall({ s: YARD_BACK, t: -HALF }, { s: YARD_BACK, t: HALF }, 0.4));
  for (const o of OBSTACLES) c.push(laneCircle(o.s, o.t, o.r * 0.85));
  return c;
}

export const OUTER_COLLIDERS: readonly Collider[] = outer();
export const LOW_FENCE_COLLIDERS: readonly Collider[] = lowFences();

/** 요정(빈손): 바깥 + 낮은 울타리. 쪽문은 지나간다 */
export const ELF_COLLIDERS: readonly Collider[] = [...OUTER_COLLIDERS, ...LOW_FENCE_COLLIDERS];
/** 공을 든 요정: 쪽문도 막힌다 */
export const CARRIER_COLLIDERS: readonly Collider[] = [...ELF_COLLIDERS, ...GATE_COLLIDERS];
/** 콩이: 울타리 밑으로 빠진다(바깥·장애물만) */
export const KONGI_COLLIDERS: readonly Collider[] = OUTER_COLLIDERS;

export const CH3_BOUNDS: Bounds = (() => {
  const pts = [W(-8, -HALF - 2), W(-8, HALF + 2), W(YARD_BACK + 2, -HALF - 2), W(YARD_BACK + 2, HALF + 2)];
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minZ: Math.min(...pts.map((p) => p.z)),
    maxZ: Math.max(...pts.map((p) => p.z)),
  };
})();

export function inBallSpot(p: { x: number; z: number }): boolean {
  const { s, t } = toLane(p);
  return Math.hypot(s - BALL_SPOT.s, t - BALL_SPOT.t) <= BALL_SPOT.r;
}

/** 쪽문 가운데(월드)와 가까이 있는가 */
export function nearGate(p: { x: number; z: number }, r = 1.6): (typeof GATES)[number] | null {
  const { s, t } = toLane(p);
  return GATES.find((g) => Math.hypot(s - (g.a.s + g.b.s) / 2, t - (g.a.t + g.b.t) / 2) <= r) ?? null;
}

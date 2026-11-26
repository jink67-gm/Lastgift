// 4장 · 할머니의 트리에 다시 불이 켜지면 — 공간(명세서 §3.2 "눈 덮인 담장길 → 할머니네 정원", §4 4장, §5 4장).
// 길 좌표(data/lane.ts): s = 화면 위쪽으로 길을 따라, t = 화면 오른쪽.
//
//   눈 덮인 담장길(시작: 수리 상자에서 꺼낸 도토의 손발전기·연결판이 발치에) ─ 정원 담장과 정원문
//   (담장 너머로 불 꺼진 트리 꼭대기가 보인다) ─ 할머니네 정원: 가운데 큰 트리, 그 뒤 할머니네 집.
//   눈에 반쯤 묻힌 큰 장식을 피해 발전기·연결판을 트리 앞 자리에 놓는다 → 전선 셋을 같은 표시 단자에 →
//   발전기 손잡이를 길게 돌려 충전 → 트리 양쪽 스위치 둘. 발전기·두 스위치는 한 공간(정원)에 있다.
import type { Bounds, Collider } from '../core/collision';
import { ELF_SPEED } from '../core/player';
import { HOUSE_HALF, HOUSE_SCALE } from './chapter1';
import { W, laneCircle, laneWall, toLane } from './lane';

export { W, toLane };

/** 담장길 반폭 */
export const LANE_HALF = 3.2;
/** 정원 담장(s)과 정원문(t 구간) */
export const GARDEN_WALL = { s: 14, gate: [-1.4, 1.4] as const, height: 2.1 };
/** 정원: 담장 ~ 할머니네 집 앞, 좌우 */
export const GARDEN = { front: 14, back: 35, half: 10.5 };
/** 할머니네 집(정원 뒤, 앞면이 사진기 쪽) */
export const GRANDMA_HOUSE = { s: GARDEN.back + HOUSE_HALF.d, t: 2.5, scale: HOUSE_SCALE };

/** 트리(정원 가운데): 줄기·아래 가지 반지름, 높이 */
export const TREE = { s: 25, t: 0, r: 2.0, height: 9.5 };

export type WireColor = 'red' | 'blue' | 'yellow';
export type WireShape = 'circle' | 'triangle' | 'square';
/** 전선 셋: 색과 도형이 함께 대응한다(빨강·동그라미, 파랑·세모, 노랑·네모) */
export const WIRES: readonly { color: WireColor; shape: WireShape }[] = [
  { color: 'red', shape: 'circle' },
  { color: 'blue', shape: 'triangle' },
  { color: 'yellow', shape: 'square' },
];

/** 트리 밑동 단자(같은 표시의 전선을 끼운다): 왼쪽·앞·오른쪽. 연결판 위 전선 순서(노랑·빨강·파랑)와 엇갈린다 */
export const TERMINALS: Record<WireColor, { s: number; t: number }> = {
  red: { s: TREE.s, t: TREE.t - 2.9 },
  blue: { s: TREE.s - 2.9, t: TREE.t },
  yellow: { s: TREE.s, t: TREE.t + 2.9 },
};
/** 단자에 끼울 수 있는 거리 */
export const PLUG_R = 1.3;

/** 발전기·연결판을 놓는 자리(트리 앞 왼쪽·오른쪽). 이 안에 내려놓으면 제자리에 붙는다 */
export const PADS = {
  generator: { s: TREE.s - 4.2, t: TREE.t - 2.6, r: 1.2 },
  board: { s: TREE.s - 4.2, t: TREE.t + 2.6, r: 1.2 },
} as const;
/** 연결판에 놓인 전선 끝(연결판 기준 t 방향 차례: 노랑·빨강·파랑) */
export const PLUG_START: Record<WireColor, { s: number; t: number }> = {
  yellow: { s: PADS.board.s - 0.6, t: PADS.board.t - 0.5 },
  red: { s: PADS.board.s - 0.6, t: PADS.board.t },
  blue: { s: PADS.board.s - 0.6, t: PADS.board.t + 0.5 },
};

/** 트리 양쪽 스위치 */
export const SWITCHES = {
  A: { s: TREE.s, t: TREE.t - 8.2 },
  B: { s: TREE.s, t: TREE.t + 8.2 },
} as const;
export type SwitchId = keyof typeof SWITCHES;
/** 스위치·발전기 손잡이에 손이 닿는 거리 */
export const REACH = 1.3;

/** 혼자 왕복: 스위치 A → 트리 앞을 돌아 → B → 다시 A(걷는 길이 / 요정 속도) */
export const SOLO_ROUND_TRIP_SEC = (() => {
  const a = SWITCHES.A, b = SWITCHES.B;
  const via = { s: TREE.s - TREE.r - 1.6, t: TREE.t };
  const leg = Math.hypot(a.s - via.s, a.t - via.t) + Math.hypot(b.s - via.s, b.t - via.t);
  return (2 * leg) / ELF_SPEED;
})();
/** 두 스위치를 누르는 제한 시간: 협동 4초, 1인 max(12초, 왕복 + 3초)(명세서 §5 인원별 배정) */
export const SWITCH_WINDOW = { coop: 4, solo: Math.max(12, SOLO_ROUND_TRIP_SEC + 3) };

/** 눈에 반쯤 묻힌 큰 장식(요정이 돌아간다) */
export const ORNAMENTS = [
  { s: 17.0, t: -4.2, r: 0.8, color: '#d23a3a' },
  { s: 18.6, t: 3.0, r: 0.7, color: '#e0b021' },
  { s: 20.2, t: -0.8, r: 0.75, color: '#2f6fd0' },
  { s: 16.6, t: 6.4, r: 0.85, color: '#2f9a4a' },
  { s: 19.2, t: -7.4, r: 0.7, color: '#7a4ad0' },
  { s: 28.6, t: -5.6, r: 0.8, color: '#e07a2a' },
  { s: 28.8, t: 5.8, r: 0.75, color: '#d23a3a' },
] as const;

/** 할머니가 삼각대에 올려 둔 사진기(정원문 안쪽, 트리를 본다) */
export const TRIPOD = { s: 16.2, t: 1.9 };

/** 시작: 담장길 아래쪽. 수리 상자에서 꺼낸 발전기·연결판이 발치에 */
export const CH4_START = {
  spawns: [W(-2.4, -1.2), W(-2.4, 1.2), W(-3.8, -1.8), W(-3.8, 1.8)],
  generator: W(-1.6, -0.6),
  board: W(-1.6, 1.4),
  /** 다 쓴 수리 상자(봉투가 묶였던 자리) */
  box: W(-3.4, 0),
};

/** 1인 연습 시작: 정원문 안쪽(바로 연습할 수 있게) */
export const SOLO_SPAWN = W(15.6, -0.8);

const T = 0.4;
function walls(): Collider[] {
  const c: Collider[] = [];
  // 담장길 양옆(왼쪽 돌담, 오른쪽 생울타리)과 아래 끝
  c.push(laneWall({ s: -6, t: -LANE_HALF }, { s: GARDEN_WALL.s, t: -LANE_HALF }, T));
  c.push(laneWall({ s: -6, t: LANE_HALF }, { s: GARDEN_WALL.s, t: LANE_HALF }, T));
  c.push(laneWall({ s: -6, t: -LANE_HALF }, { s: -6, t: LANE_HALF }, T));
  // 정원 담장(정원문만 비운다)
  c.push(laneWall({ s: GARDEN_WALL.s, t: -GARDEN.half }, { s: GARDEN_WALL.s, t: GARDEN_WALL.gate[0] }, T));
  c.push(laneWall({ s: GARDEN_WALL.s, t: GARDEN_WALL.gate[1] }, { s: GARDEN_WALL.s, t: GARDEN.half }, T));
  // 정원 양옆·뒤(집 앞)
  c.push(laneWall({ s: GARDEN.front, t: -GARDEN.half }, { s: GARDEN.back, t: -GARDEN.half }, T));
  c.push(laneWall({ s: GARDEN.front, t: GARDEN.half }, { s: GARDEN.back, t: GARDEN.half }, T));
  c.push(laneWall({ s: GARDEN.back, t: -GARDEN.half }, { s: GARDEN.back, t: GARDEN.half }, T));
  // 트리, 장식, 삼각대, 스위치 기둥
  c.push(laneCircle(TREE.s, TREE.t, TREE.r));
  for (const o of ORNAMENTS) c.push(laneCircle(o.s, o.t, o.r * 0.9));
  c.push(laneCircle(TRIPOD.s, TRIPOD.t, 0.35));
  for (const sw of Object.values(SWITCHES)) c.push(laneCircle(sw.s, sw.t, 0.3));
  return c;
}
export const CH4_COLLIDERS: readonly Collider[] = walls();

export const CH4_BOUNDS: Bounds = (() => {
  const pts = [W(-7, -GARDEN.half - 2), W(-7, GARDEN.half + 2), W(GARDEN.back + 2, -GARDEN.half - 2), W(GARDEN.back + 2, GARDEN.half + 2)];
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minZ: Math.min(...pts.map((p) => p.z)),
    maxZ: Math.max(...pts.map((p) => p.z)),
  };
})();

export const near = (p: { x: number; z: number }, q: { s: number; t: number }, r: number) => {
  const l = toLane(p);
  return Math.hypot(l.s - q.s, l.t - q.t) <= r;
};

/** 정원 안(정원문을 지났다) */
export function inGarden(p: { x: number; z: number }): boolean {
  const { s, t } = toLane(p);
  return s > GARDEN.front + 0.4 && s < GARDEN.back && Math.abs(t) < GARDEN.half;
}

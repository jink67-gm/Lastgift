// 1장 · 유나의 첫 스케치북 — 공간(명세서 §3.2 "광장 → 우편함 골목 → 유나네 앞마당", §5 1장).
// 고정 사진기(남동쪽 위)에서 보기 좋게 길을 "화면 위쪽"으로 낸다.
// 갈림길 동네(2026-11-28 사용자: "유나네 찾기가 더 복잡하면 좋겠다, 입구 찾기도 어색하다"):
//   돌 아치 → 우편함 골목(M) → 왼쪽 막다른 갈래(D, 끝에 가짜 집 A) → 빨간 우체통이 선 갈림길(X)
//   → 왼쪽 끝에서 위로(LU) → 큰 트리 모퉁이에서 오른쪽 윗길(U): 이웃집 C, 그 옆이 유나네.
//   X 오른쪽 끝에서 위로(RU) 가면 막다른 끝에 가짜 집 B.
//   낮은 담 + 나무 대문이 있는 집이 넷(A·B·C·유나네). 지도 단서(물고기 우편함이 대문 왼쪽, 풍차 화분이 문 오른쪽)가
//   모두 맞는 집은 유나네 하나. 유나네 대문은 E로 빗장을 풀어 연다(한 번 열면 계속 열림). 가짜 집 대문은 덜컹거릴 뿐 열리지 않는다.
//   유나네 앞마당(담 안)·창가·엄폐물·망보는 자리 좌표는 그대로다(04-4b).
// 좌표: 골목 기준(s = 화면 위쪽으로 골목을 따라, t = 화면 오른쪽) → 월드(x, z). 판정은 이 값만 쓴다.
import type { Bounds, Collider } from '../core/collision';
import { ELF_H, TT_HOUSE_SCALE, TOWN } from './townScale';

import { W, YAW, laneWall, toLane } from './lane';

export { W, YAW, toLane };

export type MailSymbol = 'fish' | 'bird' | 'star' | 'cat';
export type PotKind = 'windmill' | 'tulip' | 'cactus';

export interface Ch1House {
  id: string;
  /** 집 가운데(골목 좌표) */
  s: number;
  t: number;
  /** 집 앞면이 보는 방향 */
  faces: 'left' | 'right' | 'back';
  /** 우편함 무늬와 자리(집을 마주 보고 선 사람 기준 대문 왼쪽·오른쪽) */
  mail: MailSymbol;
  mailSide: 'left' | 'right';
  /** 현관 옆 화분과 자리(집을 마주 보고 문 왼쪽·오른쪽) */
  pot: PotKind;
  potSide: 'left' | 'right';
  /** 낮은 돌담 + 나무 대문으로 둘러싼 앞마당(유나네·가짜 집 A·B·C). 대문 id = 집 id */
  lowWall?: boolean;
  yuna?: boolean;
}

/** Tiny Treats 집: 폭 5.9 · 깊이 6.0(모델 단위). 문은 앞면 가운데에서 오른쪽(+x)으로 0.8 */
export const HOUSE_SCALE = TT_HOUSE_SCALE;
export const HOUSE_HALF = { w: (5.9 * HOUSE_SCALE) / 2, d: (6.0 * HOUSE_SCALE) / 2 };
/** 문: 집 모델 기준 +x(집을 마주 본 사람의 오른쪽)로 0.8 */
const DOOR_OFF = 0.8 * HOUSE_SCALE;
/** 유나네 집은 이웃보다 크다(2026-11-28 사용자: "집과 앞마당 크기를 키워서 더 스릴 있고 긴 콘텐츠로") */
export const YUNA_HOUSE_K = 1.35;
const YUNA_HALF = { w: HOUSE_HALF.w * YUNA_HOUSE_K, d: HOUSE_HALF.d * YUNA_HOUSE_K };
/** 유나네 앞마당 깊이(담 ~ 집 앞면) */
const YUNA_YARD_DEPTH = 17;
/** 유나네 집 가운데(골목 좌표 s) */
const YUNA_S = 42.5 + YUNA_YARD_DEPTH + YUNA_HALF.d;

/** 앞마당 깊이(집 앞면 ~ 골목 울타리). 사람 집 지붕이 골목을 덮지 않게 넉넉히 */
export const YARD_DEPTH = 5;
/** 골목 반폭(울타리까지) */
export const LANE_HALF = 3.4;
/** 돌 아치(골목 입구) */
export const ARCH = { s: -6, halfSpan: 3.2, height: 6.2 };

/** 길(골목 좌표 사각형: s0~s1, t0~t1). 울타리는 STREET_FENCES */
export const STREETS = {
  /** 아치 ~ 갈림길: 우편함 골목 */
  M: { s0: ARCH.s, s1: 16, t0: -LANE_HALF, t1: LANE_HALF },
  /** 골목 왼쪽 막다른 갈래(끝에 가짜 집 A) */
  D: { s0: 5.6, s1: 11.6, t0: -17.5, t1: -LANE_HALF },
  /** 빨간 우체통 갈림길(옆으로 긴 길) */
  X: { s0: 16, s1: 22, t0: -28, t1: 25 },
  /** 갈림길 왼쪽 끝에서 위로 */
  LU: { s0: 22, s1: 34, t0: -28, t1: -22 },
  /** 갈림길 오른쪽 끝에서 위로(끝에 가짜 집 B) */
  RU: { s0: 22, s1: 36, t0: 19, t1: 25 },
  /** 윗길: 이웃집 C와 유나네 담 앞 */
  U: { s0: 34, s1: 42.5, t0: -28, t1: 12.7 },
} as const;

/** 대문 반폭(기둥 사이 2.6) */
export const GATE_HALF = 1.3;
/** 대문 앞에서 행동 버튼이 닿는 거리 */
export const GATE_REACH = 1.9;

/** 낮은 담 대문: 가운데(s, t), 담이 뻗은 방향 axis('t' = s가 같은 가로 담, 's' = t가 같은 세로 담), out = 길 쪽(담 밖) 방향 부호 */
export interface YardGate {
  id: string;
  s: number;
  t: number;
  axis: 's' | 't';
  /** 담 밖(길 쪽)이 s(또는 t)가 작아지는 쪽이면 -1 */
  out: -1 | 1;
}

/** 유나네 앞마당: 낮은 담(사람 허리, 요정 키보다 높다) 앞면 s=front, 왼쪽 t=left ~ 오른쪽 t=right, 나무 대문 t=gate */
export const YARD = { front: 42.5, back: YUNA_S - YUNA_HALF.d, left: -11, right: 15, gate: [7.3, 9.9] as const };
export const LOW_WALL_H = 1.6 * ELF_H;

export const GATES: readonly YardGate[] = [
  { id: 'yuna', s: YARD.front, t: (YARD.gate[0] + YARD.gate[1]) / 2, axis: 't', out: -1 },
  { id: 'A', s: 8.6, t: STREETS.D.t0, axis: 's', out: 1 },
  { id: 'B', s: STREETS.RU.s1, t: 22, axis: 't', out: -1 },
  { id: 'C', s: YARD.front, t: -18, axis: 't', out: -1 },
];
export const gateById = (id: string): YardGate => GATES.find((g) => g.id === id)!;

/** 대문 문짝이 닫혀 있을 때 막는 벽 */
export function gateCollider(g: YardGate): Collider {
  return g.axis === 't' ? laneWall({ s: g.s, t: g.t - GATE_HALF }, { s: g.s, t: g.t + GATE_HALF }, 0.3) : laneWall({ s: g.s - GATE_HALF, t: g.t }, { s: g.s + GATE_HALF, t: g.t }, 0.3);
}

export const CH1_HOUSES: readonly Ch1House[] = [
  // 우편함 골목 양옆(울타리 너머, 대문 없는 배경 집): 무늬가 달라 쉽게 아니다
  { id: 'L1', s: -1.5, t: -(LANE_HALF + YARD_DEPTH + HOUSE_HALF.d), faces: 'right', mail: 'star', mailSide: 'left', pot: 'cactus', potSide: 'right' },
  { id: 'R1', s: 4, t: LANE_HALF + YARD_DEPTH + HOUSE_HALF.d, faces: 'left', mail: 'bird', mailSide: 'left', pot: 'tulip', potSide: 'right' },
  // 가짜 집 A(막다른 갈래 끝): 물고기 우편함인데 대문 오른쪽, 풍차 화분 → 아니다
  { id: 'A', s: 8.6, t: STREETS.D.t0 - 3 - HOUSE_HALF.d, faces: 'right', mail: 'fish', mailSide: 'right', pot: 'windmill', potSide: 'right', lowWall: true },
  // 가짜 집 B(오른쪽 윗길 끝): 물고기 우편함·대문 왼쪽(맞다)인데 튤립 화분 → 아니다
  { id: 'B', s: STREETS.RU.s1 + 3 + HOUSE_HALF.d, t: 22, faces: 'back', mail: 'fish', mailSide: 'left', pot: 'tulip', potSide: 'right', lowWall: true },
  // 이웃집 C(유나네 왼쪽 옆): 풍차 화분·문 오른쪽(맞다)인데 새 우편함 → 아니다
  { id: 'C', s: YARD.front + 3 + HOUSE_HALF.d, t: -18, faces: 'back', mail: 'bird', mailSide: 'left', pot: 'windmill', potSide: 'right', lowWall: true },
  // 유나네: 물고기 우편함 대문 왼쪽, 풍차 화분 문 오른쪽, 낮은 담 + 나무 대문
  { id: 'yuna', s: YUNA_S, t: 0, faces: 'back', mail: 'fish', mailSide: 'left', pot: 'windmill', potSide: 'right', lowWall: true, yuna: true },
];

/** 집 배율·반 크기·문 위치(유나네만 크다) */
export const houseScaleOf = (h: Ch1House): number => HOUSE_SCALE * (h.yuna ? YUNA_HOUSE_K : 1);
export const halfOf = (h: Ch1House): { w: number; d: number } => (h.yuna ? YUNA_HALF : HOUSE_HALF);
/** 문 가운데(모델 단위): 집 모델의 문 마디 x 0.81은 경첩 쪽이라 문 가운데는 약 0.28(계단 가운데와 같다) */
const DOOR_MID = 0.28 * HOUSE_SCALE;
/** 유나네는 좌우를 뒤집어 세운다(문이 가운데 왼쪽, 창가가 오른쪽) */
const doorOff = (h: Ch1House): number => (h.yuna ? -DOOR_MID * YUNA_HOUSE_K : DOOR_OFF);

export function houseById(id: string): Ch1House {
  return CH1_HOUSES.find((h) => h.id === id)!;
}

/** 집 기준 좌표(앞으로 along, 마주 본 사람 기준 오른쪽으로 side) → 골목 좌표 */
export function housePoint(h: Ch1House, ahead: number, side: number): { s: number; t: number } {
  // 앞면이 보는 방향(골목 좌표 단위 벡터)과, 집을 마주 본 사람의 오른쪽
  const face = h.faces === 'back' ? { s: -1, t: 0 } : h.faces === 'left' ? { s: 0, t: -1 } : { s: 0, t: 1 };
  // 집을 마주 보는 사람은 -face를 본다. 그 사람의 오른쪽 = 바라보는 방향을 시계 방향으로 90°(골목 좌표: s 위, t 오른쪽)
  const look = { s: -face.s, t: -face.t };
  const right = { s: -look.t, t: look.s };
  return { s: h.s + face.s * ahead + right.s * side, t: h.t + face.t * ahead + right.t * side };
}

/** 집 앞면 바로 앞, 문 가운데(골목 좌표) */
export function doorOf(h: Ch1House): { s: number; t: number } {
  return housePoint(h, halfOf(h).d, doorOff(h));
}

/** 대문 가운데: 낮은 담 집은 담의 나무 대문, 아니면 골목 울타리의 작은 대문 */
export function gateOf(h: Ch1House): { s: number; t: number } {
  if (h.lowWall) {
    const g = gateById(h.id);
    return { s: g.s, t: g.t };
  }
  return housePoint(h, HOUSE_HALF.d + YARD_DEPTH, DOOR_OFF);
}

/** 우편함 자리(골목 좌표): 대문 바깥(길 쪽) 왼쪽·오른쪽 */
export function mailboxOf(h: Ch1House): { s: number; t: number } {
  if (h.lowWall) {
    const g = gateById(h.id);
    // 대문을 마주 본(담 밖에서 집 쪽을 보는) 사람의 왼쪽·오른쪽
    const side = h.mailSide === 'left' ? -1 : 1;
    const off = (GATE_HALF + 0.9) * side;
    const look = g.axis === 't' ? { s: -g.out, t: 0 } : { s: 0, t: -g.out };
    const right = { s: -look.t, t: look.s };
    return { s: g.s + right.s * off + (g.axis === 't' ? g.out * 0.55 : 0), t: g.t + right.t * off + (g.axis === 's' ? g.out * 0.55 : 0) };
  }
  return housePoint(h, HOUSE_HALF.d + YARD_DEPTH + 0.5, DOOR_OFF + (h.mailSide === 'left' ? -1.9 : 1.9));
}

/** 화분 자리: 문 왼쪽·오른쪽 1.7, 앞면에서 0.7 앞 */
export function potOf(h: Ch1House): { s: number; t: number } {
  // 유나네: 큰 계단 오른쪽 아래 앞쪽(벽의 초인종과 겹치지 않게)
  return housePoint(h, halfOf(h).d + (h.yuna ? 2.4 : 0.7), doorOff(h) + (h.potSide === 'left' ? -1.7 : 1.7) * (h.yuna ? 2.0 : 1));
}

/** 유나 창가(돌출 창): 문 왼쪽, 사진기 쪽 앞면 */
/** 유나 창가: 집 오른쪽(대문 쪽)에서 마당을 내려다본다(2026-11-28 사용자: "감시하는 인물이 집 오른편에") */
export const YUNA_WINDOW = { s: YUNA_S - YUNA_HALF.d, t: 4.2 * YUNA_HOUSE_K, width: 4.0, sill: 2.5 * ELF_H, height: 2.9 * ELF_H };

/** 길잡이: 갈림길의 빨간 우체통(울타리 앞), 윗길 모퉁이의 큰 트리(빈 땅 안) */
export const LANDMARKS = {
  postBox: { s: 21.3, t: -4.8 }, // 갈림길 위쪽 울타리 앞(골목에서 올라오면 왼쪽 앞에 보인다: "여기서 왼쪽"). 길 한가운데는 비운다
  cornerTree: { s: 30.5, t: -18.5 },
};

/**
 * 유나 이목 끌기(2026-11-28 사용자): **눈뭉치로 초인종 맞히기**. 유나네 앞마당에서 빈손 행동 → 눈을 뭉쳐 눈뭉치를 쥔다.
 * 행동 버튼을 누르고 있으면 힘이 모이고(땅에 떨어질 자리 표시) 떼면 던진다. 현관문 옆 초인종을 맞히면 띵동 → 유나가 창가를 떠나
 * 현관으로 와 문을 열고 두리번거리다 들어간다(DOOR_TRIP). 선물을 다 놓은 뒤 초인종을 맞히면 유나가 문을 열고 선물을 발견한다(1장 끝).
 * (종 누르기 → 깡통 탑 → 매단 종 → "종이 울린다고 자리를 비우는 게 이상하다" → 초인종)
 */
export const THROW = { min: 2.5, max: 13, chargeSec: 1.1, assist: 0.6 };

/** 시작: 아치 아래쪽 눈길(광장에서 걸어 들어온 자리). 두 선물은 요정 발치에 */
export const CH1_START = {
  spawns: [W(-11, -1.1), W(-11, 1.1), W(-12.6, -1.6), W(-12.6, 1.6)],
  items: [
    { id: 'sketchbook', kind: 'sketchbook' as const, ...W(-10.2, -1.4) },
    { id: 'pencils', kind: 'pencils' as const, ...W(-10.2, 1.4) },
  ],
};

/** 앞마당에 들어선 것으로 보는 선(대문 안쪽) */
export function inYunasYard(p: { x: number; z: number }): boolean {
  const { s, t } = toLane(p);
  return s > YARD.front + 0.4 && s < YARD.back && t > YARD.left && t < YARD.right;
}

/** 이 요정이 손 닿는 대문(없으면 null): 담 안·밖 어느 쪽에서든 */
export function gateNear(p: { x: number; z: number }): YardGate | null {
  const { s, t } = toLane(p);
  let best: YardGate | null = null;
  let bd = GATE_REACH;
  for (const g of GATES) {
    const d = Math.hypot(s - g.s, t - g.t);
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  return best;
}

const wall = laneWall;
type LP = { s: number; t: number };
const P = (s: number, t: number): LP => ({ s, t });

/** 집 몸통(회전 사각형) */
function houseBox(h: Ch1House): Collider {
  const c = W(h.s, h.t);
  const yaw = h.faces === 'back' ? YAW.back : h.faces === 'left' ? YAW.left : YAW.right;
  return { kind: 'obb', x: c.x, z: c.z, yaw, ha: halfOf(h).d + 0.2, hb: halfOf(h).w + 0.2 };
}

/** 길 둘레 울타리(그리기·판정 공용): [시작, 끝, 바깥 방향 부호(울타리 바깥 눈둑)] */
const { M, D, X, LU, RU, U } = STREETS;
export const STREET_FENCES: readonly [LP, LP][] = [
  // 우편함 골목 왼쪽(막다른 갈래 입구는 열림), 오른쪽
  [P(ARCH.s, M.t0), P(D.s0, M.t0)],
  [P(D.s1, M.t0), P(X.s0, M.t0)],
  [P(ARCH.s, M.t1), P(X.s0, M.t1)],
  // 막다른 갈래 아래·위
  [P(D.s0, M.t0), P(D.s0, D.t0)],
  [P(D.s1, M.t0), P(D.s1, D.t0)],
  // 갈림길 아래(골목 입구 양옆), 위(왼쪽 윗길 ~ 오른쪽 윗길 사이)
  [P(X.s0, X.t0), P(X.s0, M.t0)],
  [P(X.s0, M.t1), P(X.s0, X.t1)],
  [P(X.s1, LU.t1), P(X.s1, RU.t0)],
  // 왼쪽 끝: 갈림길 ~ 윗길까지 한 줄
  [P(X.s0, X.t0), P(U.s1, X.t0)],
  // 왼쪽 윗길 오른쪽, 윗길 아래
  [P(LU.s0, LU.t1), P(LU.s1, LU.t1)],
  [P(U.s0, LU.t1), P(U.s0, U.t1)],
  // 윗길 오른쪽 끝
  [P(U.s0, U.t1), P(U.s1, U.t1)],
  // 오른쪽 끝: 갈림길 ~ 가짜 집 B 담까지, 오른쪽 윗길 왼쪽
  [P(X.s0, X.t1), P(RU.s1, X.t1)],
  [P(RU.s0, RU.t0), P(RU.s1, RU.t0)],
  // 윗길 위쪽: 이웃집 C 담과 유나네 담 사이, 유나네 담 오른쪽 끝 ~ 윗길 끝
  [P(U.s1, -12), P(U.s1, YARD.left)],
  // (유나네 담이 윗길 오른쪽 끝보다 넓어 담 오른쪽 ~ 윗길 끝 사이 울타리는 없다)
];

/** 낮은 돌담 조각(대문 자리는 비운다): [시작, 끝] */
export const LOW_WALLS: readonly [LP, LP][] = (() => {
  const g = (id: string) => gateById(id);
  const w: [LP, LP][] = [];
  // 유나네: 앞(대문 양옆), 왼쪽·오른쪽 옆(집까지)
  w.push([P(YARD.front, YARD.left), P(YARD.front, g('yuna').t - GATE_HALF)]);
  w.push([P(YARD.front, g('yuna').t + GATE_HALF), P(YARD.front, YARD.right)]);
  w.push([P(YARD.front, YARD.left), P(YARD.back, YARD.left)]);
  w.push([P(YARD.front, YARD.right), P(YARD.back, YARD.right)]);
  // 가짜 집 A: 막다른 갈래 끝을 가로지르는 세로 담
  w.push([P(D.s0, D.t0), P(g('A').s - GATE_HALF, D.t0)]);
  w.push([P(g('A').s + GATE_HALF, D.t0), P(D.s1, D.t0)]);
  // 가짜 집 B: 오른쪽 윗길 끝
  w.push([P(RU.s1, RU.t0), P(RU.s1, g('B').t - GATE_HALF)]);
  w.push([P(RU.s1, g('B').t + GATE_HALF), P(RU.s1, RU.t1)]);
  // 이웃집 C: 윗길 위쪽 왼편
  w.push([P(U.s1, U.t0), P(U.s1, g('C').t - GATE_HALF)]);
  w.push([P(U.s1, g('C').t + GATE_HALF), P(U.s1, -12)]);
  return w;
})();

/** 울타리·담·집·우편함·길잡이 + 가짜 집 대문(늘 닫힘). 유나네 대문은 따로(열리면 빠진다) */
function buildWalls(): Collider[] {
  const c: Collider[] = [];
  for (const [a, b] of STREET_FENCES) c.push(wall(a, b, 0.3));
  for (const [a, b] of LOW_WALLS) c.push(wall(a, b, 0.5));
  for (const g of GATES) if (g.id !== 'yuna') c.push(gateCollider(g));
  // 대문 기둥
  for (const g of GATES) {
    for (const k of [-1, 1]) {
      const p = g.axis === 't' ? W(g.s, g.t + k * GATE_HALF) : W(g.s + k * GATE_HALF, g.t);
      c.push({ kind: 'circle', x: p.x, z: p.z, r: 0.42 });
    }
  }
  // 아치 기둥
  for (const sgn of [-1, 1]) {
    const p = W(ARCH.s, sgn * ARCH.halfSpan);
    c.push({ kind: 'circle', x: p.x, z: p.z, r: 0.75 });
  }
  // 아치 아래쪽(시작) 막기: 뒤로 돌아 나가지 않게
  c.push(wall({ s: -15, t: -LANE_HALF - 1 }, { s: -15, t: LANE_HALF + 1 }, 0.3));
  c.push(wall({ s: -15, t: -LANE_HALF - 1 }, { s: ARCH.s, t: -LANE_HALF }, 0.3));
  c.push(wall({ s: -15, t: LANE_HALF + 1 }, { s: ARCH.s, t: LANE_HALF }, 0.3));
  // 유나네 집, 우편함 기둥, 빨간 우체통
  c.push(houseBox(CH1_HOUSES.find((h) => h.yuna)!));
  for (const h of CH1_HOUSES) {
    const m = mailboxOf(h);
    const p = W(m.s, m.t);
    c.push({ kind: 'circle', x: p.x, z: p.z, r: 0.35 });
  }
  const pb = W(LANDMARKS.postBox.s, LANDMARKS.postBox.t);
  c.push({ kind: 'circle', x: pb.x, z: pb.z, r: 0.6 });
  return c;
}

export const CH1_WALLS: readonly Collider[] = buildWalls();
const YUNA_GATE_COLLIDER = gateCollider(gateById('yuna'));
/** 충돌: 울타리·담·집 + 앞마당 엄폐물 (+ 유나네 대문이 닫혀 있으면 문짝) */
export function ch1Colliders(gateOpen = false): readonly Collider[] {
  return gateOpen ? [...CH1_WALLS, ...COVER_COLLIDERS, ...HEDGE_COLLIDERS] : [...CH1_WALLS, ...COVER_COLLIDERS, ...HEDGE_COLLIDERS, YUNA_GATE_COLLIDER];
}

/** 월드 경계(넉넉하게): 실제 움직임은 울타리·담이 막는다 */
export const CH1_BOUNDS: Bounds = (() => {
  const pts = [W(-16, -32), W(-16, 29), W(YUNA_S + 8, -32), W(YUNA_S + 8, 29)];
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minZ: Math.min(...pts.map((p) => p.z)),
    maxZ: Math.max(...pts.map((p) => p.z)),
  };
})();

/** 지도에 그린 것(지우의 그림 지도): 아치 → 골목 → 빨간 우체통에서 왼쪽 → 큰 트리 모퉁이에서 위·오른쪽 → 물고기 우편함(대문 왼쪽)·풍차 화분(문 오른쪽)인 집 */
export const MAP_FEATURES = { mail: 'fish' as MailSymbol, mailSide: 'left' as const, pot: 'windmill' as PotKind, potSide: 'right' as const, lowWall: true };

/** 사람 마을 치수 재확인(우편함·담 높이) */
export const CH1_SIZES = { mailbox: TOWN.mailbox, lowWall: LOW_WALL_H, fence: TOWN.fence };

// ── 04-4b: 망보기·현관 배달 ────────────────────────────────

/** 유나 눈 자리(창 앞면 가운데, 골목 좌표) */
export const YUNA_EYE = { s: YARD.back + 0.2, t: YUNA_WINDOW.t };

/**
 * 앞마당 생울타리 둘(2026-11-28 사용자: "바깥문에서 현관으로 들어가는 코스가 짧고 어색하다"): 요정 키보다 높은 상록 생울타리가
 * 마당을 세 갈래 길로 나눈다. 대문 → 앞쪽 길을 왼쪽으로 → 왼쪽 틈으로 올라가 → 가운데 길을 오른쪽으로 → 창가 앞 틈으로 올라가(가장 위험) →
 * 집 앞 길을 왼쪽으로 → 현관. 생울타리 뒤에 앉아 있으면 창·문간에서 안 보인다(긴 엄폐물).
 */
export const HEDGES: readonly { a: { s: number; t: number }; b: { s: number; t: number } }[] = [
  { a: { s: 47.0, t: -3 }, b: { s: 47.0, t: YARD.right } },
  { a: { s: 52.5, t: YARD.left }, b: { s: 52.5, t: 9 } },
];
/** 생울타리 두께(골목 좌표) */
export const HEDGE_THICK = 1.0;

/**
 * 앞마당 정원길(디딤돌): 생울타리 사이 세 갈래 길을 지그재그로 약 59 m. 길 위는 비워 둔다
 * (2026-11-28 사용자: "유나네 집 앞에 눈사람이랑 수레로 길이 막혀 있는 건 어색하다", "위치를 길목에 두지 마").
 */
export const GARDEN_PATH: readonly { s: number; t: number }[] = [
  { s: YARD.front - 0.4, t: 8.6 },
  { s: 44.5, t: 6.0 },
  { s: 44.5, t: -7.0 },
  { s: 49.7, t: -7.5 },
  { s: 49.7, t: 12.0 },
  { s: 54.8, t: 12.0 },
  { s: 55.2, t: 2.5 },
  { s: YARD.back - 2.5, t: -0.2 },
];

/** 엄폐물 생김새 */
export type CoverKind = 'snowman' | 'tree' | 'bush' | 'logs' | 'doghouse';
/**
 * 앞마당 엄폐물(골목 좌표, 반지름): 길 모퉁이·갈래 끝·담 밑에(길 위는 비운다). 생울타리와 함께 그 뒤에서 **앉아야** 숨는다.
 */
export const COVERS: readonly { id: string; kind: CoverKind; s: number; t: number; r: number }[] = [
  { id: 'snowman', kind: 'snowman', s: 44.3, t: 12.8, r: 0.85 }, // 대문 안 오른쪽 끝
  { id: 'bushA', kind: 'bush', s: 44.3, t: -9.8, r: 0.9 }, // 앞쪽 길 왼쪽 끝
  { id: 'bushC', kind: 'bush', s: 50.0, t: -9.7, r: 0.9 }, // 가운데 길 왼쪽 끝
  { id: 'treeA', kind: 'tree', s: 50.6, t: 13.7, r: 0.95 }, // 창가 앞 틈 옆
  { id: 'doghouse', kind: 'doghouse', s: 55.2, t: -9.2, r: 1.05 }, // 집 앞 길 왼쪽 끝
  { id: 'treeB', kind: 'tree', s: 57.9, t: -8.0, r: 0.95 },
  { id: 'bushB', kind: 'bush', s: 57.6, t: 4.2, r: 0.9 }, // 현관과 창가 사이
  { id: 'logs', kind: 'logs', s: 57.7, t: 10.0, r: 0.85 }, // 창가 오른쪽 벽 밑
];

/** 창 바로 아래(유나가 내려다보지 못하는 곳) */
export const BLIND = { s0: YARD.back - 1.5, t0: YUNA_WINDOW.t - 2.0, t1: YUNA_WINDOW.t + 2.0 };

/** 현관 발판(선물을 놓는 곳): 문 앞 */
export const PORCH = { s: YARD.back - 1.9, t: -DOOR_MID * YUNA_HOUSE_K, hs: 1.2, ht: 1.8 };

/** 초인종: 현관문 오른쪽 벽(창가 쪽), 버튼 높이 y. 눈뭉치가 떨어질 곳이 반지름 r 안이면 맞힌다 */
/** 사람 1 m = 게임 단위(문 열린 높이 2 m = TOWN.doorOpening) */
const HUMAN_M = TOWN.doorOpening / 2;
/** 현관 계단 윗단 높이(유나네 집 모델에서 잰 값, 문간 바닥) */
const STOOP_Y = 1.07;
/** 초인종: 현관문 테두리(돌기둥) 오른쪽 벽, 창가와의 사이(문짝이 아니라 벽에 단다). 높이는 사람 기준 문간 바닥에서 1.4 m */
export const DOORBELL = { s: YARD.back - 0.1, t: PORCH.t + 3.2, y: STOOP_Y + 1.4 * HUMAN_M, r: 1.1 };
/** 현관 센서등(문 왼쪽 위): 요정이 현관 가까이(SENSOR_ZONE) 오면 켜지고 유나가 곧장 창밖을 본다. 눈뭉치로 덮으면 SENSOR_MELT초 꺼진다 */
export const SENSOR = { s: YARD.back - 0.1, t: PORCH.t - 2.2, y: STOOP_Y + 2.4 * HUMAN_M, r: 0.95 }; // 사람 기준 문간 바닥에서 2.4 m(문 위쪽 옆)
export const SENSOR_ZONE = 4.0;
export const SENSOR_MELT = 30;
/** 유나 방 창문(눈뭉치로 톡): 유나가 PEER.sec초 동안 창 쪽(골목 좌표 t > PEER.sideT)만 본다 */
export const WINDOW_TARGET = { s: YARD.back - 1.6, t: YUNA_WINDOW.t, y: YUNA_WINDOW.sill + YUNA_WINDOW.height / 2, r: 1.5 };
export const PEER = { sec: 3.5, sideT: 2.0 };
/** 현관에서 자루를 열어 두 선물을 꺼내는 데 행동 버튼을 누르고 있어야 하는 초 */
export const UNPACK_SEC = 2.0;
/** 현관에 나온 유나의 눈(문간): 두리번거릴 때 여기서 마당을 본다 */
export const DOOR_EYE = { s: YARD.back - 1.2, t: PORCH.t };
/** 초인종에 유나가 나왔다 들어가는 시간표(초): 현관으로 걸어감 → 문 열고 두리번 → 문 닫고 창가로 */
export const DOOR_TRIP = { toDoor: 2.5, atDoor: 3.5, back: 3.5 };

/** 들킨 요정이 돌아가는 곳: 엄폐물에 숨은 적이 없으면 대문 밖 */
export const OUTSIDE_GATE = { s: YARD.front - 1.4, t: (YARD.gate[0] + YARD.gate[1]) / 2 };

export function inPorch(p: { x: number; z: number }): boolean {
  const { s, t } = toLane(p);
  return Math.abs(s - PORCH.s) <= PORCH.hs && Math.abs(t - PORCH.t) <= PORCH.ht;
}

/** 엄폐물 충돌(요정이 지나가지 못한다) */
export const COVER_COLLIDERS: readonly Collider[] = COVERS.map((c) => {
  const p = W(c.s, c.t);
  return { kind: 'circle', x: p.x, z: p.z, r: c.r * 0.8 };
});
/** 생울타리 충돌 */
export const HEDGE_COLLIDERS: readonly Collider[] = HEDGES.map((h) => laneWall(h.a, h.b, HEDGE_THICK));

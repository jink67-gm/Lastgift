// 1장 · 유나의 첫 스케치북 — 공간(명세서 §3.2 "광장 → 우편함 골목 → 유나네 앞마당", §5 1장).
// 고정 사진기(남동쪽 위)에서 보기 좋게 길을 "화면 위쪽"으로 낸다:
//   화면 아래(광장 쪽)에서 돌 아치를 지나 우편함 골목을 올라가면, 골목 끝에 사진기 쪽을 보는 유나네가 있다.
//   아치 사이로 유나네 물고기 우편함이 보인다. 골목 양옆 집들은 헷갈리는 조합(물고기 우편함이 반대편, 풍차 화분만 같음 등).
//   유나네 앞마당은 낮은 담으로 둘러싸여 담 오른쪽 끝을 돌아 들어간다. 창가에 유나가 앉아 있다.
// 좌표: 골목 기준(s = 화면 위쪽으로 골목을 따라, t = 화면 오른쪽) → 월드(x, z). 판정은 이 값만 쓴다.
import type { Bounds, Collider } from '../core/collision';
import { ELF_H, TT_HOUSE_SCALE, TOWN } from './townScale';

/** 골목 앞쪽(화면 위쪽, 북서) */
const F = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 };
/** 골목 오른쪽(화면 오른쪽, 북동) */
const R = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };

/** 골목 좌표(s, t) → 월드 */
export function W(s: number, t: number): { x: number; z: number } {
  return { x: s * F.x + t * R.x, z: s * F.z + t * R.z };
}
/** 골목 방향 각(바라보는 방향 = atan2(x, z)): 앞(화면 위)·오른쪽·뒤(사진기 쪽)·왼쪽 */
export const YAW = {
  forward: Math.atan2(F.x, F.z),
  right: Math.atan2(R.x, R.z),
  back: Math.atan2(-F.x, -F.z),
  left: Math.atan2(-R.x, -R.z),
};

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
  /** 낮은 담으로 둘러싼 앞마당(유나네만) */
  lowWall?: boolean;
  yuna?: boolean;
}

/** Tiny Treats 집: 폭 5.9 · 깊이 6.0(모델 단위). 문은 앞면 가운데에서 오른쪽(+x)으로 0.8 */
export const HOUSE_SCALE = TT_HOUSE_SCALE;
export const HOUSE_HALF = { w: (5.9 * HOUSE_SCALE) / 2, d: (6.0 * HOUSE_SCALE) / 2 };
/** 문: 집 모델 기준 +x(집을 마주 본 사람의 오른쪽)로 0.8 */
const DOOR_OFF = 0.8 * HOUSE_SCALE;
/** 유나네 집 가운데(골목 좌표 s) */
const YUNA_S = 57;

/** 앞마당 깊이(집 앞면 ~ 골목 울타리). 사람 집 지붕이 골목을 덮지 않게 넉넉히 */
export const YARD_DEPTH = 5;
/** 골목 반폭(울타리까지) */
export const LANE_HALF = 3.4;
/** 돌 아치(골목 입구) */
export const ARCH = { s: -6, halfSpan: 3.2, height: 6.2 };

export const CH1_HOUSES: readonly Ch1House[] = [
  // 아치 지나 왼쪽: 물고기 우편함이지만 대문 오른쪽, 튤립 화분 → 아니다
  { id: 'L1', s: 6, t: -(LANE_HALF + YARD_DEPTH + HOUSE_HALF.d), faces: 'right', mail: 'fish', mailSide: 'right', pot: 'tulip', potSide: 'left' },
  // 오른쪽: 새 우편함, 풍차 화분(화분만 같다) → 아니다
  { id: 'R1', s: 13, t: LANE_HALF + YARD_DEPTH + HOUSE_HALF.d, faces: 'left', mail: 'bird', mailSide: 'left', pot: 'windmill', potSide: 'right' },
  // 왼쪽: 별 우편함, 선인장
  { id: 'L2', s: 26, t: -(LANE_HALF + YARD_DEPTH + HOUSE_HALF.d), faces: 'right', mail: 'star', mailSide: 'left', pot: 'cactus', potSide: 'right' },
  // 오른쪽: 물고기 우편함이 대문 왼쪽(맞다)인데 화분이 튤립 → 아니다
  { id: 'R2', s: 30, t: LANE_HALF + YARD_DEPTH + HOUSE_HALF.d, faces: 'left', mail: 'fish', mailSide: 'left', pot: 'tulip', potSide: 'right' },
  // 골목 끝: 유나네. 물고기 우편함 대문 왼쪽, 풍차 화분 문 오른쪽, 낮은 담
  { id: 'yuna', s: YUNA_S, t: 0, faces: 'back', mail: 'fish', mailSide: 'left', pot: 'windmill', potSide: 'right', lowWall: true, yuna: true },
];

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
  return housePoint(h, HOUSE_HALF.d, DOOR_OFF);
}

/** 대문(앞마당 울타리·담의 열린 곳) 가운데 */
export function gateOf(h: Ch1House): { s: number; t: number } {
  if (h.lowWall) return { s: YARD.front, t: YARD.gate[0] + (YARD.gate[1] - YARD.gate[0]) / 2 };
  return housePoint(h, HOUSE_HALF.d + YARD_DEPTH, DOOR_OFF);
}


/** 유나네 앞마당: 낮은 담(사람 허리, 요정 키보다 높다) 앞면 s=front, 왼쪽 t=left ~ 오른쪽 t=right, 대문(열린 곳) t=gate */
export const YARD = { front: 42.5, back: YUNA_S - HOUSE_HALF.d, left: -9.5, right: 10.5, gate: [6.4, 10.5] as const };
export const LOW_WALL_H = 1.6 * ELF_H;

/** 우편함 자리(골목 좌표): 대문 왼쪽·오른쪽 1.9 */
export function mailboxOf(h: Ch1House): { s: number; t: number } {
  if (h.lowWall) return { s: YARD.front - 0.55, t: YARD.gate[0] - 0.9 };
  return housePoint(h, HOUSE_HALF.d + YARD_DEPTH + 0.5, DOOR_OFF + (h.mailSide === 'left' ? -1.9 : 1.9));
}

/** 화분 자리: 문 왼쪽·오른쪽 1.7, 앞면에서 0.7 앞 */
export function potOf(h: Ch1House): { s: number; t: number } {
  return housePoint(h, HOUSE_HALF.d + 0.7, DOOR_OFF + (h.potSide === 'left' ? -1.7 : 1.7));
}

/** 유나 창가(돌출 창): 문 왼쪽, 사진기 쪽 앞면 */
export const YUNA_WINDOW = { s: YUNA_S - HOUSE_HALF.d, t: -4.2, width: 3.4, sill: 2.3 * ELF_H, height: 2.6 * ELF_H };

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

/** 월드 → 골목 좌표 */
export function toLane(p: { x: number; z: number }): { s: number; t: number } {
  return { s: p.x * F.x + p.z * F.z, t: p.x * R.x + p.z * R.z };
}

/** 골목 좌표의 선분을 두께 있는 벽(회전 사각형)으로 */
function wall(a: { s: number; t: number }, b: { s: number; t: number }, thick: number): Collider {
  const pa = W(a.s, a.t);
  const pb = W(b.s, b.t);
  const dx = pb.x - pa.x, dz = pb.z - pa.z;
  return { kind: 'obb', x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2, yaw: Math.atan2(dx, dz), ha: Math.hypot(dx, dz) / 2, hb: thick / 2 };
}

/** 집 몸통(회전 사각형) */
function houseBox(h: Ch1House): Collider {
  const c = W(h.s, h.t);
  const yaw = h.faces === 'back' ? YAW.back : h.faces === 'left' ? YAW.left : YAW.right;
  return { kind: 'obb', x: c.x, z: c.z, yaw, ha: HOUSE_HALF.d + 0.2, hb: HOUSE_HALF.w + 0.2 };
}

/** 골목 양옆 울타리(앞마당 쪽은 닫혀 있다: 우편함·화분은 울타리 너머로 보인다), 아치 기둥, 유나네 낮은 담·집 */
function buildWalls(): Collider[] {
  const c: Collider[] = [];
  const end = YARD.front;
  // 왼쪽 울타리(아치 ~ 골목 끝), 오른쪽 울타리(아치 ~ 담 오른쪽 끝 앞)
  c.push(wall({ s: ARCH.s, t: -LANE_HALF }, { s: end, t: -LANE_HALF }, 0.3));
  c.push(wall({ s: ARCH.s, t: LANE_HALF }, { s: end - 4.5, t: LANE_HALF }, 0.3));
  // 골목 끝 오른쪽으로 꺾여 담 끝을 돌아 들어가는 길: 오른쪽 울타리가 바깥으로 벌어진다
  c.push(wall({ s: end - 4.5, t: LANE_HALF }, { s: end - 4.5, t: YARD.right + 2.2 }, 0.3));
  c.push(wall({ s: end - 4.5, t: YARD.right + 2.2 }, { s: YARD.back, t: YARD.right + 2.2 }, 0.3));
  // 유나네 낮은 담: 앞면(대문 왼쪽까지), 왼쪽 옆, 오른쪽 옆(대문 오른쪽 기둥부터 집까지)
  c.push(wall({ s: YARD.front, t: -LANE_HALF }, { s: YARD.front, t: YARD.gate[0] }, 0.5));
  c.push(wall({ s: YARD.front, t: YARD.left }, { s: YARD.front, t: -LANE_HALF }, 0.5));
  c.push(wall({ s: YARD.front, t: YARD.left }, { s: YARD.back, t: YARD.left }, 0.5));
  // 아치 기둥
  for (const sgn of [-1, 1]) {
    const p = W(ARCH.s, sgn * ARCH.halfSpan);
    c.push({ kind: 'circle', x: p.x, z: p.z, r: 0.75 });
  }
  // 아치 아래쪽(시작) 막기: 뒤로 돌아 나가지 않게
  c.push(wall({ s: -15, t: -LANE_HALF - 1 }, { s: -15, t: LANE_HALF + 1 }, 0.3));
  c.push(wall({ s: -15, t: -LANE_HALF - 1 }, { s: ARCH.s, t: -LANE_HALF }, 0.3));
  c.push(wall({ s: -15, t: LANE_HALF + 1 }, { s: ARCH.s, t: LANE_HALF }, 0.3));
  // 유나네 집, 우편함 기둥
  c.push(houseBox(CH1_HOUSES.find((h) => h.yuna)!));
  for (const h of CH1_HOUSES) {
    const m = mailboxOf(h);
    const p = W(m.s, m.t);
    c.push({ kind: 'circle', x: p.x, z: p.z, r: 0.35 });
  }
  return c;
}

export const CH1_WALLS: readonly Collider[] = buildWalls();

/** 월드 경계(넉넉하게): 실제 움직임은 울타리·담이 막는다 */
export const CH1_BOUNDS: Bounds = (() => {
  const pts = [W(-16, -14), W(-16, 16), W(YUNA_S + 8, -14), W(YUNA_S + 8, 16)];
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minZ: Math.min(...pts.map((p) => p.z)),
    maxZ: Math.max(...pts.map((p) => p.z)),
  };
})();

/** 지도에 그린 것(지우의 그림 지도): 아치 → 골목 → 낮은 담을 오른쪽으로 돌아 → 물고기 우편함(대문 왼쪽)·풍차 화분(문 오른쪽)인 집 */
export const MAP_FEATURES = { mail: 'fish' as MailSymbol, mailSide: 'left' as const, pot: 'windmill' as PotKind, potSide: 'right' as const, lowWall: true };

/** 사람 마을 치수 재확인(우편함·담 높이) */
export const CH1_SIZES = { mailbox: TOWN.mailbox, lowWall: LOW_WALL_H, fence: TOWN.fence };

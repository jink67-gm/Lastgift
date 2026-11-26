// 0장 광장 배치. 판정용 충돌체와 화면용 소품 배치를 함께 선언한다.
// 좌표: x 오른쪽, z 카메라 쪽. 광장 40 × 28 m, 중심 (0, 0).
// 남쪽(카메라 쪽)은 비워 두어 시야를 가리지 않는다. 북쪽 가운데 시계탑은 다른 골목에서도 보이는 랜드마크(§3.2).
import type { Bounds, Collider } from '../core/collision';
import { BENCH_SCALE, KENNEY_HOUSE_SCALE, TOWN, TT_HOUSE_SCALE } from './townScale';

export const PLAZA_BOUNDS: Bounds = { minX: -20, maxX: 20, minZ: -14, maxZ: 14 };

export const ELF_SPAWN = { x: 3, z: 4 };

export type PropKind = 'sleigh' | 'snowPile' | 'santa' | 'tree' | 'pine' | 'cabin' | 'clockTower' | 'bench' | 'lamp';

export interface Prop {
  id: string;
  kind: PropKind;
  x: number;
  z: number;
  /** 바닥면 크기(m). 사각형은 w·d(회전 뒤 x·z 크기), 원형은 r */
  w?: number;
  d?: number;
  r?: number;
  rotY?: number;
  /** 통나무집 깊이 칸 수(1칸 = 2 m) */
  cells?: number;
  collider: Collider | null;
}

const box = (x: number, z: number, w: number, d: number): Collider => ({ kind: 'box', x, z, hx: w / 2, hz: d / 2 });
const circle = (x: number, z: number, r: number): Collider => ({ kind: 'circle', x, z, r });

/**
 * 사람이 사는 통나무집(Kenney 조각, 문 높이 = 요정 키 × 4.5). 가로 2칸, 깊이 cells칸(1칸 = KENNEY_HOUSE_SCALE 단위).
 * 판정 상자는 보이는 벽 바깥 둘레와 맞춘다. rotY가 ±π/2면 가로·세로가 바뀐다
 */
function cabin(id: string, x: number, z: number, cells: number, rotY: number): Prop {
  // 벽 바깥면은 칸 가장자리에서 0.2단위 더 나와 있다(Kenney 벽 두께) → 보이는 벽 둘레와 판정을 맞춘다
  const across = 2.4 * KENNEY_HOUSE_SCALE;
  const deep = (cells + 0.4) * KENNEY_HOUSE_SCALE;
  const side = Math.abs(Math.sin(rotY)) > 0.5;
  const w = side ? deep : across;
  const d = side ? across : deep;
  // 플레이 경계와 겹치지 않는 바깥 집은 판정이 필요 없다(요정이 경계 밖으로 못 나간다)
  const B = PLAZA_BOUNDS;
  const inside = x - w / 2 < B.maxX && x + w / 2 > B.minX && z - d / 2 < B.maxZ && z + d / 2 > B.minZ;
  return { id, kind: 'cabin', x, z, w, d, rotY, cells, collider: inside ? box(x, z, w, d) : null };
}

/** 벤치(사람용): 폭 요정 키 × 3.6, 깊이는 앉는 면 높이에 맞춘 배율 */
function bench(id: string, x: number, z: number): Prop {
  const w = TOWN.benchWidth + 0.1;
  const d = 0.64 * BENCH_SCALE.z + 0.1;
  return { id, kind: 'bench', x, z, w, d, collider: box(x, z, w, d) };
}

/** 가로등(사람용): 기둥 받침만 막는다 */
function lamp(id: string, x: number, z: number): Prop {
  return { id, kind: 'lamp', x, z, r: 0.25, collider: circle(x, z, 0.25) };
}

// 사람 키 기준으로 커진 집·나무·시계탑은 플레이 경계(40 × 28) 바로 바깥에 두고 앞면이 광장을 보게 한다.
// 카메라(남동쪽 위)에서 앞면이 보이는 건 북쪽·서쪽 집이다. 오른쪽 아래 집(houseE)만 현관 바닥이 광장 안에 들어오게 걸쳐 둔다.
const H = KENNEY_HOUSE_SCALE; // 집 1칸
const HALF = 1.2 * H; // 2 × 2칸 집의 중심 ~ 벽 바깥면

const HOUSE_E = { x: 22.8, z: 3.2 };

export const PLAZA_PROPS: readonly Prop[] = [
  // 광장 가운데 눈더미에 처박힌 썰매(산타의 썰매: 산타에 맞춰 1.8배). 눈더미 하나가 썰매까지 감싸는 충돌체.
  { id: 'snowPile', kind: 'snowPile', x: 0, z: -2, r: 2.6, collider: circle(0, -2, 2.6) },
  { id: 'sleigh', kind: 'sleigh', x: 0, z: -2, w: 5.4, d: 2.6, rotY: 0.35, collider: null },
  // 산타: 사람 어른(요정 키의 약 4배)
  { id: 'santa', kind: 'santa', x: 3.1, z: -0.4, r: 1.1, collider: circle(3.1, -0.4, 1.1) },
  // 마을 트리: 광장 북서쪽 바깥(요정 키의 약 9배)
  { id: 'tree', kind: 'tree', x: -25, z: -11, r: 2.8, collider: null },
  // 시계탑: 집들보다 높은 랜드마크, 북쪽 바깥
  { id: 'clockTower', kind: 'clockTower', x: 16, z: -21.5, w: 5.6, d: 5.6, collider: null },
  // 북쪽 집(앞면이 광장을 본다). 북서쪽 집과 Tiny Treats 집 사이가 다음 골목
  cabin('houseNW', -14.2, -14.4 - HALF, 2, 0),
  cabin('houseNE', 27.5, -14.4 - HALF, 2, 0),
  // 서쪽 집(앞면 +x)
  cabin('houseW', -20.4 - HALF, 3, 2, Math.PI / 2),
  // 오른쪽 아래 집: 앞면(+z) 현관 바닥이 광장 안. 수선집 표식(13, -4.6)·표지판(15, -4.6) 오른쪽 뒤
  cabin('houseE', HOUSE_E.x, HOUSE_E.z, 2, 0),
  // 소나무(사람 마을 나무, 요정 키의 약 9배): 모두 경계 바깥
  { id: 'pine1', kind: 'pine', x: -26, z: -17, r: 2.9, collider: null },
  { id: 'pine2', kind: 'pine', x: 24.5, z: -9.5, r: 2.9, collider: null },
  { id: 'pine3', kind: 'pine', x: -29, z: 12, r: 2.9, collider: null },
  { id: 'pine4', kind: 'pine', x: 33, z: -6, r: 2.9, collider: null },
  { id: 'pine5', kind: 'pine', x: 8.5, z: -30, r: 2.9, collider: null },
  { id: 'pine6', kind: 'pine', x: -30, z: -4, r: 2.9, collider: null },
  // 벤치: 광장 남쪽 가장자리(이동 통로 밖)
  bench('benchA', 2.6, 12.1),
  bench('benchB', -7.4, 12.1),
  // 가로등: 길 가장자리. lampF는 골목 입구
  lamp('lampA', 5, -6),
  lamp('lampB', -4, 3),
  lamp('lampC', 12.6, 0.4),
  lamp('lampD', -11, 9),
  lamp('lampE', 13.4, 12.4),
  lamp('lampF', -9, -12.6),
];

/**
 * 화면용 꾸밈(판정 없음). 그래픽 개선 지시서(LAST_GIFT_GRAPHICS_PROMPT.md) · 연출 가이드 §4·§6.
 * - 길: 오른쪽 집 현관 계단 → 광장 → 썰매 뒤 두 집 사이 골목(우편함이 보이는 곳). 사람이 밟아 다진 회청색 눈.
 * - 썰매 날 자국: 썰매가 들어온 쪽(서쪽)에서 눈더미까지 두 줄(날 간격 1.1 m).
 * - 골목: 북쪽 통나무집 houseNW와 Tiny Treats 집 사이 틈(폭 약 4.1)에서 북쪽으로. 1장(우편함 골목)으로 가는 길.
 * - 광장 밖은 플레이 경계 밖이라 충돌체가 없다(요정은 경계 안에서만 움직인다).
 */
export const PLAZA_DRESSING = {
  /** 오른쪽 아래 집 현관(문 앞 바닥). 요정이 서고 선물을 놓을 수 있는 높이 0 바닥 */
  porch: { x: HOUSE_E.x - KENNEY_HOUSE_SCALE / 2, z: HOUSE_E.z + 1.2 * KENNEY_HOUSE_SCALE },
  /** 다진 눈길(현관 → 골목 안). 폭 m */
  path: {
    width: 2.4,
    points: [
      { x: 19.7, z: 11.8 },
      { x: 15.0, z: 11.4 },
      { x: 11.4, z: 6.4 },
      { x: 9.6, z: 1.4 },
      { x: 7.6, z: -3 },
      { x: 6.4, z: -7.4 },
      { x: 3.4, z: -9.8 },
      { x: -1.6, z: -11 },
      { x: -4.4, z: -12.6 },
      { x: -4.7, z: -15.2 },
      { x: -4.7, z: -32 },
    ],
  },
  /** 골목 오른쪽 집과 골목 끝 집(Tiny Treats, 사람 문 높이). 배율·방향이 서로 다르다 */
  alleyHouses: [
    { x: 3.2, z: -23.2, rotY: 0, scale: TT_HOUSE_SCALE },
    { x: -3.6, z: -38, rotY: Math.PI / 2 + 0.12, scale: TT_HOUSE_SCALE * 0.9 },
  ],
  /** 골목 안 우편함(물고기 깃발 = 유나네 표식과 같은 그림) */
  mailbox: { x: -6.1, z: -16.4, rotY: Math.PI / 2 },
  /** 골목 입구(정리가 끝나면 카메라가 이쪽을 조금 보여 준다) */
  alleyMouth: { x: -4.7, z: -14.2 },
  /** 썰매가 들어온 방향(썰매 날 자국이 시작하는 쪽 끝)과 날 간격(썰매 1.8배) */
  sleighEntry: { length: 11, gauge: 2.0 },
  /** 광장 가장자리(카메라 쪽 두 변) 낮은 울타리와 눈둑. 동쪽은 오른쪽 아래 집 앞까지만 */
  fences: [
    { from: { x: -22, z: 14.9 }, to: { x: 21, z: 14.9 } },
    { from: { x: 20.9, z: 14.9 }, to: { x: 20.9, z: 13.4 } }, // 현관 마당을 가로막지 않게 짧게
  ],
};

export const PLAZA_COLLIDERS: readonly Collider[] = PLAZA_PROPS.flatMap((p) => (p.collider ? [p.collider] : []));

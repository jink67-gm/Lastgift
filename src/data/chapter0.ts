// 0장 · 광장에 떨어진 선물 다섯 개(명세서 §4 0장, §5): 그림 이름표를 보고 네 배달지 표식 아래로 나눈다.
// 광장 배치(src/data/plaza.ts)를 그대로 쓰고, 그림 표식 네 곳과 선물 목적지를 더한다.
// 표식 그림은 글자 없이 알아보게: 유나네 = 물고기(1장 물고기 우편함), 수선집 = 단추,
// 민재네 = 눈사람, 할머니 댁 = 트리 있는 집(4장 봉투·수리 상자의 같은 집 그림).
import type { Collider } from '../core/collision';
import type { GiftKind } from './gifts';
import { ALLEYS, PLAZA_BOUNDS, PLAZA_COLLIDERS, SLEIGH } from './plaza';

export type Dest = 'yuna' | 'tailor' | 'minjae' | 'grandma';

export interface Marker {
  dest: Dest;
  /** 내려놓는 자리(원) */
  x: number;
  z: number;
  r: number;
  /** 표지판 위치(놓는 자리 바깥쪽) */
  signX: number;
  signZ: number;
}

/** 표식 = 그 장으로 가는 골목 입구(광장 둘레 안쪽, data/plaza ALLEYS). 표지판은 입구 쪽 */
export const MARKERS: readonly Marker[] = ALLEYS.map((a) => {
  const c = Math.cos((a.deg * Math.PI) / 180), s = Math.sin((a.deg * Math.PI) / 180);
  return { dest: a.dest, x: c * 13, z: s * 13, r: 1.5, signX: c * 14.8, signZ: s * 14.8 };
});

export interface SortGiftDef {
  id: string;
  kind: GiftKind;
  dest: Dest;
  x: number;
  z: number;
  light: boolean;
}

/** 광장에 흩어진 다섯 물건(자리는 시험 광장과 같다) */
/** 광장에 흩어진 물건(트리 둘레 눈밭, 썰매에서 튕겨 나온 쪽) */
export const SORT_GIFTS: readonly SortGiftDef[] = [
  { id: 'sketchbook', kind: 'sketchbook', dest: 'yuna', x: 6, z: 5.5, light: true },
  { id: 'pencils', kind: 'pencils', dest: 'yuna', x: -4.5, z: 6, light: true },
  { id: 'ball', kind: 'ball', dest: 'minjae', x: 7, z: -1.5, light: true },
  { id: 'repair', kind: 'repair', dest: 'grandma', x: -4.5, z: -4.5, light: true },
];

const signs: Collider[] = MARKERS.map((m) => ({ kind: 'circle', x: m.signX, z: m.signZ, r: 0.18 }));

/** 썰매를 받치는 산타(광장 산타 자리 그대로, 썰매 앞쪽 모서리를 본다) */
const SANTA_HOLD = { x: SLEIGH.x + 2.6, z: SLEIGH.z + 2.3, facing: Math.PI * 0.95 };
/** 썰매 날(남쪽 뒤쪽)을 살피는 도토 */
const DOTO_FIX = { x: SLEIGH.x - 1.4, z: SLEIGH.z + 1.85, facing: Math.PI };

export const CH0 = {
  bounds: PLAZA_BOUNDS,
  walls: [...PLAZA_COLLIDERS, ...signs, { kind: 'circle', x: DOTO_FIX.x, z: DOTO_FIX.z, r: 0.4 }] as readonly Collider[],
  santaHold: SANTA_HOLD,
  dotoFix: DOTO_FIX,
  /** 재봉틀 상자(무거움, 두 요정이 양끝을 함께 든다).
   *  0장은 첫 함께 들기 연습이라 수선집 표식까지 11 m 남짓(곧게 가면 5초, 체력은 28초)만 둔다. */
  crateStart: { x: 2.4, z: 4.6, yaw: Math.PI / 2 },
  tailorZone: { x: MARKERS[1]!.x, z: MARKERS[1]!.z, zone: MARKERS[1]!.r },
  // 트리 남쪽(사진기 쪽), 재봉틀 상자 바로 뒤
  spawns: [
    { x: -1.5, z: 8 },
    { x: 1.5, z: 8 },
    { x: -3, z: 9.5 },
    { x: 3, z: 9.5 },
  ],
};

export function markerOf(dest: Dest): Marker {
  return MARKERS.find((m) => m.dest === dest)!;
}

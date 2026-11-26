// 0장 · 광장에 떨어진 선물 다섯 개(명세서 §4 0장, §5): 그림 이름표를 보고 네 배달지 표식 아래로 나눈다.
// 광장 배치(src/data/plaza.ts)를 그대로 쓰고, 그림 표식 네 곳과 선물 목적지를 더한다.
// 표식 그림은 글자 없이 알아보게: 유나네 = 물고기(1장 물고기 우편함), 수선집 = 단추,
// 민재네 = 눈사람, 할머니 댁 = 트리 있는 집(4장 봉투·수리 상자의 같은 집 그림).
import type { Collider } from '../core/collision';
import type { GiftKind } from './gifts';
import { PLAZA_BOUNDS, PLAZA_COLLIDERS } from './plaza';

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

export const MARKERS: readonly Marker[] = [
  { dest: 'yuna', x: -14, z: -3, r: 1.5, signX: -15.9, signZ: -3 },
  { dest: 'tailor', x: 13, z: -4.6, r: 1.5, signX: 15, signZ: -4.6 },
  { dest: 'minjae', x: 8, z: 11, r: 1.5, signX: 8, signZ: 12.9 },
  { dest: 'grandma', x: -14, z: 10, r: 1.5, signX: -15.9, signZ: 10 },
];

export interface SortGiftDef {
  id: string;
  kind: GiftKind;
  dest: Dest;
  x: number;
  z: number;
  light: boolean;
}

/** 광장에 흩어진 다섯 물건(자리는 시험 광장과 같다) */
export const SORT_GIFTS: readonly SortGiftDef[] = [
  { id: 'sketchbook', kind: 'sketchbook', dest: 'yuna', x: 5.5, z: 1.5, light: true },
  { id: 'pencils', kind: 'pencils', dest: 'yuna', x: -2.5, z: 5, light: true },
  { id: 'ball', kind: 'ball', dest: 'minjae', x: 8.5, z: -2.5, light: true },
  { id: 'repair', kind: 'repair', dest: 'grandma', x: -1.5, z: -6.5, light: true },
];

const signs: Collider[] = MARKERS.map((m) => ({ kind: 'circle', x: m.signX, z: m.signZ, r: 0.18 }));

export const CH0 = {
  bounds: PLAZA_BOUNDS,
  walls: [...PLAZA_COLLIDERS, ...signs] as readonly Collider[],
  /** 재봉틀 상자(무거움, 두 요정이 양끝을 함께 든다).
   *  0장은 첫 함께 들기 연습이라 수선집 표식까지 11 m 남짓(곧게 가면 5초, 체력은 28초)만 둔다. */
  crateStart: { x: 0.6, z: -1.2, yaw: Math.PI / 2 },
  tailorZone: { x: MARKERS[1]!.x, z: MARKERS[1]!.z, zone: MARKERS[1]!.r },
  spawns: [
    { x: 2, z: 4.5 },
    { x: 4.2, z: 4.5 },
    { x: 1, z: 6 },
    { x: 5.2, z: 6 },
  ],
};

export function markerOf(dest: Dest): Marker {
  return MARKERS.find((m) => m.dest === dest)!;
}

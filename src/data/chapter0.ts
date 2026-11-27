// 0장 · 광장에 떨어진 선물 다섯 개(명세서 §4 0장, §5): 흩어진 선물을 썰매로 모아 그림 이름표대로 나눈다
// (2026-11-27 사용자 결정: "흩어지면 일단 썰매 쪽으로 모아야", "자루에 넣으면 뒤로 메고 출발, 재봉틀과 공은 따로 든다").
// 썰매 옆: 유나네(물고기)·할머니 댁(트리 집) 그림 자루 둘 — 선물을 넣으면 자루 속으로(그 장을 시작할 때 자루를 등에 메고 출발),
// 민재네(눈사람)·수선집(단추) 그림 깔개 둘 — 축구공·재봉틀은 깔개 위에 놓고 그 장에서 따로 든다(재봉틀은 둘이 함께).
// 골목 입구 그림 표지판(그 장으로 가는 길)은 길 찾기 표시로만 남는다(판정 없음).
// 표식 그림은 글자 없이 알아보게: 유나네 = 물고기(1장 물고기 우편함), 수선집 = 단추,
// 민재네 = 눈사람, 할머니 댁 = 트리 있는 집(4장 봉투·수리 상자의 같은 집 그림).
import type { Collider } from '../core/collision';
import type { GiftKind } from './gifts';
import { ALLEYS, PLAZA_BOUNDS, PLAZA_COLLIDERS, SLEIGH } from './plaza';

export type Dest = 'yuna' | 'tailor' | 'minjae' | 'grandma';

export interface Marker {
  dest: Dest;
  /** 놓는 자리(원): 자루면 자루 둘레, 깔개면 깔개 */
  x: number;
  z: number;
  r: number;
  /** 그림 자루가 있는가(없으면 바닥 그림 깔개 + 작은 그림 팻말) */
  sack: boolean;
  /** 자루 자리(자루) 또는 깔개 옆 작은 팻말 자리 */
  signX: number;
  signZ: number;
}

/**
 * 썰매 옆 놓는 자리. 썰매 남쪽에 물고기 자루, 서쪽 끝에 트리 집 자루·눈사람 깔개·단추 깔개(재봉틀 상자 1.6 × 0.8 자리).
 * 모두 사진기(남동쪽)에서 썰매에 가리지 않는 쪽이고, 트리 화단(반지름 3.2)과 요정 한 걸음 이상 떨어진다.
 * 자루는 자루 둘레 1.1 m 안에 놓거나 자루를 보고 놓으면 자루 속으로 들어간다(core/sorting).
 */
export const MARKERS: readonly Marker[] = [
  { dest: 'yuna', x: 1.2, z: -4.75, r: 1.1, sack: true, signX: 1.2, signZ: -4.75 },
  { dest: 'tailor', x: -3.0, z: -4.1, r: 1.0, sack: false, signX: -3.0, signZ: -5.45 },
  // 눈사람 깔개는 트리 집 자루 서북쪽(썰매 남쪽은 도토·산타와 붙어 카메라 쪽 산타가 가렸다)
  { dest: 'minjae', x: -2.4, z: -7.9, r: 1.0, sack: false, signX: -3.25, signZ: -8.65 },
  { dest: 'grandma', x: -0.7, z: -6.3, r: 1.1, sack: true, signX: -0.7, signZ: -6.3 },
];

/** 길 찾기: 그 장으로 가는 골목 입구 그림 표지판(판정 없음, data/plaza ALLEYS) */
export const ALLEY_SIGNS: readonly { dest: Dest; x: number; z: number }[] = ALLEYS.map((a) => {
  const c = Math.cos((a.deg * Math.PI) / 180), s = Math.sin((a.deg * Math.PI) / 180);
  return { dest: a.dest, x: c * 14.8, z: s * 14.8 };
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

/** 그림 자루 반지름(판정) */
export const SACK_R = 0.45;
/** 자루(둥근 천 자루)·깔개 팻말과 골목 표지판 기둥 */
const signs: Collider[] = [
  ...MARKERS.map((m): Collider => ({ kind: 'circle', x: m.signX, z: m.signZ, r: m.sack ? SACK_R : 0.15 })),
  ...ALLEY_SIGNS.map((m): Collider => ({ kind: 'circle', x: m.x, z: m.z, r: 0.18 })),
];

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
   *  0장은 첫 함께 들기 연습: 썰매 서북쪽에 떨어져 단추 깔개까지 약 4 m(체력은 28초).
   *  썰매에서 서쪽으로 튕겨 나가 트리를 지나지 않는다(트리 남쪽에 두면 트리를 돌아 15 m, 느린 기기에서 체력이 다 됐다) */
  crateStart: { x: -6.2, z: -6.8, yaw: Math.PI / 2 },
  tailorZone: { x: markerOf('tailor').x, z: markerOf('tailor').z, zone: markerOf('tailor').r },
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

// 광장에 흩어진 선물 다섯 개. 재봉틀은 무거워서 혼자 들 수 없다(두 요정이 양끝을 잡는다).
export type GiftKind = 'sketchbook' | 'pencils' | 'sewing' | 'ball' | 'repair';

export interface GiftDef {
  id: string;
  kind: GiftKind;
  x: number;
  z: number;
  /** 혼자 들 수 있는지 */
  light: boolean;
}

export const PLAZA_GIFTS: readonly GiftDef[] = [
  { id: 'sketchbook', kind: 'sketchbook', x: 5.5, z: 1.5, light: true },
  { id: 'pencils', kind: 'pencils', x: -2.5, z: 5, light: true },
  { id: 'sewing', kind: 'sewing', x: -7, z: 0, light: false },
  { id: 'ball', kind: 'ball', x: 8.5, z: -2.5, light: true },
  { id: 'repair', kind: 'repair', x: -1.5, z: -6.5, light: true },
];

/** 무거운 선물의 바닥 크기(충돌용) */
export const SEWING_SIZE = { w: 1.6, d: 0.8 };

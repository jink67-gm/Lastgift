// 0장 광장 배치. 판정용 충돌체와 화면용 소품 배치를 함께 선언한다.
// 좌표: x 오른쪽, z 카메라 쪽. 광장 30 × 20 m, 중심 (0, 0).
import type { Bounds, Collider } from '../core/collision';

export const PLAZA_BOUNDS: Bounds = { minX: -15, maxX: 15, minZ: -10, maxZ: 10 };

export const ELF_SPAWN = { x: 3, z: 4 };

export type PropKind = 'sleigh' | 'snowPile' | 'santa' | 'tree' | 'house' | 'bench' | 'lamp';

export interface Prop {
  id: string;
  kind: PropKind;
  x: number;
  z: number;
  /** 바닥면 크기(m). 사각형은 w·d, 원형은 r */
  w?: number;
  d?: number;
  r?: number;
  rotY?: number;
  collider: Collider | null;
}

const box = (x: number, z: number, w: number, d: number): Collider => ({ kind: 'box', x, z, hx: w / 2, hz: d / 2 });
const circle = (x: number, z: number, r: number): Collider => ({ kind: 'circle', x, z, r });

export const PLAZA_PROPS: readonly Prop[] = [
  // 광장 가운데 눈더미에 처박힌 썰매. 눈더미 하나가 썰매까지 감싸는 충돌체.
  { id: 'snowPile', kind: 'snowPile', x: 0, z: -2, r: 2.2, collider: circle(0, -2, 2.2) },
  { id: 'sleigh', kind: 'sleigh', x: 0, z: -2, w: 3.2, d: 1.6, rotY: 0.35, collider: null },
  { id: 'santa', kind: 'santa', x: 2.9, z: -0.6, r: 0.55, collider: circle(2.9, -0.6, 0.55) },
  { id: 'tree', kind: 'tree', x: -9, z: -6, r: 1.1, collider: circle(-9, -6, 1.1) },
  { id: 'houseWest', kind: 'house', x: -11.5, z: 6, w: 5, d: 4, collider: box(-11.5, 6, 5, 4) },
  { id: 'houseEast', kind: 'house', x: 11, z: -7, w: 5, d: 4, collider: box(11, -7, 5, 4) },
  { id: 'benchA', kind: 'bench', x: 7, z: 5, w: 2, d: 0.6, collider: box(7, 5, 2, 0.6) },
  { id: 'benchB', kind: 'bench', x: -5, z: 7.5, w: 2, d: 0.6, collider: box(-5, 7.5, 2, 0.6) },
  { id: 'lampA', kind: 'lamp', x: 5, z: -6, r: 0.18, collider: circle(5, -6, 0.18) },
  { id: 'lampB', kind: 'lamp', x: -4, z: 3, r: 0.18, collider: circle(-4, 3, 0.18) },
  { id: 'lampC', kind: 'lamp', x: 10, z: 3, r: 0.18, collider: circle(10, 3, 0.18) },
];

export const PLAZA_COLLIDERS: readonly Collider[] = PLAZA_PROPS.flatMap((p) => (p.collider ? [p.collider] : []));

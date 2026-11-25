// 0장 광장 배치. 판정용 충돌체와 화면용 소품 배치를 함께 선언한다.
// 좌표: x 오른쪽, z 카메라 쪽. 광장 40 × 28 m, 중심 (0, 0).
// 남쪽(카메라 쪽)은 비워 두어 시야를 가리지 않는다. 북쪽 가운데 시계탑은 다른 골목에서도 보이는 랜드마크(§3.2).
import type { Bounds, Collider } from '../core/collision';

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

/** 통나무집(가로 2칸 = 4 m, 깊이 cells칸). rotY가 ±π/2면 가로·세로가 바뀐다 */
function cabin(id: string, x: number, z: number, cells: number, rotY: number): Prop {
  const across = 4.4;
  const deep = cells * 2 + 0.4;
  const side = Math.abs(Math.sin(rotY)) > 0.5;
  const w = side ? deep : across;
  const d = side ? across : deep;
  return { id, kind: 'cabin', x, z, w, d, rotY, cells, collider: box(x, z, w, d) };
}

export const PLAZA_PROPS: readonly Prop[] = [
  // 광장 가운데 눈더미에 처박힌 썰매. 눈더미 하나가 썰매까지 감싸는 충돌체.
  { id: 'snowPile', kind: 'snowPile', x: 0, z: -2, r: 2.2, collider: circle(0, -2, 2.2) },
  { id: 'sleigh', kind: 'sleigh', x: 0, z: -2, w: 3.2, d: 1.6, rotY: 0.35, collider: null },
  { id: 'santa', kind: 'santa', x: 2.9, z: -0.6, r: 0.55, collider: circle(2.9, -0.6, 0.55) },
  { id: 'tree', kind: 'tree', x: -9, z: -6, r: 1.3, collider: circle(-9, -6, 1.3) },
  { id: 'clockTower', kind: 'clockTower', x: 0, z: -12, w: 2.4, d: 2.4, collider: box(0, -12, 2.4, 2.4) },
  cabin('houseNW', -12, -10.5, 3, 0),
  cabin('houseNE', 12, -10.5, 3, 0),
  cabin('houseW', -16.5, 4, 3, Math.PI / 2),
  cabin('houseE', 16.5, 2, 3, -Math.PI / 2),
  { id: 'pine1', kind: 'pine', x: -18, z: -12, r: 1.1, collider: circle(-18, -12, 1.1) },
  { id: 'pine2', kind: 'pine', x: 18, z: -12, r: 1.1, collider: circle(18, -12, 1.1) },
  { id: 'pine3', kind: 'pine', x: -17.5, z: 11.5, r: 1.1, collider: circle(-17.5, 11.5, 1.1) },
  { id: 'pine4', kind: 'pine', x: 17.5, z: 11, r: 1.1, collider: circle(17.5, 11, 1.1) },
  { id: 'pine5', kind: 'pine', x: -5.5, z: -11.5, r: 1.1, collider: circle(-5.5, -11.5, 1.1) },
  { id: 'pine6', kind: 'pine', x: 5.5, z: -11.5, r: 1.1, collider: circle(5.5, -11.5, 1.1) },
  { id: 'benchA', kind: 'bench', x: 7, z: 5, w: 1.5, d: 0.85, collider: box(7, 5, 1.5, 0.85) },
  { id: 'benchB', kind: 'bench', x: -5, z: 7.5, w: 1.5, d: 0.85, collider: box(-5, 7.5, 1.5, 0.85) },
  { id: 'lampA', kind: 'lamp', x: 5, z: -6, r: 0.2, collider: circle(5, -6, 0.2) },
  { id: 'lampB', kind: 'lamp', x: -4, z: 3, r: 0.2, collider: circle(-4, 3, 0.2) },
  { id: 'lampC', kind: 'lamp', x: 10, z: 3, r: 0.2, collider: circle(10, 3, 0.2) },
  { id: 'lampD', kind: 'lamp', x: -11, z: 9, r: 0.2, collider: circle(-11, 9, 0.2) },
  { id: 'lampE', kind: 'lamp', x: 12, z: 9, r: 0.2, collider: circle(12, 9, 0.2) },
];

export const PLAZA_COLLIDERS: readonly Collider[] = PLAZA_PROPS.flatMap((p) => (p.collider ? [p.collider] : []));

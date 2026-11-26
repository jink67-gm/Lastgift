// Kenney Holiday Kit(CC0) 조각으로 통나무집과 소품을 만든다. 1칸 = 1단위(×KENNEY_SCALE = 2 m).
// 조각 규칙(직접 재서 확인): 벽 조각은 칸 중심 기준 +z 가장자리에 서 있고, 지붕은 높이 1에 얹는다.
// 시험 조립 화면으로 확인한 배치를 그대로 쓴다. 모델이 없으면 null을 돌려준다(기본 도형으로 대신).
import * as THREE from 'three';
import { KENNEY_SCALE, type ModelName, type Models } from './models';
import { warmPool } from './winterLight';

/** 창·문 안쪽의 살구색 불빛(빛을 받지 않는 재질 = 밤에도 밝게 보인다) */
const WARM = new THREE.MeshBasicMaterial({ color: '#ffc47e' });

const R = { pz: 0, px: Math.PI / 2, nz: Math.PI, nx: -Math.PI / 2 };

export interface CabinOptions {
  /** 앞(+z)에서 본 깊이 칸 수(가로는 2칸 고정: 박공지붕이 가운데서 만난다) */
  depth: number;
  /** 앞벽 왼쪽 칸에 문, 오른쪽 칸에 창(앞 = 회전 전 +z) */
  wreath?: boolean;
}

/** 2 × depth 칸 통나무집. 원점 = 바닥 가운데, 앞 = +z */
export function buildCabin(models: Models, opt: CabinOptions): THREE.Group | null {
  const need: ModelName[] = ['cabinWall', 'cabinCorner', 'cabinDoorway', 'cabinWindow', 'cabinGable', 'cabinRoof'];
  if (!need.every((n) => models.has(n))) return null;
  const g = new THREE.Group();
  const put = (n: ModelName, x: number, y: number, z: number, ry: number, mirror = false) => {
    const o = models.clone(n)!;
    o.position.set(x, y, z);
    o.rotation.y = ry;
    if (mirror) o.scale.x = -1;
    g.add(o);
  };
  const d = opt.depth;
  const zs = Array.from({ length: d }, (_, j) => j - (d - 1) / 2);
  const front = zs[zs.length - 1]!;
  const back = zs[0]!;
  // 앞벽: 왼쪽 문 + 오른쪽 창 / 뒷벽
  put('cabinDoorway', -0.5, 0, front, R.pz);
  put('cabinWindow', 0.5, 0, front, R.pz);
  put('cabinWall', -0.5, 0, back, R.nz);
  put('cabinWall', 0.5, 0, back, R.nz);
  // 옆벽
  zs.forEach((z, j) => {
    put(j === 0 && opt.wreath && models.has('cabinWreath') ? 'cabinWreath' : 'cabinWall', 0.5, 0, z, R.px);
    put(j === d - 1 && opt.wreath && models.has('cabinWreath') ? 'cabinWreath' : 'cabinWall', -0.5, 0, z, R.nx);
  });
  // 모서리 기둥
  put('cabinCorner', 0.5, 0, front, 0);
  put('cabinCorner', 0.5, 0, back, Math.PI / 2);
  put('cabinCorner', -0.5, 0, back, Math.PI);
  put('cabinCorner', -0.5, 0, front, -Math.PI / 2);
  // 박공(앞뒤)과 눈 덮인 지붕(가운데에서 만난다)
  put('cabinGable', 0.5, 1, front, R.pz);
  put('cabinGable', -0.5, 1, front, R.pz, true);
  put('cabinGable', 0.5, 1, back, R.nz, true);
  put('cabinGable', -0.5, 1, back, R.nz);
  for (const z of zs) {
    put('cabinRoof', 0.5, 1, z, 0);
    put('cabinRoof', -0.5, 1, z, Math.PI);
  }
  // 사람이 사는 집: 창과 문 안쪽에 따뜻한 불빛, 문 앞 눈 위에 빛 웅덩이(연출 가이드 §6)
  const edge = front + 0.5;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.36), WARM);
  pane.position.set(0.5, 0.5, edge - 0.09);
  g.add(pane);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.78), WARM);
  door.position.set(-0.5, 0.39, edge - 0.14);
  g.add(door);
  const pool = warmPool(0.75);
  pool.position.set(-0.3, 0.004, edge + 0.55);
  g.add(pool);
  g.scale.setScalar(KENNEY_SCALE);
  return g;
}

/** 소품 하나(바닥 원점 그대로), 크기 배율 적용 */
export function kenneyProp(models: Models, n: ModelName, scale = KENNEY_SCALE): THREE.Object3D | null {
  const o = models.clone(n);
  if (!o) return null;
  o.scale.setScalar(scale);
  return o;
}

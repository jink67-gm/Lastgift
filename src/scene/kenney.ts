// Kenney Holiday Kit(CC0) 조각으로 통나무집과 소품을 만든다. 1칸 = 1단위(×KENNEY_SCALE = 2 m).
// 조각 규칙(직접 재서 확인): 벽 조각은 칸 중심 기준 +z 가장자리에 서 있고(두께 0.3~0.7 → 바깥면은 칸 가장자리 + 0.2),
// 지붕은 높이 1에 얹는다. 그래서 2 × N칸 집의 바깥 둘레는 (2 + 0.4) × (N + 0.4)단위다.
// 시험 조립 화면으로 확인한 배치를 그대로 쓴다. 모델이 없으면 null을 돌려준다(기본 도형으로 대신).
import * as THREE from 'three';
import { KENNEY_SCALE, type ModelName, type Models } from './models';
import { TOWN } from '../data/townScale';
import { warmPool } from './winterLight';

/** 창·문 안쪽의 살구색 불빛(빛을 받지 않는 재질 = 밤에도 밝게 보인다) */
const WARM = new THREE.MeshBasicMaterial({ color: '#ffc47e' });
const DOOR = new THREE.MeshStandardMaterial({ color: '#7a4a2c', roughness: 0.85 });
const DOOR_DARK = new THREE.MeshStandardMaterial({ color: '#5c361f', roughness: 0.9 });
const KNOB = new THREE.MeshStandardMaterial({ color: '#d8b04a', metalness: 0.6, roughness: 0.35 });
const STONE = new THREE.MeshStandardMaterial({ color: '#a9a39a', roughness: 0.95 });

const R = { pz: 0, px: Math.PI / 2, nz: Math.PI, nx: -Math.PI / 2 };

export interface CabinOptions {
  /** 앞(+z)에서 본 깊이 칸 수(가로는 2칸 고정: 박공지붕이 가운데서 만난다) */
  depth: number;
  /** 앞벽 왼쪽 칸에 문, 오른쪽 칸에 창(앞 = 회전 전 +z) */
  wreath?: boolean;
  /** 배율(기본 KENNEY_SCALE). 사람 집은 KENNEY_HOUSE_SCALE(문 열린 부분 = 요정 키 × 4.5) */
  scale?: number;
  /** 문손잡이 높이(게임 단위). 기본 = 사람 손 높이(TOWN.doorKnob) */
  knob?: number;
  /** 창·문 안쪽 불빛 색(공방은 따뜻한 노랑) */
  warm?: string;
  /** 통나무 색을 중간 밝기 갈색으로 누르는 곱하기 색(재질을 이 집만 따로 만든다) */
  tint?: string;
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
  // 사람 문: 열린 부분(폭 0.5 × 높이 0.8단위)에 바깥으로 조금 열린 문짝 + 사람 손 높이의 손잡이(요정 키 × 2) + 낮은 문턱
  const s = opt.scale ?? KENNEY_SCALE;
  const hinge = new THREE.Group();
  // 문짝은 안쪽으로 열린다: 문 앞에 선 요정을 가리지 않고, 열린 틈으로 안쪽 불빛이 보인다
  hinge.position.set(-0.75, 0, edge - 0.17);
  hinge.rotation.y = 1.0;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.035), DOOR);
  leaf.position.set(0.25, 0.4, 0);
  hinge.add(leaf);
  for (const y of [0.18, 0.62]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.05), DOOR_DARK);
    plank.position.set(0.25, y, 0.01);
    hinge.add(plank);
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), KNOB);
  knob.position.set(0.44, (opt.knob ?? TOWN.doorKnob) / s, 0.035);
  hinge.add(knob);
  g.add(hinge);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.2), STONE);
  sill.position.set(-0.5, 0.015, edge + 0.28);
  g.add(sill);
  const warm = opt.warm ? new THREE.MeshBasicMaterial({ color: opt.warm }) : WARM;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.36), warm);
  pane.position.set(0.5, 0.5, edge - 0.09);
  g.add(pane);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.78), warm);
  door.position.set(-0.5, 0.39, edge - 0.62); // 안쪽으로 열린 문짝 뒤
  // 문 안쪽 바닥 그늘(문턱 너머가 깊어 보이게)
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.45), new THREE.MeshBasicMaterial({ color: '#3a2a22', transparent: true, opacity: 0.55, depthWrite: false }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.set(-0.5, 0.004, edge - 0.3);
  g.add(inner);
  g.add(door);
  const pr = Math.min(0.75, 2.4 / s); // 문 앞 빛 웅덩이: 땅에서 반지름 약 2.4
  const pool = warmPool(pr);
  pool.position.set(-0.4, 0.004, edge + 0.2 + pr * 0.8);
  g.add(pool);
  if (opt.tint) {
    const tint = new THREE.Color(opt.tint);
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.material === warm || m.material === WARM) return;
      const own = (m.material as THREE.MeshStandardMaterial).clone();
      if (own.map) own.color.copy(tint); // 텍스처를 쓰는 Kenney 조각만(덧붙인 문짝·문턱은 그대로)
      m.material = own;
    });
  }
  g.scale.setScalar(s);
  return g;
}

/** 소품 하나(바닥 원점 그대로), 크기 배율 적용 */
export function kenneyProp(models: Models, n: ModelName, scale = KENNEY_SCALE): THREE.Object3D | null {
  const o = models.clone(n);
  if (!o) return null;
  o.scale.setScalar(scale);
  return o;
}

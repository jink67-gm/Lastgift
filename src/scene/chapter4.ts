// 4장 공간 그리기: 눈 덮인 담장길 → 정원 담장·정원문(너머로 불 꺼진 트리 꼭대기) → 할머니네 정원.
// 트리(전구 줄 셋 + 꼭대기 별), 트리 밑동 단자 셋, 도토의 손발전기(바늘·별 표시)·연결판, 전선, 스위치 둘,
// 눈에 반쯤 묻힌 큰 장식, 할머니의 삼각대 사진기. 배치는 src/data/chapter4.ts만 따른다(판정과 같은 값).
import * as THREE from 'three';
import {
  CH4_START,
  GARDEN,
  GARDEN_WALL,
  GRANDMA_HOUSE,
  LANE_HALF,
  ORNAMENTS,
  PADS,
  SWITCHES,
  TERMINALS,
  TREE,
  TRIPOD,
  W,
  WIRES,
  type SwitchId,
  type WireColor,
  type WireShape,
} from '../data/chapter4';
import { YAW } from '../data/lane';
import { kenneyProp } from './kenney';
import type { Models } from './models';
import { townLamp } from './plaza';
import { alleyHouse, berm, contactShadow, footprints, packedPath, roundedBox, type Detail } from './plazaDressing';
import { warmPool } from './winterLight';

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const snowMat = std('#f4f7fc', { roughness: 1 });
export const WIRE_HEX: Record<WireColor, string> = { red: '#e0342f', blue: '#2f6fd0', yellow: '#f0c020' };

const at = (s: number, t: number, y = 0) => {
  const p = W(s, t);
  return new THREE.Vector3(p.x, y, p.z);
};

/** 표시 도형(평면, 원점 가운데, +z를 본다) */
export function shapeMesh(shape: WireShape, size: number, color: string): THREE.Mesh {
  let geo: THREE.BufferGeometry;
  if (shape === 'circle') geo = new THREE.CircleGeometry(size * 0.5, 24);
  else if (shape === 'triangle') geo = new THREE.CircleGeometry(size * 0.6, 3, Math.PI / 2);
  else geo = new THREE.PlaneGeometry(size * 0.85, size * 0.85);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
}

/** 돌담 한 칸(길 좌표 a → b), 높이 h, 위에 눈 */
function stoneWall(a: { s: number; t: number }, b: { s: number; t: number }, h: number, thick = 0.6): THREE.Group {
  const g = new THREE.Group();
  const pa = at(a.s, a.t), pb = at(b.s, b.t);
  const len = pa.distanceTo(pb);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, thick), std('#a9a39a', { roughness: 0.95 }));
  wall.position.y = h / 2;
  g.add(wall);
  // 돌 줄눈(가로 띠)
  for (let y = 0.6; y < h - 0.2; y += 0.7) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.05, thick + 0.02), std('#8d877e'));
    band.position.y = y;
    g.add(band);
  }
  const cap = new THREE.Mesh(roundedBox(len + 0.1, 0.28, thick + 0.3), snowMat);
  cap.position.y = h + 0.1;
  g.add(cap);
  g.position.copy(pa.clone().add(pb).multiplyScalar(0.5));
  g.rotation.y = -Math.atan2(pb.z - pa.z, pb.x - pa.x);
  g.userData.fadeable = true;
  return g;
}

/** 생울타리(둥근 덤불 줄) */
function hedge(a: { s: number; t: number }, b: { s: number; t: number }, h = 1.9): THREE.Group {
  const g = new THREE.Group();
  const pa = at(a.s, a.t), pb = at(b.s, b.t);
  const len = pa.distanceTo(pb);
  const body = new THREE.Mesh(roundedBox(len, h, 1.1), std('#3f6a4a', { roughness: 1 }));
  body.position.y = h / 2;
  g.add(body);
  const cap = new THREE.Mesh(roundedBox(len + 0.05, 0.3, 1.2), snowMat);
  cap.position.y = h;
  g.add(cap);
  g.position.copy(pa.clone().add(pb).multiplyScalar(0.5));
  g.rotation.y = -Math.atan2(pb.z - pa.z, pb.x - pa.x);
  g.userData.fadeable = true;
  return g;
}

export interface Tree {
  group: THREE.Group;
  /** 전구 줄 밝기(0~1, 줄마다) */
  setString(c: WireColor, k: number): void;
  /** 불 켜기 진행(0~1): 아래 가지부터 꼭대기 별까지 */
  setLit(k: number): void;
}

/** 큰 트리: 층층 원뿔 + 눈 + 큰 장식 + 전구 줄 셋(나선) + 꼭대기 별 */
function bigTree(): Tree {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.6, 10), std('#6a4a32'));
  trunk.position.y = 0.8;
  g.add(trunk);
  const H = TREE.height;
  const tiers = [
    { y: 1.1, r: 3.0, h: 3.4 },
    { y: 3.3, r: 2.4, h: 3.0 },
    { y: 5.2, r: 1.8, h: 2.6 },
    { y: 6.9, r: 1.2, h: 2.4 },
  ];
  const green = std('#2e6a3e', { roughness: 0.95, flatShading: true });
  for (const t of tiers) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 14), green);
    c.position.y = t.y + t.h / 2;
    g.add(c);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(t.r * 0.55, t.h * 0.32, 14), snowMat);
    snow.position.y = t.y + t.h * 0.86;
    g.add(snow);
  }
  // 큰 장식 공(불 꺼져도 보이는 장식)
  const deco = ['#d23a3a', '#e0b021', '#7a4ad0', '#f2f2f2'];
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39;
    const y = 1.6 + (i / 16) * (H - 3.4);
    const r = radiusAt(y) * 0.92;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), std(deco[i % 4]!, { roughness: 0.4, metalness: 0.2 }));
    b.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    g.add(b);
  }
  // 전구 줄 셋: 서로 어긋난 나선. 아래에서 위로 순서를 기억(불 켜기 진행)
  const bulbs: { mesh: THREE.Mesh; color: WireColor; h: number }[] = [];
  WIRES.forEach((w, wi) => {
    const mat = new THREE.MeshStandardMaterial({ color: WIRE_HEX[w.color], emissive: WIRE_HEX[w.color], emissiveIntensity: 0, roughness: 0.4 });
    const n = 26;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const y = 1.3 + k * (H - 2.6);
      const a = k * Math.PI * 7 + (wi * Math.PI * 2) / 3;
      const r = radiusAt(y) * 0.98 + 0.05;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat.clone());
      m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      g.add(m);
      bulbs.push({ mesh: m, color: w.color, h: k });
    }
  });
  // 꼭대기 별
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.28 : 0.62;
    if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starMat = new THREE.MeshStandardMaterial({ color: '#d8c27a', emissive: '#ffd84a', emissiveIntensity: 0, roughness: 0.4, metalness: 0.3 });
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.16, bevelEnabled: false }), starMat);
  star.position.set(0, H + 0.1, -0.08);
  g.add(star);
  const glow = new THREE.PointLight('#ffcf7a', 0, 14, 1.6);
  glow.position.set(0, H * 0.45, 2.5);
  g.add(glow);
  g.add(contactShadow(7, 7, 0.32));
  const strings: Record<WireColor, number> = { red: 0, blue: 0, yellow: 0 };
  let lit = 0;
  const apply = () => {
    for (const b of bulbs) {
      const on = Math.max(strings[b.color], lit >= b.h ? 1 : 0);
      (b.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.8 * on;
    }
    starMat.emissiveIntensity = lit >= 1 ? 2.2 : 0;
    starMat.color.set(lit >= 1 ? '#ffe680' : '#d8c27a');
    glow.intensity = 30 * lit;
  };
  apply();
  return {
    group: g,
    setString(c, k) {
      if (strings[c] === k) return;
      strings[c] = k;
      apply();
    },
    setLit(k) {
      if (lit === k) return;
      lit = k;
      apply();
    },
  };
  function radiusAt(y: number): number {
    // 층 원뿔 겉면 반지름(대략)
    for (let i = tiers.length - 1; i >= 0; i--) {
      const t = tiers[i]!;
      if (y >= t.y) return Math.max(0.2, t.r * (1 - (y - t.y) / t.h));
    }
    return tiers[0]!.r;
  }
}

/** 트리 밑동 단자: 작은 기둥 + 색·도형 표시 + 꽂는 구멍 */
function terminal(color: WireColor, shape: WireShape): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), std('#3b3f4a'));
  post.position.y = 0.4;
  g.add(post);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.06), std('#f2efe6'));
  plate.position.set(0, 0.55, 0.27);
  g.add(plate);
  const sign = shapeMesh(shape, 0.4, WIRE_HEX[color]);
  sign.position.set(0, 0.55, 0.31);
  g.add(sign);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), std('#111'));
  hole.position.set(0, 0.82, 0);
  g.add(hole);
  const cap = new THREE.Mesh(roundedBox(0.6, 0.1, 0.6), snowMat);
  cap.position.y = 0.86;
  g.add(cap);
  return g;
}

/** 전선 끝(꽂는 머리): 색 원통 + 도형 표시. 원점 = 바닥 */
export function plugMesh(color: WireColor, shape: WireShape): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 12), std(WIRE_HEX[color], { roughness: 0.5 }));
  body.position.y = 0.15;
  g.add(body);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), std('#c9c9c9', { metalness: 0.6, roughness: 0.3 }));
  pin.position.y = 0.36;
  g.add(pin);
  const tag = shapeMesh(shape, 0.2, '#ffffff');
  tag.position.set(0, 0.16, 0.125);
  g.add(tag);
  return g;
}

/** 도토의 손발전기: 상자 + 돌리는 손잡이 + 바늘 계기(별 표시). 원점 = 바닥 */
export function generatorMesh(): { group: THREE.Group; setCharge(k: number): void; crank: THREE.Object3D } {
  const g = new THREE.Group();
  const box = new THREE.Mesh(roundedBox(0.7, 0.5, 0.5), std('#e07a2a'));
  box.position.y = 0.3;
  g.add(box);
  const crank = new THREE.Group();
  crank.position.set(0.38, 0.32, 0);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.06), std('#3b3f4a'));
  arm.position.y = 0.14;
  crank.add(arm);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), std('#d23a3a'));
  knob.rotation.z = Math.PI / 2;
  knob.position.set(0.08, 0.28, 0);
  crank.add(knob);
  crank.rotation.order = 'ZXY';
  g.add(crank);
  // 계기: 흰 반원 + 오른쪽 끝 노란 별 + 바늘
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }));
  face.position.set(-0.05, 0.42, 0.26);
  g.add(face);
  const starMark = shapeMesh('circle', 0.08, '#f0b429');
  starMark.position.set(-0.05 + 0.17, 0.43, 0.262);
  g.add(starMark);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.18, 0.01), new THREE.MeshBasicMaterial({ color: '#1b2433' }));
  needle.geometry.translate(0, 0.09, 0);
  needle.position.set(-0.05, 0.42, 0.265);
  g.add(needle);
  g.add(contactShadow(0.9, 0.7, 0.25));
  return {
    group: g,
    crank,
    setCharge(k) {
      needle.rotation.z = Math.PI / 2 - k * Math.PI; // 왼쪽(0) → 오른쪽 별(1)
    },
  };
}

/** 연결판: 나무판 + 구멍 셋 + 가운데 전기 표시 */
export function boardMesh(): THREE.Group {
  const g = new THREE.Group();
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.5), std('#b5703f'));
  plank.position.y = 0.2;
  g.add(plank);
  for (const [x, z] of [[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.18], [0.3, 0.18]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), std('#7a4a2a'));
    leg.position.set(x!, 0.1, z!);
    g.add(leg);
  }
  WIRES.forEach((w, i) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10), std(WIRE_HEX[w.color]));
    s.position.set(-0.25 + i * 0.25, 0.25, 0.1);
    g.add(s);
  });
  const bolt = shapeMesh('triangle', 0.18, '#f0b429');
  bolt.rotation.x = -Math.PI / 2;
  bolt.position.set(0, 0.246, -0.12);
  g.add(bolt);
  g.add(contactShadow(1.0, 0.7, 0.22));
  return g;
}

/** 스위치 기둥: 큰 둥근 버튼 + 작은 등 */
function switchPost(): { group: THREE.Group; set(on: boolean, ready: boolean): void } {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), std('#3b3f4a'));
  post.position.y = 0.6;
  g.add(post);
  const box = new THREE.Mesh(roundedBox(0.7, 0.55, 0.35), std('#f2efe6'));
  box.position.set(0, 1.2, 0.05);
  g.add(box);
  const btnMat = new THREE.MeshStandardMaterial({ color: '#d23a3a', emissive: '#ff4a3a', emissiveIntensity: 0, roughness: 0.4 });
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 18), btnMat);
  btn.rotation.x = Math.PI / 2;
  btn.position.set(0, 1.2, 0.25);
  g.add(btn);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#555', emissive: '#7cff7a', emissiveIntensity: 0 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lampMat);
  lamp.position.set(0, 1.55, 0.05);
  g.add(lamp);
  const cap = new THREE.Mesh(roundedBox(0.8, 0.12, 0.45), snowMat);
  cap.position.y = 1.52;
  g.add(cap);
  g.add(contactShadow(0.9, 0.9, 0.25));
  return {
    group: g,
    set(on, ready) {
      btn.position.z = on ? 0.2 : 0.25;
      btnMat.emissiveIntensity = on ? 1.4 : ready ? 0.35 : 0;
      lampMat.emissiveIntensity = on ? 1.6 : 0;
      lampMat.color.set(on ? '#7cff7a' : '#555');
    },
  };
}

/** 눈에 반쯤 묻힌 큰 장식 공 */
function buriedOrnament(r: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), std(color, { roughness: 0.35, metalness: 0.25 }));
  ball.position.y = r * 0.35;
  g.add(ball);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.22, r * 0.25, 10), std('#c9a24a', { metalness: 0.5, roughness: 0.4 }));
  top.position.set(r * 0.3, r * 1.3, 0);
  top.rotation.z = -0.4;
  g.add(top);
  const drift = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), snowMat);
  drift.scale.set(1, 0.42, 1);
  g.add(drift);
  return g;
}

/** 할머니의 삼각대 사진기 */
function tripodCamera(): THREE.Group {
  const g = new THREE.Group();
  const legM = std('#3b3f4a');
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), legM);
    leg.position.set(Math.cos(a) * 0.35, 1.15, Math.sin(a) * 0.35);
    leg.rotation.set(Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28);
    g.add(leg);
  }
  const body = new THREE.Mesh(roundedBox(0.6, 0.42, 0.34), std('#2a2d35'));
  body.position.y = 2.45;
  g.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.24, 14), std('#15171c'));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 2.45, 0.26);
  g.add(lens);
  const flash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.06), std('#f2f2f2'));
  flash.position.set(0.16, 2.7, 0.05);
  g.add(flash);
  return g;
}

export interface Ch4Scene {
  root: THREE.Group;
  tree: Tree;
  /** 정원문(0 닫힘 ~ 1 열림) */
  setGate(open: number): void;
  setSwitch(id: SwitchId, on: boolean, ready: boolean): void;
  /** 트리 앞 자리(발전기·연결판 놓는 곳) 표시 */
  pads: Record<'generator' | 'board', THREE.Object3D>;
  /** 연결판에서 전선이 나가는 곳(월드) */
  boardOut: Record<WireColor, THREE.Vector3>;
  /** 단자 구멍(월드) */
  socket: Record<WireColor, THREE.Vector3>;
  /** 할머니 사진기(월드, 05d 사진 장면) */
  tripod: THREE.Vector3;
  update(t: number): void;
}

export function createChapter4Scene(models: Models, base: string, detail: Detail): Ch4Scene {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), std('#eef2f8', { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.copy(at(16, 0, -0.01));
  ground.userData.flat = true;
  root.add(ground);

  // 다진 눈길: 담장길 → 정원문 → 트리 앞
  root.add(packedPath(base, detail, { width: 2.2, points: [W(-5, 0), W(6, 0.3), W(GARDEN_WALL.s, 0), W(17.5, -1.8), W(TREE.s - 4.6, 0)] }));
  root.add(footprints([W(-4.5, -0.4), W(-2, 0.3), W(2, -0.2)]));

  // 담장길: 왼쪽 돌담, 오른쪽 생울타리
  root.add(stoneWall({ s: -6, t: -LANE_HALF - 0.3 }, { s: GARDEN_WALL.s, t: -LANE_HALF - 0.3 }, 2.0));
  root.add(hedge({ s: -6, t: LANE_HALF + 0.5 }, { s: GARDEN_WALL.s, t: LANE_HALF + 0.5 }));
  root.add(berm([W(-6.6, -LANE_HALF - 1), W(-7, 0), W(-6.6, LANE_HALF + 1)], 2.6, 0.6, 9));

  // 정원 담장(사람 키 가까이, 요정보다 훨씬 높다) + 정원문(나무 두 짝, 안쪽으로 열린다)
  const gw = GARDEN_WALL;
  root.add(stoneWall({ s: gw.s, t: -GARDEN.half }, { s: gw.s, t: gw.gate[0] }, gw.height));
  root.add(stoneWall({ s: gw.s, t: gw.gate[1] }, { s: gw.s, t: GARDEN.half }, gw.height));
  const leaves: THREE.Group[] = [];
  for (const [i, t] of gw.gate.entries()) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, gw.height + 0.6, 0.7), std('#9c8d76'));
    post.position.copy(at(gw.s, t + (i === 0 ? -0.35 : 0.35), (gw.height + 0.6) / 2));
    root.add(post);
    const cap = new THREE.Mesh(roundedBox(0.85, 0.2, 0.85), snowMat);
    cap.position.copy(at(gw.s, t + (i === 0 ? -0.35 : 0.35), gw.height + 0.7));
    root.add(cap);
    const hinge = new THREE.Group();
    hinge.position.copy(at(gw.s, t));
    // 왼쪽 문짝은 +t로, 오른쪽 문짝은 -t로 뻗는다(닫힘). 열면 정원 안쪽(+s)으로 젖혀진다
    hinge.rotation.y = YAW.back + (i === 0 ? 0 : Math.PI);
    const w = (gw.gate[1] - gw.gate[0]) / 2;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, gw.height * 0.8, 0.1), std('#7a4a2a'));
    leaf.position.set(w / 2, gw.height * 0.42, 0);
    hinge.add(leaf);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12), std('#c9a24a', { metalness: 0.5 }));
    ring.position.set(w - 0.2, gw.height * 0.45, 0.07);
    hinge.add(ring);
    root.add(hinge);
    leaves.push(hinge);
  }
  // 정원 양옆 생울타리, 뒤 할머니네 집
  root.add(hedge({ s: GARDEN.front, t: -GARDEN.half - 0.4 }, { s: GARDEN.back, t: -GARDEN.half - 0.4 }, 2.3));
  root.add(hedge({ s: GARDEN.front, t: GARDEN.half + 0.4 }, { s: GARDEN.back, t: GARDEN.half + 0.4 }, 2.3));
  const hc = at(GRANDMA_HOUSE.s, GRANDMA_HOUSE.t);
  root.add(alleyHouse(models, { x: hc.x, z: hc.z, rotY: YAW.back, scale: GRANDMA_HOUSE.scale }));
  const porch = warmPool(3.2);
  porch.position.copy(at(GARDEN.back - 1.2, GRANDMA_HOUSE.t + 0.8 * GRANDMA_HOUSE.scale, 0.006));
  root.add(porch);

  // 트리 + 단자 + 자리 표시
  const tree = bigTree();
  tree.group.position.copy(at(TREE.s, TREE.t));
  root.add(tree.group);
  const socket = {} as Record<WireColor, THREE.Vector3>;
  for (const w of WIRES) {
    const tm = terminal(w.color, w.shape);
    const p = TERMINALS[w.color];
    tm.position.copy(at(p.s, p.t));
    // 표시판은 늘 사진기 쪽을 본다(옆 단자도 읽히게)
    tm.rotation.y = YAW.back;
    tm.scale.setScalar(1.35);
    root.add(tm);
    socket[w.color] = at(p.s, p.t, 0.84 * 1.35);
  }
  const pads = {} as Record<'generator' | 'board', THREE.Object3D>;
  for (const k of ['generator', 'board'] as const) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(PADS[k].r - 0.16, PADS[k].r, 32), new THREE.MeshBasicMaterial({ color: k === 'generator' ? '#e07a2a' : '#b5703f', transparent: true, opacity: 0.6, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(at(PADS[k].s, PADS[k].t, 0.02));
    ring.userData.flat = true;
    root.add(ring);
    pads[k] = ring;
  }
  const boardOut = {} as Record<WireColor, THREE.Vector3>;
  WIRES.forEach((w, i) => (boardOut[w.color] = at(PADS.board.s, PADS.board.t - 0.25 + i * 0.25, 0.26)));

  // 스위치 둘
  const sw = {} as Record<SwitchId, ReturnType<typeof switchPost>>;
  for (const id of ['A', 'B'] as SwitchId[]) {
    const p = switchPost();
    p.group.position.copy(at(SWITCHES[id].s, SWITCHES[id].t));
    p.group.rotation.y = YAW.back;
    p.group.scale.setScalar(1.3);
    root.add(p.group);
    sw[id] = p;
  }

  // 반쯤 묻힌 장식, 삼각대 사진기, 다 쓴 수리 상자
  for (const o of ORNAMENTS) {
    const m = buriedOrnament(o.r, o.color);
    m.position.copy(at(o.s, o.t));
    root.add(m);
  }
  const tri = tripodCamera();
  tri.position.copy(at(TRIPOD.s, TRIPOD.t));
  const look = at(TREE.s, TREE.t).sub(at(TRIPOD.s, TRIPOD.t));
  tri.rotation.y = Math.atan2(look.x, look.z);
  root.add(tri);
  const box = new THREE.Group();
  const boxBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), std('#2f9a4a'));
  boxBody.position.y = 0.25;
  box.add(boxBody);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.6), std('#2f9a4a'));
  lid.position.set(0, 0.6, -0.3);
  lid.rotation.x = -1.2;
  box.add(lid);
  box.position.set(CH4_START.box.x, 0, CH4_START.box.z);
  box.rotation.y = YAW.back + 0.3;
  root.add(box);

  // 바깥: 나무·가로등
  for (const [s, t, n] of [[-2, -8, 'treeSnowA'], [6, 8, 'treeSnowB'], [20, -14, 'treeSnowB'], [30, 14, 'treeSnowA'], [36, -13, 'treeSnowA']] as const) {
    const tr = kenneyProp(models, n, 4.2);
    if (!tr) continue;
    tr.position.copy(at(s, t));
    tr.userData.fadeable = true;
    root.add(tr);
  }
  for (const [s, t] of [[4, LANE_HALF + 1.6], [7, -LANE_HALF - 1.2]] as const) {
    const l = townLamp();
    l.position.copy(at(s, t));
    l.userData.fadeable = true;
    root.add(l);
  }

  return {
    root,
    tree,
    pads,
    boardOut,
    socket,
    tripod: at(TRIPOD.s, TRIPOD.t, 2.45),
    setGate(open) {
      leaves.forEach((h, i) => (h.rotation.y = YAW.back + (i === 0 ? open * 1.5 : Math.PI - open * 1.5)));
    },
    setSwitch(id, on, ready) {
      sw[id].set(on, ready);
    },
    update() {},
  };
}

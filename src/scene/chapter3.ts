// 3장 공간 그리기: 요정 공방 옆문 → 낮은 울타리 샛길(쪽문 셋) → 열린 대문 → 민재네 마당.
// 배치는 src/data/chapter3.ts만 따른다(판정과 같은 값). 사람(민재·식구)은 사용자 에셋을 받아 넣는다(05b).
import * as THREE from 'three';
import {
  BALL_SPOT,
  FENCES,
  GATES,
  MINJAE_HOUSE,
  OBSTACLES,
  PATH_HALF,
  WORKSHOP,
  YARD_BACK,
  W,
} from '../data/chapter3';
import { YAW } from '../data/lane';
import { WORKSHOP as PLAZA_WORKSHOP } from '../data/plaza';
import { FENCE_SCALE, TOWN } from '../data/townScale';
import { buildCabin, kenneyProp } from './kenney';
import type { Models } from './models';
import { townLamp } from './plaza';
import { alleyHouse, berm, contactShadow, edgeFence, footprints, packedPath, roundedBox, type Detail } from './plazaDressing';
import { createWorkshopSign } from './workshop';
import { warmPool } from './winterLight';

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const snowMat = std('#f4f7fc', { roughness: 1 });
const wood = std('#7a4a2a', { roughness: 0.9 });
const plank = std('#b5703f', { roughness: 0.9 });

const at = (s: number, t: number, y = 0) => {
  const p = W(s, t);
  return new THREE.Vector3(p.x, y, p.z);
};

/** 쪽문: 기둥 둘 + 판자문(경첩 쪽에서 열린다). 원점 = 문 가운데, 문 판은 x축 */
function sideGate(width: number): { group: THREE.Group; leaf: THREE.Object3D } {
  const g = new THREE.Group();
  const h = TOWN.fence;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, h + 0.4, 0.24), wood);
    post.position.set((sx * width) / 2, (h + 0.4) / 2, 0);
    g.add(post);
    const cap = new THREE.Mesh(roundedBox(0.34, 0.12, 0.34), snowMat);
    cap.position.set((sx * width) / 2, h + 0.45, 0);
    g.add(cap);
  }
  // 경첩(왼쪽 기둥)에서 도는 문 판
  const hinge = new THREE.Group();
  hinge.position.x = -width / 2 + 0.12;
  const leaf = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, h * 0.8, 0.07), plank);
    b.position.set(0.2 + i * ((width - 0.4) / 4) + 0.06, h * 0.45, 0);
    leaf.add(b);
  }
  for (const y of [0.25, 0.65]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width - 0.3, 0.09, 0.1), wood);
    rail.position.set((width - 0.3) / 2, h * y, 0.05);
    leaf.add(rail);
  }
  // 빗장(두 손으로 들어 올리는 노란 막대): 공을 든 요정은 못 연다
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.12), std('#e0b021', { roughness: 0.6 }));
  bar.position.set(width - 0.45, h * 0.55, 0.12);
  leaf.add(bar);
  hinge.add(leaf);
  g.add(hinge);
  return { group: g, leaf: hinge };
}

/** 장작 더미 */
function logs(): THREE.Group {
  const g = new THREE.Group();
  const bark = std('#8a5a3a');
  const cut = std('#d9b27a');
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 4 - row; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.8, 10), [bark, cut, cut]);
      l.rotation.z = Math.PI / 2;
      l.position.set(0, 0.22 + row * 0.38, (i - (3 - row) / 2) * 0.46);
      g.add(l);
    }
  const cap = new THREE.Mesh(roundedBox(1.9, 0.16, 1.2), snowMat);
  cap.position.y = 1.15;
  g.add(cap);
  g.add(contactShadow(2.4, 2.2, 0.28));
  return g;
}

/** 콩이가 지내는 종이 상자(옆으로 누운 상자 + 낡은 담요) */
function dogBox(): THREE.Group {
  const g = new THREE.Group();
  const card = std('#c79a62', { roughness: 1 });
  const w = 1.2, h = 0.85, d = 1.0;
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, card);
    m.position.set(x, y, z);
    g.add(m);
  };
  add(new THREE.BoxGeometry(w, 0.05, d), 0, 0.025, 0);
  add(new THREE.BoxGeometry(w, 0.05, d), 0, h, 0);
  add(new THREE.BoxGeometry(0.05, h, d), -w / 2, h / 2, 0);
  add(new THREE.BoxGeometry(0.05, h, d), w / 2, h / 2, 0);
  add(new THREE.BoxGeometry(w, h, 0.05), 0, h / 2, -d / 2);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.45), card);
  flap.position.set(0, h + 0.1, d / 2 + 0.15);
  flap.rotation.x = 0.5;
  g.add(flap);
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.08, d * 0.8), std('#6a8cc4', { roughness: 1 }));
  blanket.position.set(0, 0.09, 0.05);
  g.add(blanket);
  const snow = new THREE.Mesh(roundedBox(w + 0.1, 0.1, d + 0.1), snowMat);
  snow.position.y = h + 0.06;
  g.add(snow);
  g.add(contactShadow(1.6, 1.4, 0.3));
  return g;
}

/** 울타리에 기대 놓은 작은 썰매 */
function leaningSled(): THREE.Group {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 1.5), std('#c43a30'));
  deck.position.set(0, 0.75, 0);
  deck.rotation.x = -1.0;
  g.add(deck);
  for (const sx of [-1, 1]) {
    const run = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.035, 6, 16, Math.PI * 0.6), std('#c9a24a', { metalness: 0.4, roughness: 0.4 }));
    run.position.set(sx * 0.32, 0.75, -0.08);
    run.rotation.set(0, Math.PI / 2, -0.7);
    g.add(run);
  }
  g.add(contactShadow(1.2, 1.4, 0.25));
  return g;
}

/** 눈더미 */
function drift(r: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), snowMat);
  m.scale.set(1.25, 0.6, 1);
  return m;
}

/** 대문 안쪽 공 자리: 눈 위에 그린 동그라미 + 작은 축구공 그림 */
function ballSpot(): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(BALL_SPOT.r - 0.18, BALL_SPOT.r, 40), new THREE.MeshBasicMaterial({ color: '#2f9a4a', transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(ring);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
  dot.rotation.x = -Math.PI / 2;
  dot.position.y = 0.021;
  g.add(dot);
  g.userData.flat = true;
  return g;
}

export interface Ch3Scene {
  root: THREE.Group;
  /** 쪽문 열림(0 닫힘 ~ 1 열림). 순서는 GATES와 같다 */
  setGates(open: readonly number[]): void;
  /** 쪽문 가운데(월드): 공을 든 요정이 막혔을 때 표시를 띄울 곳 */
  gateCenters: THREE.Vector3[];
  /** 민재네 현관문 앞(월드): 05b 사람 장면 */
  porch: THREE.Vector3;
  /** 공 자리 표시(완료하면 끈다) */
  spot: THREE.Object3D;
  update(t: number): void;
}

export function createChapter3Scene(models: Models, base: string, detail: Detail): Ch3Scene {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), std('#eef2f8', { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.copy(at(20, 0, -0.01));
  ground.userData.flat = true;
  root.add(ground);

  // 요정이 다니는 다진 눈길: 옆문 → 쪽문① → 장작 더미 옆 → 쪽문② → 왼쪽 줄 → 가운데 쪽문 → 오른쪽 줄 → 대문 → 공 자리
  const g1 = (FENCES.first.gate[0] + FENCES.first.gate[1]) / 2;
  const g2 = (FENCES.second.gate[0] + FENCES.second.gate[1]) / 2;
  const gm = (FENCES.middle.gate[0] + FENCES.middle.gate[1]) / 2;
  const gy = (FENCES.yard.gate[0] + FENCES.yard.gate[1]) / 2;
  root.add(
    packedPath(base, detail, {
      width: 1.8,
      points: [W(WORKSHOP.door, -PATH_HALF + 0.6), W(2, 0.5), W(8, g1), W(10.5, g1), W(16, 0), W(20, g2), W(23, g2), W(gm - 0.6, -1.6), W(gm + 0.6, 1.6), W(31.5, gy), W(BALL_SPOT.s, BALL_SPOT.t)],
    }),
  );
  root.add(footprints([W(WORKSHOP.door, -PATH_HALF + 0.8), W(-1.6, -2.6), W(-1.8, -0.8)]));

  // 요정 공방(통나무집 2×2칸): 뒤뜰 왼쪽 옆에 서서 앞면(옆문)이 뒤뜰을 본다. 시작 자리 = 옆문 앞
  const ws = buildCabin(models, { depth: 2, wreath: false, scale: PLAZA_WORKSHOP.scale, knob: PLAZA_WORKSHOP.knob, warm: '#ffd463', tint: '#dcc4ae' });
  const half = 1.2 * PLAZA_WORKSHOP.scale;
  const wsg = new THREE.Group();
  if (ws) wsg.add(ws);
  else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2 * half, half, 2 * half), std('#9a6a48'));
    box.position.y = half / 2;
    wsg.add(box);
  }
  // 앞면이 오른쪽(+t)을 보면 모델의 +x는 길 앞쪽(+s): 문(모델 x = -scale/2)이 s = WORKSHOP.door 에 오게
  wsg.position.copy(at(WORKSHOP.door + PLAZA_WORKSHOP.scale / 2, -PATH_HALF - half));
  wsg.rotation.y = YAW.right;
  wsg.userData.fadeable = true;
  root.add(wsg);
  const sign = createWorkshopSign();
  sign.position.copy(at(WORKSHOP.door + 1.6, -PATH_HALF + 0.3, PLAZA_WORKSHOP.scale * 0.9));
  sign.rotation.y = YAW.right;
  root.add(sign);
  const glow = warmPool(2.4);
  glow.position.copy(at(WORKSHOP.door, -PATH_HALF + 1.2, 0.006));
  root.add(glow);
  const wsEnd = WORKSHOP.door + PLAZA_WORKSHOP.scale / 2 + half;
  // 뒤뜰 아래(사진기 쪽) 낮은 울타리
  root.add(edgeFence(models, W(WORKSHOP.s, -PATH_HALF), W(WORKSHOP.s, PATH_HALF), undefined, { x: Math.SQRT1_2, z: Math.SQRT1_2 }));

  // 양옆 높은 판자 울타리(요정 키의 두 배 가까이): 샛길의 테두리
  const tall = FENCE_SCALE * 1.35;
  const lw = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };
  const rw = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
  root.add(edgeFence(models, W(wsEnd, -PATH_HALF), W(YARD_BACK, -PATH_HALF), tall, lw));
  root.add(edgeFence(models, W(WORKSHOP.s, PATH_HALF), W(YARD_BACK, PATH_HALF), tall, rw));

  // 가로지르는 낮은 울타리(쪽문 자리는 비운다)
  const fwd = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 };
  const cross = (s: number, gap: readonly [number, number]) => {
    root.add(edgeFence(models, W(s, -PATH_HALF), W(s, gap[0]), undefined, fwd));
    root.add(edgeFence(models, W(s, gap[1]), W(s, PATH_HALF), undefined, fwd));
  };
  cross(FENCES.first.s, FENCES.first.gate);
  cross(FENCES.second.s, FENCES.second.gate);
  cross(FENCES.yard.s, FENCES.yard.gate);
  const m = FENCES.middle;
  root.add(edgeFence(models, W(m.s[0], m.t), W(m.gate[0], m.t), undefined, rw));
  root.add(edgeFence(models, W(m.gate[1], m.t), W(m.s[1], m.t), undefined, rw));

  // 쪽문 셋
  const leaves: THREE.Object3D[] = [];
  const gateCenters: THREE.Vector3[] = [];
  for (const g of GATES) {
    const w = Math.hypot(g.b.s - g.a.s, g.b.t - g.a.t);
    const sg = sideGate(w);
    const c = at((g.a.s + g.b.s) / 2, (g.a.t + g.b.t) / 2);
    sg.group.position.copy(c);
    const a = W(g.a.s, g.a.t), b = W(g.b.s, g.b.t);
    sg.group.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    sg.group.userData.fadeable = true;
    root.add(sg.group);
    leaves.push(sg.leaf);
    gateCenters.push(c);
  }

  // 민재네 대문(열려 있다): 기둥 둘 + 활짝 젖힌 문 두 짝
  for (const [i, t] of FENCES.yard.gate.entries()) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, TOWN.fence + 0.9, 0.4), wood);
    post.position.copy(at(FENCES.yard.s, t, (TOWN.fence + 0.9) / 2));
    root.add(post);
    const cap = new THREE.Mesh(roundedBox(0.55, 0.16, 0.55), snowMat);
    cap.position.copy(at(FENCES.yard.s, t, TOWN.fence + 0.98));
    root.add(cap);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.5, TOWN.fence * 0.85, 0.08), plank);
    const dir = i === 0 ? 1 : -1;
    // 마당 안쪽으로 젖혀 울타리와 나란히
    leaf.position.copy(at(FENCES.yard.s + 0.8, t + dir * 0.05, TOWN.fence * 0.45));
    leaf.rotation.y = YAW.forward + Math.PI / 2;
    root.add(leaf);
  }

  // 민재네 집 + 현관 발판 + 문 앞 불빛
  const hc = at(MINJAE_HOUSE.s, MINJAE_HOUSE.t);
  root.add(alleyHouse(models, { x: hc.x, z: hc.z, rotY: YAW.back, scale: MINJAE_HOUSE.scale }));
  const doorT = MINJAE_HOUSE.t + 0.8 * MINJAE_HOUSE.scale;
  const porch = at(YARD_BACK - 0.6, doorT);
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), std('#2f6a4a', { roughness: 1 }));
  mat.rotation.set(-Math.PI / 2, 0, -YAW.back);
  mat.position.copy(at(YARD_BACK - 0.7, doorT, 0.012));
  mat.userData.flat = true;
  root.add(mat);
  const pool = warmPool(3.0);
  pool.position.copy(at(YARD_BACK - 1.6, doorT, 0.006));
  root.add(pool);
  // 마당에 굴러다니는 낡은 축구공 골대(민재가 공을 좋아한다): 작은 그물 없는 골대
  const goal = new THREE.Group();
  const white = std('#f2f2f2');
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8), white);
    post.position.set(sx * 1.4, 0.75, 0);
    goal.add(post);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.9, 8), white);
  top.rotation.z = Math.PI / 2;
  top.position.y = 1.5;
  goal.add(top);
  goal.position.copy(at(40.5, -3.4));
  goal.rotation.y = YAW.right;
  goal.userData.fadeable = true;
  root.add(goal);

  const spot = ballSpot();
  spot.position.copy(at(BALL_SPOT.s, BALL_SPOT.t));
  root.add(spot);

  // 장애물
  for (const o of OBSTACLES) {
    const obj = o.id === 'logs' ? logs() : o.id === 'box' ? dogBox() : o.id === 'sled' ? leaningSled() : drift(o.r);
    obj.position.copy(at(o.s, o.t));
    obj.rotation.y = YAW.back + (o.id === 'box' ? 0.5 : o.id === 'logs' ? 0.3 : 0);
    obj.userData.fadeable = true;
    root.add(obj);
  }

  // 울타리 너머 바깥: 나무(샛길을 덮지 않게 멀리, 조금 작게)
  for (const [s, t, n] of [[-4, 11, 'treeSnowB'], [14, -11.5, 'treeSnowA'], [24, 11.5, 'treeSnowB'], [40, -11, 'treeSnowA'], [46, 11, 'treeSnowB']] as const) {
    const tr = kenneyProp(models, n, 4.2);
    if (!tr) continue;
    tr.position.copy(at(s, t));
    tr.userData.fadeable = true;
    root.add(tr);
  }
  for (const [s, t] of [[8, PATH_HALF + 1.0], [27, -PATH_HALF - 1.0], [35, PATH_HALF + 1.0]] as const) {
    const l = townLamp();
    l.position.copy(at(s, t));
    l.userData.fadeable = true;
    root.add(l);
  }
  root.add(berm([W(WORKSHOP.s - 1.5, -PATH_HALF - 3), W(WORKSHOP.s - 2, 0), W(WORKSHOP.s - 1.5, PATH_HALF + 3)], 3, 0.7, 5));

  return {
    root,
    gateCenters,
    porch,
    spot,
    setGates(open) {
      leaves.forEach((l, i) => (l.rotation.y = -(open[i] ?? 0) * 1.6));
    },
    update() {},
  };
}

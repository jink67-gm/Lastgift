// 2장 수선집 장면(직접 제작 기본 도형): 뒤뜰 · 덧문 · 반입 통로 · 작업실 · 작업대와 빨간 코트.
// 판정은 src/core/sewing.ts가 한다. 여기서는 그 상태를 그리기만 한다.
import * as THREE from 'three';
import type { BoxCollider, CircleCollider } from '../core/collision';
import { CH2 } from '../data/chapter2';

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

export interface Chapter2View {
  root: THREE.Group;
  /** 덧문 열림(0 닫힘 ~ 1 열림)을 부드럽게 따라간다 */
  update(
    dt: number,
    s: { doorOpen: boolean; latched: boolean; reveal: 'hidden' | 'glimpse' | 'open'; delivered: boolean; timeSec: number; seeThrough: boolean },
  ): void;
}

export function createChapter2(): Chapter2View {
  const root = new THREE.Group();

  // 바닥: 뒤뜰 눈 / 통로 돌바닥 / 작업실 나무 바닥
  root.add(mesh(new THREE.BoxGeometry(12, 0.4, 10), mat('#eef3fb', { roughness: 1 }), 0, -0.2, 7));
  root.add(mesh(new THREE.BoxGeometry(2.6, 0.4, 4), mat('#9aa3b2'), 0, -0.2, 0));
  root.add(mesh(new THREE.BoxGeometry(12, 0.4, 10), mat('#b98a5e'), 0, -0.2, -7));
  // 작업실 마루 줄
  for (let x = -5.5; x <= 5.5; x += 1) root.add(mesh(new THREE.BoxGeometry(0.03, 0.01, 10), mat('#8f6845'), x, 0.005, -7));

  // 벽·장애물(충돌체와 같은 자리)
  const wallMat = mat('#c9a27a');
  const stone = mat('#7b8494');
  // 카메라와 통로 사이에 서는 것(뒤뜰 뒷벽, 카메라 쪽 건물과 처마). 팀이 통로에 있으면 반투명하게 한다
  const occluders: THREE.MeshStandardMaterial[] = [];
  const fadeable = (color: string) => {
    const m = mat(color, { transparent: true, opacity: 1 });
    occluders.push(m);
    return m;
  };
  for (const c of CH2.walls) {
    if (c.kind === 'box') {
      const b = c as BoxCollider;
      const isBuilding = b.hz >= 1.9 && Math.abs(b.z) < 0.1; // 통로 양옆 건물
      const isWall = b.hz <= 0.2; // 뒤뜰 뒷벽
      const inFront = isWall || (isBuilding && b.x > 0); // 카메라(+x,+z) 쪽에서 통로를 가리는 것
      const h = isBuilding ? 2.6 : isWall ? 2.4 : 1.0;
      const m = inFront ? fadeable('#c9a27a') : isBuilding ? wallMat : b.z > 0 ? mat('#8a6a4a') : mat('#6b4a33');
      root.add(mesh(new THREE.BoxGeometry(b.hx * 2, h, b.hz * 2), m, b.x, h / 2, b.z));
      if (isBuilding) {
        // 처마(지붕 끝) — 통로 위에서 앞뒤 공간 전환을 가린다
        const eave = mesh(new THREE.BoxGeometry(b.hx * 2 + 0.3, 0.25, b.hz * 2 + 0.3), inFront ? fadeable('#7a3a2e') : mat('#7a3a2e'), b.x, 2.75, b.z);
        root.add(eave);
      }
    } else if (c.kind === 'circle') {
      const k = c as CircleCollider;
      root.add(mesh(new THREE.CylinderGeometry(k.r, k.r, 2.2, 8), stone, k.x, 1.1, k.z));
    }
  }
  // 빨랫줄
  const rope = mesh(new THREE.CylinderGeometry(0.02, 0.02, 9.7, 4), mat('#ddd'), 0.05, 2.1, 10.6);
  rope.rotation.z = Math.PI / 2;
  root.add(rope);
  for (const [x, c] of [[-2.5, '#4a7bd0'], [-0.5, '#e0b021'], [1.8, '#2f9a4a']] as const) {
    root.add(mesh(new THREE.BoxGeometry(0.8, 0.9, 0.05), mat(c), x, 1.6, 10.6));
  }

  // 덧문: 왼쪽 경첩(x = −halfGap)에서 통로 쪽(−z)으로 열린다
  const hinge = new THREE.Group();
  hinge.position.set(CH2.door.x - CH2.door.halfGap, 0, CH2.door.z);
  const panelW = CH2.door.halfGap * 2;
  const panel = mesh(new THREE.BoxGeometry(panelW, 2.1, 0.1), mat('#6b8f5e'), panelW / 2, 1.05, 0);
  hinge.add(panel);
  for (const y of [0.5, 1.6]) hinge.add(mesh(new THREE.BoxGeometry(panelW * 0.9, 0.12, 0.14), mat('#4f6b45'), panelW / 2, y, 0));
  root.add(hinge);
  // 문틀
  const frameMat = mat('#4a3324');
  root.add(mesh(new THREE.BoxGeometry(0.15, 2.4, 0.4), frameMat, -CH2.door.halfGap - 0.05, 1.2, CH2.door.z));
  root.add(mesh(new THREE.BoxGeometry(0.15, 2.4, 0.4), frameMat, CH2.door.halfGap + 0.05, 1.2, CH2.door.z));
  root.add(mesh(new THREE.BoxGeometry(panelW + 0.3, 0.15, 0.4), frameMat, 0, 2.35, CH2.door.z));

  // 걸쇠: 문 오른쪽 벽의 고리. 걸면 금색으로 바뀌고 고리가 문 쪽으로 눕는다
  const latchMat = mat('#3b3f4a', { metalness: 0.4, roughness: 0.4 });
  const latchArm = mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), latchMat, CH2.latch.x - 0.2, 1.1, CH2.door.z + 0.2);
  latchArm.rotation.z = 1.1;
  root.add(latchArm);
  root.add(mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12), latchMat, CH2.latch.x, 1.1, CH2.door.z + 0.2));

  // 문 앞 받침대(쉼터)
  const st = CH2.stand;
  const standG = new THREE.Group();
  standG.position.set(st.x, 0, st.z);
  standG.add(mesh(new THREE.BoxGeometry(st.w, 0.1, st.d), mat('#9a7048'), 0, 0.42, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) standG.add(mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), mat('#6b4a33'), sx * (st.w / 2 - 0.1), 0.2, sz * (st.d / 2 - 0.1)));
  root.add(standG);

  // 작업실: 작업대 + 빨간 코트 걸이 + 기다리는 옷들 + 따뜻한 불빛
  const b = CH2.bench;
  const bench = new THREE.Group();
  bench.position.set(b.x, 0, b.z);
  bench.add(mesh(new THREE.BoxGeometry(b.w, 0.1, b.d), mat('#c89b6a'), 0, 0.72, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bench.add(mesh(new THREE.BoxGeometry(0.1, 0.72, 0.1), mat('#6b4a33'), sx * (b.w / 2 - 0.08), 0.36, sz * (b.d / 2 - 0.08)));
  root.add(bench);
  // 상자를 놓을 자리 표시(작업대 위 가는 선)
  const mark = mesh(new THREE.BoxGeometry(1.6, 0.01, 0.8), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.35 }), b.x, 0.78, b.z);
  root.add(mark);

  const rack = new THREE.Group();
  rack.position.set(CH2.coat.x, 0, CH2.coat.z);
  rack.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.9, 6), mat('#3b3f4a'), -0.7, 0.95, 0));
  rack.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.9, 6), mat('#3b3f4a'), 0.7, 0.95, 0));
  const bar = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), mat('#3b3f4a'), 0, 1.85, 0);
  bar.rotation.z = Math.PI / 2;
  rack.add(bar);
  // 빨간 코트(소매가 긴 아이 코트): 몸통 + 긴 소매 둘
  const coatMat = mat('#d0282e', { emissive: '#5a0a0c', emissiveIntensity: 0.3 });
  const coat = new THREE.Group();
  coat.add(mesh(new THREE.BoxGeometry(0.6, 0.8, 0.14), coatMat, 0, 1.35, 0));
  for (const sx of [-1, 1]) {
    const sleeve = mesh(new THREE.BoxGeometry(0.14, 0.75, 0.13), coatMat, sx * 0.38, 1.3, 0);
    sleeve.rotation.z = sx * 0.12;
    coat.add(sleeve);
  }
  coat.add(mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 10), mat('#3b3f4a'), 0, 1.78, 0));
  rack.add(coat);
  // 차례를 기다리는 옷: 바지·점퍼
  rack.add(mesh(new THREE.BoxGeometry(0.4, 0.8, 0.1), mat('#3d5a8a'), -0.45, 1.3, 0.05));
  rack.add(mesh(new THREE.BoxGeometry(0.45, 0.6, 0.12), mat('#6b8f5e'), 0.48, 1.45, 0.05));
  root.add(rack);

  const warm = new THREE.PointLight('#ffcf8a', 0, 10, 1.4);
  warm.position.set(0, 2.6, -8.5);
  root.add(warm);
  const lamp = mesh(new THREE.SphereGeometry(0.18, 12, 10), mat('#fff1c2', { emissive: '#ffd98a', emissiveIntensity: 0 }), 0, 2.6, -8.5);
  root.add(lamp);

  // 작업실 지붕: 문이 열리기 전에는 덮여 있고, 열린 문틈으로 안이 보이기 시작하고, 확정되면 걷힌다
  const roofMat = new THREE.MeshStandardMaterial({ color: '#5a3a2a', roughness: 0.9, transparent: true, opacity: 1 });
  const roof = mesh(new THREE.BoxGeometry(12.4, 0.3, 10.2), roofMat, 0, 3.0, -7.05);
  root.add(roof);
  // 작업실 바깥벽 윗선(지붕이 걷힌 뒤에도 공간 경계가 보이게)
  root.add(mesh(new THREE.BoxGeometry(12, 0.6, 0.2), mat('#c9a27a'), 0, 0.3, -12));

  let doorT = 0;
  return {
    root,
    update(dt, s) {
      const target = s.doorOpen ? 1 : 0;
      doorT += (target - doorT) * (1 - Math.exp(-dt * 8));
      hinge.rotation.y = doorT * 1.65; // 통로 쪽으로 열림
      latchMat.color.set(s.latched ? '#d8b04a' : '#3b3f4a');
      latchArm.rotation.z = s.latched ? 0 : 1.1;
      const want = s.reveal === 'hidden' ? 1 : s.reveal === 'glimpse' ? 0.35 : 0;
      roofMat.opacity += (want - roofMat.opacity) * (1 - Math.exp(-dt * 4));
      roof.visible = roofMat.opacity > 0.02;
      const lit = s.reveal === 'hidden' ? 0 : 1;
      warm.intensity += (lit * 9 - warm.intensity) * (1 - Math.exp(-dt * 4));
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = warm.intensity / 7;
      coatMat.emissiveIntensity = s.delivered ? 0.6 + Math.sin(s.timeSec * 3) * 0.2 : 0.3;
      const wantWall = s.seeThrough ? 0.22 : 1;
      for (const m of occluders) {
        m.opacity += (wantWall - m.opacity) * (1 - Math.exp(-dt * 8));
        m.depthWrite = m.opacity > 0.95;
      }
    },
  };
}

/** 체력 막대(운반자 머리 위) */
/** 둥근 막대 모양(가로 w, 세로 h) */
function pill(w: number, h: number): THREE.ShapeGeometry {
  const r = h / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2 + r, -r);
  sh.lineTo(w / 2 - r, -r);
  sh.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  sh.lineTo(-w / 2 + r, r);
  sh.absarc(-w / 2 + r, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  return new THREE.ShapeGeometry(sh, 10);
}

/**
 * 체력 막대: 흰 테두리 + 짙은 바깥선 + 짙은 남색 속 → 눈밭·나무·지붕 어느 배경에서도 보인다.
 * 초록 → 절반 아래 노랑 → 25% 아래 주황빨강(깜빡임). 항상 카메라를 본다(호출 쪽에서 회전 복사).
 */
export function createStaminaBar(): { group: THREE.Group; set(v: number, warn: boolean, visible: boolean): void } {
  const group = new THREE.Group();
  const W = 0.95, H = 0.2;
  const ui = (color: string, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false });
  const outline = new THREE.Mesh(pill(W + 0.1, H + 0.1), ui('#0e1420', 0.85));
  const rim = new THREE.Mesh(pill(W + 0.05, H + 0.05), ui('#ffffff'));
  const bg = new THREE.Mesh(pill(W - 0.02, H - 0.04), ui('#1b2433'));
  const fillMat = ui('#5fd36a');
  const fill = new THREE.Mesh(pill(W - 0.06, H - 0.08), fillMat);
  [outline, rim, bg, fill].forEach((m, i) => {
    m.renderOrder = 10 + i;
    m.position.z = i * 0.001;
    group.add(m);
  });
  const fw = W - 0.06;
  return {
    group,
    set(v, warn, visible) {
      group.visible = visible;
      const k = Math.max(0.04, v / 100);
      fill.scale.x = k;
      fill.position.x = (-fw / 2) * (1 - k);
      const low = warn || v <= 25;
      fillMat.color.set(low ? '#ff6a3d' : v <= 50 ? '#ffd84a' : '#5fd36a');
      fillMat.opacity = low ? 0.65 + 0.35 * Math.abs(Math.sin(performance.now() / 160)) : 1;
    },
  };
}

/** 벙어리장갑 하나(캔버스, 가운데 기준) */
function mitten(g: CanvasRenderingContext2D, x: number, y: number, s: number, body: string, cuff: string, flip: boolean): void {
  g.save();
  g.translate(x, y);
  g.scale(flip ? -s : s, s);
  g.lineWidth = 3;
  g.strokeStyle = '#1b2433';
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(0, -4, 12, 15, 0, 0, Math.PI * 2); // 손바닥
  g.fill();
  g.stroke();
  g.beginPath();
  g.ellipse(-11, 0, 5, 8, -0.6, 0, Math.PI * 2); // 엄지
  g.fill();
  g.stroke();
  g.fillStyle = cuff;
  g.fillRect(-11, 9, 22, 8);
  g.strokeRect(-11, 9, 22, 8);
  g.restore();
}

/** 교대 표시: 손잡이 옆에서 두 손(장갑)이 화살표를 따라 자리를 바꾸는 그림(체력 25% 이하). 흰 둥근 판 + 짙은 테두리 */
export function createSwapSign(): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d')!;
  // 판: 바깥 짙은 선 + 흰 바탕 + 노란 안쪽 테
  g.fillStyle = '#1b2433';
  g.beginPath();
  g.arc(80, 76, 70, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(80, 76, 63, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffd84a';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(80, 76, 56, 0, Math.PI * 2);
  g.stroke();
  // 판 아래 꼬리(손잡이를 가리킨다)
  g.fillStyle = '#1b2433';
  g.beginPath();
  g.moveTo(68, 140);
  g.lineTo(92, 140);
  g.lineTo(80, 158);
  g.fill();
  // 두 장갑: 지친 손(빨강) ↔ 새 손(초록)
  mitten(g, 54, 82, 1.15, '#e0505a', '#f7f7f7', false);
  mitten(g, 106, 82, 1.15, '#3fae5a', '#f7f7f7', true);
  // 두 장갑 위·아래를 도는 화살표
  g.strokeStyle = '#2f6fd0';
  g.lineWidth = 7;
  g.lineCap = 'round';
  const arrow = (a0: number, a1: number, tip: [number, number], dir: number) => {
    g.beginPath();
    g.arc(80, 78, 40, a0, a1);
    g.stroke();
    g.fillStyle = '#2f6fd0';
    g.beginPath();
    g.moveTo(tip[0], tip[1]);
    g.lineTo(tip[0] - 10 * dir, tip[1] - 9);
    g.lineTo(tip[0] - 10 * dir, tip[1] + 9);
    g.fill();
  };
  arrow(Math.PI * 1.2, Math.PI * 1.8, [118, 50], 1);
  arrow(Math.PI * 0.2, Math.PI * 0.8, [42, 106], -1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.center.set(0.5, 0.05); // 꼬리 끝이 기준점(손잡이 위)
  sp.scale.set(0.85, 0.85, 1);
  sp.renderOrder = 14;
  sp.visible = false;
  // 살짝 커졌다 작아지며 눈에 띄게
  sp.onBeforeRender = () => {
    const t = performance.now() / 1000;
    const k = 0.85 * (1 + 0.06 * Math.sin(t * 6));
    sp.scale.set(k, k, 1);
    sp.material.rotation = Math.sin(t * 3) * 0.04;
  };
  return sp;
}

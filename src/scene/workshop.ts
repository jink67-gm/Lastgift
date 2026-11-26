// 요정 공방 골목 소품(직접 제작): 낮은 작업대(펼친 포장지·리본 실패·가위 / 아래 포장 끝난 선물), 길가 창고, 공방 간판.
// 모두 요정 크기(요정 키 ≈ 1.32 게임 단위)에 맞춘다. 쓰임새가 위치로 읽히게: 작업대 → 썰매 짐칸 쪽으로 선물이 모인다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const WOOD = mat('#8a5a3a');
const WOOD_DARK = mat('#5e3b25');
const SNOW = mat('#fbf8f2', { roughness: 1 });

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  return o;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 포장지 무늬(빨강 바탕 + 흰 별·점) */
let paperTex: THREE.CanvasTexture | null = null;
function wrappingPaper(): THREE.CanvasTexture {
  paperTex ??= canvasTex(128, 128, (g) => {
    g.fillStyle = '#d23a3a';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fff4e0';
    for (let y = 8; y < 128; y += 24) for (let x = (y / 24) % 2 ? 20 : 8; x < 128; x += 24) {
      g.beginPath();
      g.arc(x, y, 3.2, 0, 7);
      g.fill();
    }
  });
  return paperTex;
}

/** 리본 묶은 작은 선물 상자 */
function wrapped(w: number, h: number, d: number, body: string, ribbon: string): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.08), mat(body)));
  g.children[0]!.position.y = h / 2;
  const r = mat(ribbon, { roughness: 0.5 });
  g.add(box(w + 0.01, h + 0.01, 0.06, r, 0, h / 2, 0));
  g.add(box(0.06, h + 0.01, d + 0.01, r, 0, h / 2, 0));
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 10), r);
  bow.position.set(0, h + 0.05, 0);
  bow.rotation.x = Math.PI / 2;
  g.add(bow);
  return g;
}

/**
 * 낮은 작업대(요정 허리~가슴 높이). 위: 펼친 포장지(한쪽이 늘어진다)·포장지 두루마리·리본 실패·가위.
 * 아래 선반과 썰매 쪽 옆: 포장이 끝난 선물. 원점 = 바닥 가운데, 앞(+z)이 광장 쪽.
 */
export function createWorkbench(w: number, d: number, h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.12, d, WOOD, 0, h - 0.06, 0)); // 상판
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.12, h - 0.12, 0.12, WOOD_DARK, sx * (w / 2 - 0.1), (h - 0.12) / 2, sz * (d / 2 - 0.1)));
  g.add(box(w - 0.2, 0.08, d - 0.15, WOOD_DARK, 0, 0.28, 0)); // 아래 선반
  // 펼친 포장지: 상판 위에 넓게, 앞쪽으로 살짝 늘어진다
  const paper = new THREE.MeshStandardMaterial({ map: wrappingPaper(), roughness: 0.7, side: THREE.DoubleSide });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.3, d * 0.85), paper);
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set(-0.35, h + 0.005, 0);
  g.add(sheet);
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.35), paper);
  flap.position.set(-0.35, h - 0.17, d / 2 + 0.005);
  g.add(flap);
  // 두루마리 둘(빨강·초록), 리본 실패(금색·하늘색), 가위
  const roll = (c: string, x: number, z: number) => {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, d * 0.8, 12), mat(c));
    r.rotation.x = Math.PI / 2;
    r.position.set(x, h + 0.09, z);
    g.add(r);
  };
  roll('#d23a3a', 0.55, 0);
  roll('#2f8a4a', 0.78, 0);
  const spool = (c: string, x: number, z: number) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 14), mat(c, { roughness: 0.4 }));
    s.position.set(x, h + 0.05, z);
    g.add(s);
  };
  spool('#e8b83a', 1.05, -0.2);
  spool('#6fb8e8', 1.05, 0.15);
  const ribbonTail = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.5), mat('#e8b83a', { side: THREE.DoubleSide }));
  ribbonTail.position.set(1.12, h - 0.2, 0.15 + d / 2 - 0.4);
  ribbonTail.rotation.y = 0.3;
  g.add(ribbonTail);
  const blade = mat('#c8ced8', { metalness: 0.6, roughness: 0.3 });
  const sc = new THREE.Group();
  sc.add(box(0.28, 0.015, 0.03, blade, 0.1, 0, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 10), mat('#d23a3a'));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(-0.06, 0, 0.03);
  sc.add(ring);
  sc.position.set(-0.2, h + 0.02, 0.25);
  sc.rotation.y = 0.5;
  g.add(sc);
  // 포장이 끝난 선물: 아래 선반과 썰매 쪽(+x) 바닥에 쌓인다
  const done: [number, number, number, number, number, number, string, string][] = [
    [-0.7, 0.32, 0, 0.45, 0.35, 0.4, '#2f8a4a', '#e8b83a'],
    [-0.15, 0.32, 0.05, 0.4, 0.3, 0.35, '#3a6fd0', '#fff4e0'],
    [0.45, 0.32, -0.05, 0.5, 0.38, 0.4, '#e8b83a', '#d23a3a'],
    [w / 2 + 0.35, 0, 0.1, 0.55, 0.45, 0.5, '#d23a3a', '#fff4e0'],
    [w / 2 + 0.4, 0.45, 0.05, 0.4, 0.32, 0.36, '#7a4ad0', '#e8b83a'],
    [w / 2 + 0.85, 0, 0.35, 0.42, 0.36, 0.42, '#2f8a4a', '#d23a3a'],
  ];
  for (const [x, y, z, bw, bh, bd, c, r] of done) {
    const b = wrapped(bw, bh, bd, c, r);
    b.position.set(x, y, z);
    b.rotation.y = (x * 7) % 0.5;
    g.add(b);
  }
  // 상판 위 눈은 없음(공방 처마 아래). 다리 둘레만 살짝 쌓인 눈
  return g;
}

/** 길가 낮은 창고(요정 크기): 판자 벽 + 한쪽으로 기운 지붕 + 지붕 위 눈 + 작은 문 + 옆 장작 더미 */
export function createShed(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const h = 1.9;
  const planks = canvasTex(64, 64, (c) => {
    c.fillStyle = '#9a6a45';
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#7d5435';
    for (let x = 0; x < 64; x += 11) c.fillRect(x, 0, 2, 64);
  });
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping;
  planks.repeat.set(w / 1.2, 1);
  const wall = new THREE.MeshStandardMaterial({ map: planks, roughness: 0.9 });
  g.add(box(w, h, d, wall, 0, h / 2, 0));
  const roof = box(w + 0.5, 0.14, d + 0.7, WOOD_DARK, 0, h + 0.25, 0.05);
  roof.rotation.x = 0.2;
  g.add(roof);
  const cap = new THREE.Mesh(new RoundedBoxGeometry(w + 0.4, 0.22, d + 0.55, 2, 0.1), SNOW);
  cap.position.set(0, h + 0.4, 0.02);
  cap.rotation.x = 0.2;
  g.add(cap);
  g.add(box(0.8, 1.3, 0.05, WOOD_DARK, -w / 4, 0.65, d / 2 + 0.03)); // 작은 문
  // 장작 더미(길 쪽)
  const log = mat('#7a4f2e');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.9, 8), log);
    l.rotation.x = Math.PI / 2;
    l.position.set(w / 2 + 0.25 + j * 0.27 + i * 0.13, 0.13 + i * 0.23, 0.2);
    g.add(l);
  }
  return g;
}

/** 공방 간판: 문 위에 매단 판(포장된 선물 그림, 글자 없음) */
export function createWorkshopSign(): THREE.Group {
  const g = new THREE.Group();
  const face = canvasTex(128, 96, (c) => {
    c.fillStyle = '#f3e3c3';
    c.fillRect(0, 0, 128, 96);
    c.strokeStyle = '#6b4428';
    c.lineWidth = 8;
    c.strokeRect(4, 4, 120, 88);
    c.fillStyle = '#d23a3a';
    c.fillRect(38, 34, 52, 42);
    c.fillStyle = '#e8b83a';
    c.fillRect(60, 34, 8, 42);
    c.fillRect(38, 50, 52, 8);
    c.beginPath();
    c.ellipse(56, 28, 10, 7, -0.4, 0, 7);
    c.ellipse(72, 28, 10, 7, 0.4, 0, 7);
    c.fill();
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.08), [WOOD, WOOD, WOOD, WOOD, new THREE.MeshStandardMaterial({ map: face, roughness: 0.8 }), WOOD]);
  g.add(board);
  const cap = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.1, 0.16, 2, 0.04), SNOW);
  cap.position.y = 0.5;
  g.add(cap);
  return g;
}
